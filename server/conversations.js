// Liga o WhatsApp aos leads: grava a conversa e, com a IA ligada, responde sozinho.
import { db, getSetting } from './db.js';
import { classifyPhone } from './scoring.js';
import { bus, setIncomingHandler, sendText, resolveJid, markRead, waStatus } from './whatsapp.js';
import { nextReply, aiReady, friendlyError, NO_QUOTA } from './agent.js';

const DEBOUNCE_MS = 9_000;           // cliente costuma mandar várias mensagens seguidas
const MAX_AI_PER_DAY = 25;           // trava de segurança por lead
const timers = new Map();            // business_id -> timeout da próxima resposta
const running = new Set();
const retryCount = new Map();      // business_id -> tentativas seguidas por sobrecarga           // business_id com resposta sendo gerada

const phoneKey = (digits) => {
  if (!digits) return null;
  const d = String(digits).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length >= 10 ? `${d.slice(0, 2)}${d.slice(-8)}` : null; // DDD + 8 últimos (ignora o 9º dígito)
};
const jidDigits = (jid) => (jid || '').split('@')[0].split(':')[0];

function logEvent(id, who, type, detail = null) {
  db.prepare('INSERT INTO events(business_id, who, type, detail) VALUES(?,?,?,?)').run(id, who, type, detail);
}

function saveMessage(businessId, { direction, author, text, waId = null }) {
  const r = db.prepare('INSERT OR IGNORE INTO messages(business_id, direction, author, text, wa_id) VALUES(?,?,?,?,?)')
    .run(businessId, direction, author, text, waId);
  if (!r.changes) return null;
  const msg = db.prepare('SELECT id, direction, author, text, at FROM messages WHERE id = ?').get(Number(r.lastInsertRowid));
  bus.emit('message', { businessId, message: msg });
  return msg;
}

export function aiInfo(row) {
  return { enabled: Boolean(row.ai_enabled), state: row.ai_state || null, jid: row.wa_jid || null };
}

function emitLead(id) {
  const row = db.prepare('SELECT id, ai_enabled, ai_state, wa_jid, status FROM businesses WHERE id = ?').get(id);
  if (row) bus.emit('lead', { businessId: id, ai: aiInfo(row), status: row.status });
}

/** Acha o lead dono de uma conversa. Só conversas de leads: o resto do WhatsApp é ignorado. */
function findLead(jid, pnJid, { anyLead = false } = {}) {
  const byJid = db.prepare('SELECT * FROM businesses WHERE wa_jid IN (?, ?) LIMIT 1').get(jid, pnJid || jid);
  if (byJid) return byJid;
  const key = phoneKey(jidDigits(pnJid));
  if (!key) return null;
  // No modo normal, só procura entre leads com a IA ligada ou já abordados pelo app.
  const rows = db.prepare(`SELECT * FROM businesses WHERE phone IS NOT NULL ${anyLead ? '' : "AND (ai_enabled = 1 OR status NOT IN ('novo','descartado'))"}`).all();
  return rows.find((r) => phoneKey(classifyPhone(r.phone).digits) === key) || null;
}

// ---------- modo "atender todos os números" ----------
export function answerAll() { return Boolean(getSetting('aiAnswerAll', false)); }
export function ignoredNumbers() { const v = getSetting('aiIgnore', []); return Array.isArray(v) ? v : []; }
function isIgnored(pnJid) {
  const key = phoneKey(jidDigits(pnJid));
  return Boolean(key) && ignoredNumbers().some((n) => phoneKey(n) === key);
}

const fmtPhone = (d) => {
  const l = d.startsWith('55') ? d.slice(2) : d;
  return l.length === 11 ? `(${l.slice(0, 2)}) ${l.slice(2, 7)}-${l.slice(7)}` : l.length === 10 ? `(${l.slice(0, 2)}) ${l.slice(2, 6)}-${l.slice(6)}` : `+${d}`;
};

/** Contato novo que mandou mensagem: vira um lead "entrada" com a IA ligada. */
function createInbound(jid, pnJid, pushName) {
  const digits = pnJid ? jidDigits(pnJid) : null;
  const phone = digits ? fmtPhone(digits) : null;
  const name = (pushName || '').trim().slice(0, 80) || (phone ? `Contato ${phone}` : 'Contato do WhatsApp');
  const id = Number(db.prepare(`INSERT INTO businesses(name, phone, phone_kind, wa_jid, status, ai_enabled, inbound, sources, category, contacted_at)
    VALUES(?, ?, 'mobile', ?, 'respondeu', 1, 1, '["whatsapp"]', 'Chamou no WhatsApp', datetime('now'))`).run(name, phone, jid).lastInsertRowid);
  logEvent(id, 'WhatsApp', 'ia', 'contato novo chamou no WhatsApp; a IA está atendendo');
  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
}

async function onIncoming({ id, fromMe, jid, pnJid, text, pushName }) {
  const all = answerAll();
  if (all && isIgnored(pnJid)) return; // número pessoal que você pediu para a IA não atender
  let lead = findLead(jid, pnJid, { anyLead: all });
  if (!lead) {
    if (!all || fromMe) return;
    lead = createInbound(jid, pnJid, pushName);
  } else if (all && !fromMe && !lead.ai_enabled && !lead.ai_manual_off && !lead.ai_state && lead.status !== 'descartado') {
    // Modo "todos": liga a IA, a não ser que alguém tenha desligado nesse contato ou ela tenha passado para um humano.
    db.prepare('UPDATE businesses SET ai_enabled = 1 WHERE id = ?').run(lead.id);
    logEvent(lead.id, 'IA', 'ia', 'ligou sozinha (modo atender todos os números)');
    lead = { ...lead, ai_enabled: 1 };
  }
  if (lead.wa_jid !== jid) db.prepare('UPDATE businesses SET wa_jid = ? WHERE id = ?').run(jid, lead.id);

  if (fromMe) {
    // Mensagem enviada por nós. Se não foi o app (já gravada pelo wa_id), foi alguém digitando no celular.
    await new Promise((r) => setTimeout(r, 1500));
    if (db.prepare('SELECT 1 FROM messages WHERE wa_id = ?').get(id)) return;
    saveMessage(lead.id, { direction: 'out', author: lead.owner || 'vendedor', text, waId: id });
    if (lead.ai_enabled) {
      // Um humano respondeu pelo celular: a IA sai da frente para não atropelar.
      pauseAi(lead.id, 'Você respondeu pelo celular, então a IA pausou nesta conversa.');
    }
    return;
  }

  const msg = saveMessage(lead.id, { direction: 'in', author: 'cliente', text, waId: id });
  if (!msg) return;
  if (['novo', 'contatado'].includes(lead.status)) {
    db.prepare(`UPDATE businesses SET status = 'respondeu', contacted_at = COALESCE(contacted_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`).run(lead.id);
    logEvent(lead.id, 'WhatsApp', 'status', `${lead.status} → respondeu`);
    emitLead(lead.id);
  }
  if (lead.ai_enabled) { markRead(jid, id); schedule(lead.id); }
}

function schedule(businessId, delay = DEBOUNCE_MS) {
  clearTimeout(timers.get(businessId));
  timers.set(businessId, setTimeout(() => { timers.delete(businessId); reply(businessId).catch((e) => console.error('[ia]', e)); }, delay));
  timers.get(businessId).unref?.();
}

function pauseAi(businessId, reason) {
  clearTimeout(timers.get(businessId));
  timers.delete(businessId);
  db.prepare('UPDATE businesses SET ai_enabled = 0, ai_state = ? WHERE id = ?').run(reason, businessId);
  logEvent(businessId, 'IA', 'ia', `pausou: ${reason}`);
  emitLead(businessId);
}

async function reply(businessId) {
  if (running.has(businessId)) { schedule(businessId, 4000); return; }
  const lead = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!lead?.ai_enabled || !lead.wa_jid) return;
  const history = db.prepare('SELECT direction, author, text FROM messages WHERE business_id = ? ORDER BY id').all(businessId);
  if (!history.length || history[history.length - 1].direction !== 'in') return; // nada novo do cliente
  if (waStatus().status !== 'open') return; // responde quando reconectar (resumePending)
  if (!aiReady()) { setState(businessId, 'Falta a chave do Google Gemini em Configurações. A IA não respondeu.'); return; }
  const today = db.prepare(`SELECT COUNT(*) n FROM messages WHERE business_id = ? AND author = 'ia' AND at >= datetime('now','-1 day')`).get(businessId).n;
  if (today >= MAX_AI_PER_DAY) { pauseAi(businessId, `A IA já mandou ${MAX_AI_PER_DAY} mensagens hoje nesta conversa.`); return; }

  running.add(businessId);
  try {
    const audit = (() => { try { return JSON.parse(lead.audit || 'null'); } catch { return null; } })();
    const out = await nextReply({ ...lead, audit }, history, { company: getSetting('company', 'Synch'), seller: lead.owner });
    // O cliente pode ter escrito de novo enquanto a IA pensava: responde tudo de uma vez depois.
    const last = db.prepare('SELECT direction FROM messages WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(businessId);
    const still = db.prepare('SELECT ai_enabled FROM businesses WHERE id = ?').get(businessId);
    if (!still?.ai_enabled) return;
    if (out.reply && last?.direction === 'in' && history.length === db.prepare('SELECT COUNT(*) n FROM messages WHERE business_id = ?').get(businessId).n) {
      const waId = await sendText(lead.wa_jid, out.reply);
      saveMessage(businessId, { direction: 'out', author: 'ia', text: out.reply, waId });
    } else if (out.reply) {
      schedule(businessId, 2000);
      return;
    }
    if (out.stage === 'reuniao' && ['novo', 'contatado', 'respondeu'].includes(lead.status)) {
      db.prepare(`UPDATE businesses SET status = 'reuniao', updated_at = datetime('now') WHERE id = ?`).run(businessId);
      logEvent(businessId, 'IA', 'status', `${lead.status} → reuniao`);
    }
    if (out.stage === 'sem_interesse') pauseAi(businessId, 'O cliente disse que não tem interesse. A IA se despediu e parou.');
    else if (out.handoff) pauseAi(businessId, out.handoff_reason || 'O cliente precisa de um humano.');
    else setState(businessId, null);
    retryCount.delete(businessId);
    emitLead(businessId);
  } catch (e) {
    console.error('[ia] falhou:', e.message);
    const msg = friendlyError(e);
    // Sobrecarga é passageira: tenta de novo em 1 minuto (até 5 vezes) para o cliente não ficar sem resposta.
    if (/sobrecarregad/.test(msg) && (retryCount.get(businessId) || 0) < 5) {
      retryCount.set(businessId, (retryCount.get(businessId) || 0) + 1);
      schedule(businessId, 60_000);
    }
    setState(businessId, (msg === NO_QUOTA || /sobrecarregad|instável/.test(msg)) ? msg : `A IA não conseguiu responder (${msg.slice(0, 120)}). Vai tentar de novo na próxima mensagem.`);
  } finally {
    running.delete(businessId);
  }
}

function setState(businessId, text) {
  db.prepare('UPDATE businesses SET ai_state = ? WHERE id = ?').run(text, businessId);
  emitLead(businessId);
}

async function jidFor(lead) {
  if (lead.wa_jid) return lead.wa_jid;
  const phone = classifyPhone(lead.phone);
  if (phone.kind !== 'mobile') throw new Error('Este lead não tem celular cadastrado.');
  const jid = await resolveJid(phone.digits);
  if (!jid) throw new Error('Esse número não tem WhatsApp.');
  db.prepare('UPDATE businesses SET wa_jid = ? WHERE id = ?').run(jid, lead.id);
  return jid;
}

/** Mensagem escrita por um vendedor no app. */
export async function sendFromApp(businessId, text, who) {
  const lead = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!lead) throw new Error('Lead não encontrado.');
  const jid = await jidFor(lead);
  const waId = await sendText(jid, text, { typing: false });
  const msg = saveMessage(businessId, { direction: 'out', author: who || lead.owner || 'vendedor', text, waId });
  if (lead.status === 'novo') {
    db.prepare(`UPDATE businesses SET status = 'contatado', contacted_at = COALESCE(contacted_at, datetime('now')), owner = COALESCE(owner, ?), updated_at = datetime('now') WHERE id = ?`).run(who, businessId);
    logEvent(businessId, who, 'status', 'novo → contatado');
  }
  logEvent(businessId, who, 'whatsapp', null);
  emitLead(businessId);
  return msg;
}

export function setAi(businessId, enabled, who) {
  const lead = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  if (!lead) throw new Error('Lead não encontrado.');
  if (enabled && classifyPhone(lead.phone).kind !== 'mobile' && !lead.wa_jid) throw new Error('Este lead não tem celular cadastrado para WhatsApp.');
  db.prepare('UPDATE businesses SET ai_enabled = ?, ai_manual_off = ?, ai_state = NULL WHERE id = ?').run(enabled ? 1 : 0, enabled ? 0 : 1, businessId);
  logEvent(businessId, who, 'ia', enabled ? 'ligou a IA' : 'desligou a IA');
  if (enabled) schedule(businessId, 1500); // se o cliente já tinha escrito, responde agora
  else { clearTimeout(timers.get(businessId)); timers.delete(businessId); }
  emitLead(businessId);
}

export function listMessages(businessId) {
  return db.prepare('SELECT id, direction, author, text, at FROM messages WHERE business_id = ? ORDER BY id DESC LIMIT 200').all(businessId).reverse();
}

export function aiSummary() {
  return db.prepare('SELECT COUNT(*) n FROM businesses WHERE ai_enabled = 1').get().n;
}

/** Quando o WhatsApp (re)conecta, responde quem escreveu enquanto estava fora. */
function resumePending() {
  const rows = db.prepare(`
    SELECT b.id FROM businesses b
    WHERE b.ai_enabled = 1 AND b.wa_jid IS NOT NULL
      AND (SELECT direction FROM messages m WHERE m.business_id = b.id ORDER BY m.id DESC LIMIT 1) = 'in'`).all();
  rows.forEach((r, i) => schedule(r.id, 3000 + i * 4000));
}

export const _onIncoming = onIncoming; // para testes
setIncomingHandler((m) => { onIncoming(m).catch((e) => console.error('[whatsapp]', e)); });
bus.on('status', (s) => { if (s.status === 'open') resumePending(); });
