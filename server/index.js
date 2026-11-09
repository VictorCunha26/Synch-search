import express from 'express';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { db, getSetting, setSetting } from './db.js';
import { NICHES, NICHE_BY_ID } from './niches.js';
import { startSearch, getJob, cancelSearch, rescoreBusiness, rescoreAll } from './jobs.js';
import { rowToLead, STATUSES, STATUS_IDS } from './leads.js';
import { buildApproach } from './approach.js';
import { auditWebsite } from './audit.js';
import { PRIOR, FEATURE_INFO, FEATURE_GROUPS, currentWeights, trainFromOutcomes, MIN_EXAMPLES } from './scoring.js';
import { testGoogleKey } from './sources/google.js';
import { rfbStatus, startRfbImport, cancelRfbImport, latestMonth, UFS } from './sources/rfb.js';

const app = express();
app.use(express.json({ limit: '200kb' }));
// Dados de leads mudam o tempo todo: nunca deixar o navegador servir resposta velha.
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const who = (req) => (req.get('x-seller') ? decodeURIComponent(req.get('x-seller')).slice(0, 60) : null);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ---------- meta / configurações ----------
function modelSummary() {
  const m = getSetting('model', null);
  const labeled = db.prepare(`SELECT status, COUNT(*) n FROM businesses WHERE status IN ('ganho','perdido') GROUP BY status`).all();
  const wins = labeled.find((r) => r.status === 'ganho')?.n || 0;
  const losses = labeled.find((r) => r.status === 'perdido')?.n || 0;
  return { trained: Boolean(m?.weights), n: m?.n || 0, trainedAt: m?.trainedAt || null, accuracy: m?.accuracy ?? null, wins, losses, minExamples: MIN_EXAMPLES };
}

app.get('/api/meta', (req, res) => {
  const sellers = db.prepare('SELECT id, name, capacity FROM sellers ORDER BY name').all();
  res.json({
    niches: NICHES.map(({ id, label, group, tier }) => ({ id, label, group, tier })),
    statuses: STATUSES,
    google: Boolean(getSetting('googleKey', '')),
    rfb: (() => { const st = rfbStatus(); return { total: st.total, ufs: st.meta?.ufs || [], month: st.meta?.month || null, running: st.running }; })(),
    company: getSetting('company', 'Synch'),
    sellers,
    model: modelSummary(),
  });
});

app.get('/api/settings', (req, res) => {
  const key = getSetting('googleKey', '');
  res.json({ googleKeyMasked: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : '', hasGoogleKey: Boolean(key), company: getSetting('company', 'Synch') });
});

app.put('/api/settings', async (req, res) => {
  const { googleKey, company } = req.body || {};
  if (typeof company === 'string' && company.trim()) setSetting('company', company.trim().slice(0, 60));
  if (typeof googleKey === 'string') {
    const k = googleKey.trim();
    if (k) {
      try { await testGoogleKey(k); } catch (e) { return bad(res, e.message); }
    }
    setSetting('googleKey', k);
  }
  res.json({ ok: true });
});

app.get('/api/sellers', (req, res) => res.json(db.prepare('SELECT id, name, capacity FROM sellers ORDER BY name').all()));
app.post('/api/sellers', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 60);
  const capacity = Math.max(1, Math.min(200, Number(req.body?.capacity) || 25));
  if (!name) return bad(res, 'Informe o nome do vendedor.');
  try {
    const row = db.prepare('INSERT INTO sellers(name, capacity) VALUES(?, ?) ON CONFLICT(name) DO UPDATE SET capacity=excluded.capacity RETURNING id, name, capacity').get(name, capacity);
    res.json(row);
  } catch (e) { bad(res, e.message); }
});
app.delete('/api/sellers/:id', (req, res) => { db.prepare('DELETE FROM sellers WHERE id = ?').run(Number(req.params.id)); res.json({ ok: true }); });

// ---------- base CNPJ (Receita Federal) ----------
let latestCache = null;
app.get('/api/rfb', async (req, res) => {
  const st = rfbStatus();
  if (!latestCache || Date.now() - latestCache.at > 6 * 3600_000) {
    try { latestCache = { at: Date.now(), month: (await latestMonth()).month }; } catch { latestCache = { at: Date.now() - 5.9 * 3600_000, month: null }; }
  }
  res.json({ ...st, latestMonth: latestCache.month, ufsAll: UFS });
});
app.post('/api/rfb/import', (req, res) => {
  const ufs = Array.isArray(req.body?.ufs) ? req.body.ufs : [];
  try { startRfbImport({ ufs }); res.json({ ok: true }); } catch (e) { bad(res, e.message); }
});
app.post('/api/rfb/cancel', (req, res) => { cancelRfbImport(); res.json({ ok: true }); });

// ---------- buscas ----------
app.post('/api/searches', (req, res) => {
  const { city, neighborhood, niches, radiusKm } = req.body || {};
  if (!city || String(city).trim().length < 2) return bad(res, 'Informe a cidade (ex.: Campinas, SP).');
  const list = (Array.isArray(niches) ? niches : []).filter((n) => NICHE_BY_ID[n]);
  if (!list.length) return bad(res, 'Escolha pelo menos um segmento.');
  if (list.length > 8) return bad(res, 'Escolha no máximo 8 segmentos por busca.');
  const r = Math.max(0.5, Math.min(25, Number(radiusKm) || 5));
  const id = startSearch({ city: String(city).trim(), neighborhood: neighborhood ? String(neighborhood).trim() : null, niches: list, radiusKm: r, createdBy: who(req) });
  res.json({ id });
});

app.get('/api/searches', (req, res) => {
  const rows = db.prepare('SELECT * FROM searches ORDER BY id DESC LIMIT 30').all();
  res.json(rows.map((s) => ({ ...s, niches: JSON.parse(s.niches), sources: JSON.parse(s.sources) })));
});

app.get('/api/searches/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM searches WHERE id = ?').get(Number(req.params.id));
  if (!s) return bad(res, 'Busca não encontrada.', 404);
  const job = getJob(s.id);
  res.json({ ...s, niches: JSON.parse(s.niches), sources: JSON.parse(s.sources), live: job?.state || null });
});

app.post('/api/searches/:id/cancel', (req, res) => res.json({ ok: cancelSearch(req.params.id) }));

app.get('/api/searches/:id/events', (req, res) => {
  const id = Number(req.params.id);
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  const job = getJob(id);
  if (!job) {
    const s = db.prepare('SELECT * FROM searches WHERE id = ?').get(id);
    send(s?.status === 'error' ? 'error' : 'done', { stage: s?.stage || 'done', done: true, message: s?.error || '' });
    return res.end();
  }
  send('progress', job.state);
  if (job.state.done) { send(job.state.stage === 'error' ? 'error' : 'done', job.state); return res.end(); }
  const onEvent = (e) => { send(e.type, e.data); if (e.type === 'done' || e.type === 'error') res.end(); };
  job.emitter.on('event', onEvent);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); job.emitter.off('event', onEvent); });
});

// ---------- leads ----------
function leadFilters(q) {
  const where = ['b.score IS NOT NULL'];
  const params = [];
  let from = 'businesses b';
  if (q.searchId) { from += ' JOIN search_results sr ON sr.business_id = b.id AND sr.search_id = ?'; params.push(Number(q.searchId)); }
  if (q.temperature) { const t = String(q.temperature).split(',').filter((x) => ['quente', 'morno', 'frio'].includes(x)); if (t.length) { where.push(`b.temperature IN (${t.map(() => '?').join(',')})`); params.push(...t); } }
  if (q.status) { const s = String(q.status).split(',').filter((x) => STATUS_IDS.includes(x)); if (s.length) { where.push(`b.status IN (${s.map(() => '?').join(',')})`); params.push(...s); } }
  if (q.niche) { const n = String(q.niche).split(',').filter((x) => NICHE_BY_ID[x]); if (n.length) { where.push(`b.niche IN (${n.map(() => '?').join(',')})`); params.push(...n); } }
  if (q.pain) { const p = String(q.pain).split(','); where.push(`json_extract(b.pain, '$.code') IN (${p.map(() => '?').join(',')})`); params.push(...p); }
  if (q.owner) { if (q.owner === '__none') where.push('b.owner IS NULL'); else { where.push('b.owner = ?'); params.push(String(q.owner)); } }
  if (q.hideChains !== '0') where.push('b.chain = 0');
  if (q.contactable === '1') where.push(`b.phone IS NOT NULL AND b.phone != ''`);
  if (q.q) { where.push('(b.name LIKE ? OR b.neighborhood LIKE ? OR b.address LIKE ?)'); const like = `%${String(q.q).slice(0, 80)}%`; params.push(like, like, like); }
  return { from, where: where.join(' AND '), params };
}

const SORTS = { score: 'b.score DESC, b.reviews DESC', reviews: 'b.reviews DESC NULLS LAST, b.score DESC', rating: 'b.rating DESC NULLS LAST, b.score DESC', name: 'b.name COLLATE NOCASE ASC', recent: 'b.updated_at DESC' };

app.get('/api/leads', (req, res) => {
  const { from, where, params } = leadFilters(req.query);
  const order = SORTS[req.query.sort] || SORTS.score;
  const limit = Math.min(1000, Number(req.query.limit) || 300);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const rows = db.prepare(`SELECT b.* FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const totals = db.prepare(`SELECT COUNT(*) total, SUM(json_extract(b.pain,'$.code') NOT IN ('site_ok')) needSite FROM ${from} WHERE ${where}`).get(...params);
  // Contagem por temperatura ignora o próprio filtro de temperatura (para o filtro mostrar quantos há em cada).
  const facet = leadFilters({ ...req.query, temperature: '' });
  const temps = db.prepare(`SELECT b.temperature t, COUNT(*) n FROM ${facet.from} WHERE ${facet.where} GROUP BY b.temperature`).all(...facet.params);
  for (const t of ['quente', 'morno', 'frio']) totals[t] = temps.find((x) => x.t === t)?.n || 0;
  totals.needSite = totals.needSite || 0;
  res.json({ leads: rows.map(rowToLead), totals });
});

app.get('/api/leads/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(Number(req.params.id));
  if (!row) return bad(res, 'Lead não encontrado.', 404);
  const lead = rowToLead(row);
  const events = db.prepare('SELECT who, type, detail, at FROM events WHERE business_id = ? ORDER BY at DESC, id DESC LIMIT 50').all(row.id);
  const approach = buildApproach({ ...row, audit: lead.audit }, { seller: who(req) || '', company: getSetting('company', 'Synch') });
  res.json({ ...lead, events, approach });
});

app.patch('/api/leads/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  if (!row) return bad(res, 'Lead não encontrado.', 404);
  const { status, owner, notes, nextActionAt, dealValue, event } = req.body || {};
  const me = who(req);
  const sets = [];
  const params = [];
  const log = [];
  if (status !== undefined) {
    if (!STATUS_IDS.includes(status)) return bad(res, 'Status inválido.');
    if (status !== row.status) {
      sets.push('status = ?'); params.push(status);
      log.push(['status', `${row.status} → ${status}`]);
      if (status === 'contatado' && !row.contacted_at) sets.push(`contacted_at = datetime('now')`);
      if (status === 'ganho' || status === 'perdido') sets.push(`closed_at = datetime('now')`);
      if (!row.owner && !owner && me) { sets.push('owner = ?'); params.push(me); }
    }
  }
  if (owner !== undefined) { sets.push('owner = ?'); params.push(owner || null); log.push(['owner', owner ? `atribuído a ${owner}` : 'sem responsável']); }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(String(notes).slice(0, 5000)); }
  if (nextActionAt !== undefined) { sets.push('next_action_at = ?'); params.push(nextActionAt || null); if (nextActionAt) log.push(['followup', `retorno em ${nextActionAt}`]); }
  if (dealValue !== undefined) { sets.push('deal_value = ?'); params.push(dealValue === null || dealValue === '' ? null : Number(dealValue)); }
  if (event && typeof event === 'string') log.push([event.slice(0, 40), null]);
  if (sets.length) db.prepare(`UPDATE businesses SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...params, id);
  const ins = db.prepare('INSERT INTO events(business_id, who, type, detail) VALUES(?,?,?,?)');
  for (const [type, detail] of log) ins.run(id, me, type, detail);

  let retrained = null;
  const touchedOutcome = status !== undefined && status !== row.status && ['ganho', 'perdido'].some((s) => s === status || s === row.status);
  if (touchedOutcome) {
    const rows = db.prepare(`SELECT features, status FROM businesses WHERE status IN ('ganho','perdido')`).all();
    retrained = trainFromOutcomes(rows);
    if (retrained.trained) rescoreAll();
  }
  res.json({ lead: rowToLead(db.prepare('SELECT * FROM businesses WHERE id = ?').get(id)), retrained });
});

app.post('/api/leads/:id/reaudit', async (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT website FROM businesses WHERE id = ?').get(id);
  if (!row) return bad(res, 'Lead não encontrado.', 404);
  const audit = await auditWebsite(row.website, { force: true });
  db.prepare(`UPDATE businesses SET audit=?, audited_at=datetime('now') WHERE id=?`).run(JSON.stringify(audit), id);
  rescoreBusiness(id);
  res.json(rowToLead(db.prepare('SELECT * FROM businesses WHERE id = ?').get(id)));
});

app.patch('/api/leads/:id/website', async (req, res) => {
  const id = Number(req.params.id);
  const website = String(req.body?.website || '').trim() || null;
  db.prepare(`UPDATE businesses SET website=?, audit=NULL, audited_at=NULL WHERE id=?`).run(website, id);
  const audit = await auditWebsite(website, { force: true });
  db.prepare(`UPDATE businesses SET audit=?, audited_at=datetime('now') WHERE id=?`).run(JSON.stringify(audit), id);
  rescoreBusiness(id);
  res.json(rowToLead(db.prepare('SELECT * FROM businesses WHERE id = ?').get(id)));
});

// ---------- fila de hoje ----------
app.get('/api/queue', (req, res) => {
  const owner = req.query.owner ? String(req.query.owner) : who(req);
  const seller = owner ? db.prepare('SELECT capacity FROM sellers WHERE name = ?').get(owner) : null;
  const capacity = seller?.capacity || 25;
  const contactedToday = owner ? db.prepare(`SELECT COUNT(DISTINCT business_id) n FROM events WHERE who = ? AND type IN ('whatsapp','ligacao','email','status') AND date(at, 'localtime') = date('now', 'localtime')`).get(owner).n : 0;
  const followUps = db.prepare(`SELECT * FROM businesses WHERE next_action_at IS NOT NULL AND date(next_action_at) <= date('now','localtime')
      AND status NOT IN ('ganho','perdido','descartado') ${owner ? 'AND owner = ?' : ''} ORDER BY next_action_at ASC, score DESC LIMIT 50`).all(...(owner ? [owner] : []));
  const remaining = Math.max(0, capacity - contactedToday - followUps.length);
  const fresh = db.prepare(`SELECT * FROM businesses WHERE status = 'novo' AND chain = 0 AND temperature IN ('quente','morno')
      AND phone IS NOT NULL AND phone != '' AND (owner IS NULL ${owner ? 'OR owner = ?' : ''})
      ORDER BY (owner IS NOT NULL) DESC, score DESC LIMIT ?`).all(...(owner ? [owner] : []), remaining + 200);
  res.json({
    owner, capacity, contactedToday,
    followUps: followUps.map(rowToLead),
    fresh: fresh.slice(0, remaining).map(rowToLead),
    overflow: Math.max(0, fresh.length - remaining),
  });
});

// ---------- pipeline ----------
app.get('/api/pipeline', (req, res) => {
  const owner = req.query.owner && req.query.owner !== '__all' ? String(req.query.owner) : null;
  const rows = db.prepare(`SELECT * FROM businesses WHERE status NOT IN ('novo','descartado') ${owner ? 'AND owner = ?' : ''} ORDER BY updated_at DESC LIMIT 600`).all(...(owner ? [owner] : []));
  const columns = STATUSES.filter((s) => !['novo', 'descartado'].includes(s.id)).map((s) => ({ ...s, leads: rows.filter((r) => r.status === s.id).map(rowToLead) }));
  const won = rows.filter((r) => r.status === 'ganho');
  res.json({ columns, wonValue: won.reduce((s, r) => s + (r.deal_value || 0), 0) });
});

// ---------- modelo ----------
app.get('/api/model', (req, res) => {
  const w = currentWeights();
  const buckets = db.prepare(`SELECT temperature, COUNT(*) total, SUM(status='ganho') ganhos, SUM(status='perdido') perdidos,
      SUM(status NOT IN ('novo','descartado')) trabalhados FROM businesses WHERE score IS NOT NULL GROUP BY temperature`).all();
  res.json({
    summary: modelSummary(),
    groups: Object.entries(FEATURE_GROUPS).map(([group, keys]) => ({ group, features: keys.map((k) => ({ key: k, label: FEATURE_INFO[k], prior: PRIOR[k], weight: w[k] })) })),
    bias: { prior: PRIOR.bias, weight: w.bias },
    buckets,
  });
});

app.post('/api/model/retrain', (req, res) => {
  const rows = db.prepare(`SELECT features, status FROM businesses WHERE status IN ('ganho','perdido')`).all();
  const r = trainFromOutcomes(rows);
  if (r.trained) rescoreAll();
  res.json(r);
});

app.post('/api/model/reset', (req, res) => {
  db.prepare(`DELETE FROM settings WHERE key = 'model'`).run();
  rescoreAll();
  res.json({ ok: true });
});

// ---------- exportação ----------
app.get('/api/export.csv', (req, res) => {
  const { from, where, params } = leadFilters(req.query);
  const rows = db.prepare(`SELECT b.* FROM ${from} WHERE ${where} ORDER BY b.score DESC LIMIT 5000`).all(...params);
  const cols = ['Nota', 'Temperatura', 'Dor', 'Nome', 'Segmento', 'Bairro', 'Endereço', 'Telefone', 'Tipo de telefone', 'Site', 'Nota Google', 'Avaliações', 'Status', 'Responsável', 'Google Maps'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(';')];
  for (const r of rows) {
    const l = rowToLead(r);
    lines.push([l.score, l.temperature, l.pain?.label, l.name, l.nicheLabel, l.neighborhood, l.address, l.phone, l.phoneKind, l.website, l.rating, l.reviews, l.status, l.owner, l.mapsUrl].map(esc).join(';'));
  }
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="synch-leads-${new Date().toISOString().slice(0, 10)}.csv"` });
  res.send('﻿' + lines.join('\n'));
});

// ---------- front-end compilado ----------
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(resolve(dist, 'index.html')));
}

app.use((err, req, res, _next) => { console.error(err); res.status(500).json({ error: 'Erro interno. Tente de novo.' }); });

const PORT = Number(process.env.SYNCH_PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Synch Search API em http://localhost:${PORT}${lan ? `  (rede local: http://${lan}:${PORT})` : ''}`);
});
