// Conexão com o WhatsApp do vendedor (WhatsApp Web, pareado por QR code).
// A sessão fica salva em data/wa-auth, então reconecta sozinha quando o servidor reinicia.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, jidNormalizedUser, isLidUser } from 'baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { EventEmitter } from 'node:events';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUTH_DIR = process.env.SYNCH_WA_AUTH || resolve(root, 'data', 'wa-auth');
const logger = pino({ level: 'silent' });

/** Eventos: 'status' (estado da conexão) e 'message' (mensagem nova de/para um lead). */
export const bus = new EventEmitter();
bus.setMaxListeners(100);

let sock = null;
let stopped = true;
let retries = 0;
let qrCount = 0;
let onIncoming = () => {};
let state = { status: 'off', qr: null, me: null, error: null };

function set(patch) {
  state = { ...state, ...patch };
  bus.emit('status', waStatus());
}

export function waStatus() {
  return { status: state.status, qr: state.qr, me: state.me, error: state.error, paired: hasSession() };
}

/** Já pareado com um celular? (creds.json existe desde o primeiro QR, mas só ganha "me" depois da leitura.) */
export function hasSession() {
  const f = resolve(AUTH_DIR, 'creds.json');
  if (!existsSync(f)) return false;
  try { return Boolean(JSON.parse(readFileSync(f, 'utf8')).me?.id); } catch { return false; }
}

export function setIncomingHandler(fn) { onIncoming = fn; }

export async function connectWhatsApp() {
  if (sock && ['connecting', 'qr', 'open'].includes(state.status)) return waStatus();
  stopped = false;
  qrCount = 0;
  set({ status: 'connecting', error: null });
  await open();
  return waStatus();
}

async function open() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const version = await fetchLatestBaileysVersion().then((r) => r.version).catch(() => undefined);
  const s = makeWASocket({
    auth,
    version,
    logger,
    browser: Browsers.ubuntu('Synch Search'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
  });
  sock = s;
  s.ev.on('creds.update', saveCreds);

  s.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (s !== sock) return;
    if (qr) {
      qrCount += 1;
      // O WhatsApp troca o QR a cada ~20 s. Depois de ~2 min sem leitura, para de tentar.
      if (qrCount > 6) { stop('O QR code expirou. Clique em Conectar para gerar outro.'); return; }
      set({ status: 'qr', qr: await QRCode.toDataURL(qr, { margin: 1, width: 264 }) });
    }
    if (connection === 'open') {
      retries = 0;
      set({ status: 'open', qr: null, me: s.user?.id ? jidNormalizedUser(s.user.id) : null, error: null });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        rmSync(AUTH_DIR, { recursive: true, force: true });
        sock = null;
        stopped = true;
        set({ status: 'off', qr: null, me: null, error: 'O WhatsApp foi desconectado pelo celular. Conecte de novo para a IA voltar a responder.' });
        return;
      }
      if (stopped) return;
      // Queda de rede ou reinício pedido pelo WhatsApp: tenta de novo com espera crescente.
      const wait = Math.min(60_000, 2_000 * 2 ** retries++);
      set({ status: 'connecting', qr: null });
      setTimeout(() => { if (!stopped && s === sock) open().catch((e) => set({ status: 'off', error: e.message })); }, wait);
    }
  });

  s.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const m of messages) {
      try { handle(m); } catch (e) { console.error('[whatsapp] mensagem ignorada:', e.message); }
    }
  });
}

function stop(error = null) {
  stopped = true;
  const s = sock;
  sock = null;
  try { s?.end(undefined); } catch { /* já fechado */ }
  if (!hasSession()) rmSync(AUTH_DIR, { recursive: true, force: true }); // QR não lido: descarta a sessão incompleta
  set({ status: 'off', qr: null, error });
}

export async function disconnectWhatsApp({ logout = false } = {}) {
  if (logout && sock && state.status === 'open') { try { await sock.logout(); } catch { /* segue */ } }
  stop(null);
  if (logout) rmSync(AUTH_DIR, { recursive: true, force: true });
  set({ me: null });
  return waStatus();
}

function textOf(msg) {
  const m = msg.message || {};
  const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m;
  return inner.conversation
    || inner.extendedTextMessage?.text
    || inner.imageMessage?.caption && `[imagem] ${inner.imageMessage.caption}`
    || inner.videoMessage?.caption && `[vídeo] ${inner.videoMessage.caption}`
    || (inner.imageMessage && '[imagem]')
    || (inner.audioMessage && '[áudio]')
    || (inner.videoMessage && '[vídeo]')
    || (inner.documentMessage && '[documento]')
    || (inner.stickerMessage && '[figurinha]')
    || (inner.buttonsResponseMessage?.selectedDisplayText)
    || null;
}

function handle(m) {
  const key = m.key || {};
  const jid = key.remoteJid || '';
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
  const text = textOf(m);
  if (!text) return; // reações, confirmações de leitura etc.
  if (process.env.SYNCH_WA_DEBUG) console.log('[whatsapp] recebida', { jid, alt: key.remoteJidAlt, fromMe: key.fromMe, type: Object.keys(m.message || {}) });
  const ts = Number(m.messageTimestamp) * 1000 || Date.now();
  if (Date.now() - ts > 10 * 60_000) return; // só mensagens recentes, nunca histórico
  // Contas novas do WhatsApp usam um ID anônimo (@lid); o número real vem em remoteJidAlt.
  const alt = key.remoteJidAlt || null;
  const base = { id: key.id, fromMe: Boolean(key.fromMe), jid, text: text.slice(0, 4000), at: new Date(ts), pushName: m.pushName || null };
  if (state.me && jidNormalizedUser(jid) === state.me) return; // conversa consigo mesmo
  if (!isLidUser(jid)) return onIncoming({ ...base, pnJid: jid });
  if (alt && !isLidUser(alt)) return onIncoming({ ...base, pnJid: alt });
  // Sem o número na mensagem: pergunta ao mapa LID → telefone que o WhatsApp mantém.
  const map = sock?.signalRepository?.lidMapping;
  Promise.resolve(map?.getPNForLID?.(jid)).catch(() => null)
    .then((pn) => onIncoming({ ...base, pnJid: pn ? jidNormalizedUser(pn) : null }));
}

/** Descobre o JID certo de um número (resolve a questão do 9º dígito). */
export async function resolveJid(digits) {
  if (!sock || state.status !== 'open') throw new Error('WhatsApp não está conectado.');
  const tries = [digits];
  const local = digits.startsWith('55') ? digits.slice(2) : digits;
  if (local.length === 11 && local[2] === '9') tries.push(`55${local.slice(0, 2)}${local.slice(3)}`);
  for (const d of tries) {
    const [r] = await sock.onWhatsApp(d).catch(() => []);
    if (r?.exists) return r.jid;
  }
  return null;
}

/** Envia texto simulando digitação, para não parecer disparo automático. */
export async function sendText(jid, text, { typing = true } = {}) {
  if (!sock || state.status !== 'open') throw new Error('WhatsApp não está conectado.');
  if (typing) {
    try {
      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise((r) => setTimeout(r, Math.min(7000, 1500 + text.length * 35)));
      await sock.sendPresenceUpdate('paused', jid);
    } catch { /* presença é opcional */ }
  }
  const sent = await sock.sendMessage(jid, { text });
  return sent?.key?.id || null;
}

export async function markRead(jid, id) {
  try { await sock?.readMessages([{ remoteJid: jid, id, fromMe: false }]); } catch { /* opcional */ }
}
