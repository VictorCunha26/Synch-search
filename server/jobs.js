// Executor de buscas: geocodifica, coleta (OSM + Google), deduplica, audita
// os sites, calcula concorrência e pontua. Emite progresso por SSE.
import { EventEmitter } from 'node:events';
import { db, getSetting, tx } from './db.js';
import { geocode, distanceMeters } from './sources/geo.js';
import { searchOSM } from './sources/osm.js';
import { searchGoogle } from './sources/google.js';
import { auditWebsite } from './audit.js';
import { scoreBusiness, isChainName } from './scoring.js';
import { NICHE_BY_ID } from './niches.js';
import { rfbCandidates, rfbHasData } from './sources/rfb.js';
import { rowToLead } from './leads.js';

const running = new Map(); // searchId -> { emitter, abort, state }

export function getJob(id) { return running.get(Number(id)); }

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const last8 = (p) => (p || '').replace(/\D/g, '').slice(-8);
const hasXY = (x) => x.lat != null && x.lon != null;

function mergeCandidates(list) {
  const out = [];
  const byKey = new Map(); // índices para não ficar O(n²) com milhares de CNPJs
  const keyOf = (c) => [c.cnpj && `c:${c.cnpj}`, c.google_id && `g:${c.google_id}`, c.osm_id && `o:${c.osm_id}`, last8(c.phone).length === 8 && `p:${last8(c.phone)}`, `n:${norm(c.name)}|${norm(c.city)}`].filter(Boolean);
  for (const c of list) {
    if (!c.name) continue;
    let dup = null;
    for (const k of keyOf(c)) {
      const o = byKey.get(k);
      if (!o) continue;
      // Nome igual só junta se estiver perto (ou se um dos dois não tiver coordenada).
      if (k.startsWith('n:') && hasXY(o) && hasXY(c) && distanceMeters(o, c) > 250) continue;
      if (k.startsWith('p:') && hasXY(o) && hasXY(c) && distanceMeters(o, c) > 400) continue;
      dup = o; break;
    }
    if (!dup) {
      const item = { ...c, sources: [c.source] };
      out.push(item);
      for (const k of keyOf(item)) if (!byKey.has(k)) byKey.set(k, item);
      continue;
    }
    // Google tem prioridade em reputação e site; a Receita em CNPJ, e-mail e dados cadastrais.
    for (const [k, v] of Object.entries(c)) {
      if (v == null || v === '' || k === 'source') continue;
      const googleWins = c.source === 'google' && ['rating', 'reviews', 'photos', 'phone', 'website', 'business_status', 'maps_url', 'address', 'lat', 'lon'].includes(k);
      if (dup[k] == null || dup[k] === '' || googleWins) dup[k] = v;
    }
    if (c.source === 'google' && c.website) dup.website_derived = 0;
    if (!dup.sources.includes(c.source)) dup.sources.push(c.source);
    for (const k of keyOf(dup)) if (!byKey.has(k)) byKey.set(k, dup);
  }
  return out;
}

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  });
  await Promise.all(workers);
}

const FIELDS = ['google_id', 'osm_id', 'cnpj', 'name', 'niche', 'category', 'address', 'neighborhood', 'city', 'lat', 'lon', 'phone', 'website',
  'instagram', 'email', 'rating', 'reviews', 'photos', 'has_hours', 'price_level', 'business_status', 'maps_url', 'chain', 'sources',
  'opened_at', 'porte', 'capital', 'mei', 'natureza', 'phone_shared', 'website_derived'];
const insertBiz = db.prepare(`INSERT INTO businesses (${FIELDS.join(', ')}) VALUES (${FIELDS.map((f) => `:${f}`).join(', ')}) RETURNING id`);
const updateBiz = db.prepare(`UPDATE businesses SET ${FIELDS.map((f) => `${f}=:${f}`).join(', ')}, updated_at=datetime('now') WHERE id=:id`);
const clearAudit = db.prepare('UPDATE businesses SET audit=NULL, audited_at=NULL WHERE id=?');
const linkSearch = db.prepare('INSERT OR IGNORE INTO search_results(search_id, business_id) VALUES(?, ?)');
const byGoogle = db.prepare('SELECT * FROM businesses WHERE google_id = ?');
const byOsm = db.prepare('SELECT * FROM businesses WHERE osm_id = ?');
const byCnpj = db.prepare('SELECT * FROM businesses WHERE cnpj = ?');
const nearBox = db.prepare('SELECT * FROM businesses WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?');

function findExisting(c) {
  if (c.cnpj) { const r = byCnpj.get(c.cnpj); if (r) return r; }
  if (c.google_id) { const r = byGoogle.get(c.google_id); if (r) return r; }
  if (c.osm_id) { const r = byOsm.get(c.osm_id); if (r) return r; }
  if (!hasXY(c)) return null;
  return nearBox.all(c.lat - 0.003, c.lat + 0.003, c.lon - 0.003, c.lon + 0.003).find((r) => norm(r.name) === norm(c.name)) || null;
}

function saveCandidate(c, searchId) {
  const existing = findExisting(c);
  const params = Object.fromEntries(FIELDS.map((f) => [f, c[f] ?? null]));
  params.has_hours = c.has_hours ?? 0;
  params.chain = c.chain ? 1 : 0;
  params.sources = JSON.stringify(c.sources || [c.source].filter(Boolean));
  let id;
  if (existing) {
    id = existing.id;
    const merged = { ...params };
    for (const k of FIELDS) if (merged[k] == null && existing[k] != null) merged[k] = existing[k];
    merged.sources = JSON.stringify([...new Set([...JSON.parse(existing.sources || '[]'), ...(c.sources || [])])]);
    updateBiz.run({ ...merged, id });
    // Se o site mudou, a auditoria antiga não vale mais.
    if ((existing.website || null) !== (merged.website || null)) clearAudit.run(id);
  } else {
    id = insertBiz.get(params).id;
  }
  linkSearch.run(searchId, id);
  return id;
}

export function rescoreBusiness(id) {
  const row = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  if (!row) return null;
  const b = { ...row, audit: row.audit ? JSON.parse(row.audit) : null, sources: JSON.parse(row.sources || '[]') };
  const s = scoreBusiness(b);
  db.prepare(`UPDATE businesses SET features=?, score=?, probability=?, temperature=?, pain=?, explanation=? WHERE id=?`)
    .run(JSON.stringify(s.features), s.score, s.probability, s.temperature, JSON.stringify(s.pain), JSON.stringify({ base: s.base, parts: s.explanation }), id);
  return s;
}

export function rescoreAll() {
  const ids = db.prepare('SELECT id FROM businesses').all().map((r) => r.id);
  tx(() => { for (const id of ids) rescoreBusiness(id); });
  return ids.length;
}

/** Fração de concorrentes do mesmo nicho, num raio de 2 km, com site funcionando. */
function computeCompetitorShare(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 900) {
    const chunk = ids.slice(i, i + 900);
    rows.push(...db.prepare(`SELECT id, niche, lat, lon, neighborhood, audit FROM businesses WHERE id IN (${chunk.map(() => '?').join(',')})`).all(...chunk));
  }
  const parsed = rows.map((r) => ({ ...r, kind: r.audit ? JSON.parse(r.audit).kind : null, hood: norm(r.neighborhood) }));
  const upd = db.prepare('UPDATE businesses SET competitor_share = ? WHERE id = ?');
  // Sem coordenada (base CNPJ), "perto" = mesmo bairro.
  const groups = new Map();
  for (const p of parsed) { const k = `${p.niche}|${p.hood}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  tx(() => {
    for (const r of parsed) {
      const near = hasXY(r)
        ? parsed.filter((p) => p.niche === r.niche && ((hasXY(p) && distanceMeters(p, r) < 2000) || (!hasXY(p) && r.hood && p.hood === r.hood)))
        : (r.hood ? groups.get(`${r.niche}|${r.hood}`) : []);
      const peers = (near || []).filter((p) => p.id !== r.id);
      const share = peers.length >= 3 ? peers.filter((p) => p.kind === 'ok' || p.kind === 'weak').length / peers.length : 0;
      upd.run(share, r.id);
    }
  });
}

export function startSearch({ city, neighborhood, niches, radiusKm, createdBy }) {
  const apiKey = getSetting('googleKey', '');
  const hasRfb = rfbHasData();
  const sources = [...(hasRfb ? ['rfb'] : []), 'osm', ...(apiKey ? ['google'] : [])];
  const info = db.prepare('INSERT INTO searches(city, neighborhood, niches, radius_km, sources, status, stage, created_by) VALUES(?,?,?,?,?,?,?,?) RETURNING id')
    .get(city, neighborhood || null, JSON.stringify(niches), radiusKm, JSON.stringify(sources), 'running', 'geocode', createdBy || null);
  const id = info.id;
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const abort = new AbortController();
  const state = { id, stage: 'geocode', message: 'Localizando a região…', total: 0, audited: 0, found: 0, warnings: [], notes: [], done: false };
  running.set(id, { emitter, abort, state });

  const emit = (type, data) => { Object.assign(state, data || {}); emitter.emit('event', { type, data: { ...state, ...(data || {}) } }); };
  const setStage = (stage, message) => { db.prepare('UPDATE searches SET stage=? WHERE id=?').run(stage, id); emit('progress', { stage, message }); };

  (async () => {
    try {
      const geo = await geocode(city, neighborhood);
      db.prepare('UPDATE searches SET lat=?, lon=? WHERE id=?').run(geo.lat, geo.lon, id);
      emit('progress', { center: { lat: geo.lat, lon: geo.lon }, place: geo.label });
      const radiusM = radiusKm * 1000;
      const cityLabel = [neighborhood, city].filter(Boolean).join(', ');

      const candidates = [];
      // O OpenStreetMap roda em paralelo enquanto a base local é consultada.
      const osmPromise = searchOSM(niches, geo, radiusM, abort.signal,
        (n, ms) => emit('progress', { message: `OpenStreetMap sem resposta, tentando de novo em ${Math.round(ms / 1000)} s (tentativa ${n + 1})…` }),
        { quick: hasRfb });
      osmPromise.catch(() => {});
      if (hasRfb) {
        setStage('collect', 'Buscando na base nacional de CNPJ (Receita Federal)…');
        if (!geo.uf) state.warnings.push('Não consegui identificar o estado dessa cidade; a base CNPJ ficou de fora.');
        else {
          const r = rfbCandidates({ uf: geo.uf, city: geo.city, niches, neighborhood });
          candidates.push(...r.candidates);
          if (!r.municipio) state.warnings.push(`A cidade "${geo.city}" (${geo.uf}) não está na base CNPJ importada. Importe a UF ${geo.uf} em Configurações.`);
          else if (r.total > r.candidates.length) state.notes.push(`${r.total.toLocaleString('pt-BR')} empresas na cidade; trouxe as ${r.candidates.length.toLocaleString('pt-BR')} com telefone e mais recentes. Informe um bairro para refinar.`);
          emit('progress', { found: candidates.length, message: `Base CNPJ: ${r.candidates.length.toLocaleString('pt-BR')} empresas ativas em ${r.municipio || geo.city}.` });
        }
      }

      setStage('collect', 'Buscando estabelecimentos no OpenStreetMap…');
      try {
        candidates.push(...await osmPromise);
      } catch (e) {
        if (abort.signal.aborted) throw e;
        // Com a base CNPJ trazendo empresas, o OSM fora do ar não é um problema para o usuário.
        if (!candidates.length) state.warnings.push(e.message);
      }
      emit('progress', { found: candidates.length });

      if (apiKey) {
        const terms = niches.flatMap((nid) => (NICHE_BY_ID[nid]?.google || []).map((term) => ({ nid, term })));
        let i = 0;
        for (const { nid, term } of terms) {
          i++;
          setStage('collect', `Google: "${term}" (${i}/${terms.length})…`);
          try {
            candidates.push(...await searchGoogle(apiKey, { term, cityLabel, center: geo, radiusM, nicheId: nid }, abort.signal));
          } catch (e) {
            if (abort.signal.aborted) throw e;
            state.warnings.push(e.message);
            if (e.status === 400 || e.status === 403) break; // chave inválida: não adianta insistir
          }
          emit('progress', { found: candidates.length });
        }
      }

      // Mantém só o que está dentro do raio pedido (o Google às vezes traz resultados de fora).
      // A base CNPJ não tem coordenada: vale a cidade inteira (ou o bairro, se informado).
      const inside = candidates.filter((c) => (c.lat == null ? c.source === 'rfb' : distanceMeters(geo, c) <= radiusM * 1.15));
      const merged = mergeCandidates(inside);
      // Rede: nome na lista de franquias, marca no OSM, ou 3+ unidades com o mesmo nome.
      const counts = {};
      for (const c of merged) counts[norm(c.name)] = (counts[norm(c.name)] || 0) + 1;
      for (const c of merged) c.chain = c.chain || isChainName(c.name, c.brand) || counts[norm(c.name)] >= 3;

      const ids = tx(() => merged.map((c) => saveCandidate(c, id)));
      db.prepare('UPDATE searches SET found=? WHERE id=?').run(ids.length, id);
      emit('progress', { total: ids.length, found: ids.length });

      // Quem não tem site informado não precisa de visita: a auditoria é instantânea.
      const rows = [];
      for (let i = 0; i < ids.length; i += 900) {
        const chunk = ids.slice(i, i + 900);
        rows.push(...db.prepare(`SELECT id, website, website_derived, sources, audit, audited_at FROM businesses WHERE id IN (${chunk.map(() => '?').join(',')})`).all(...chunk));
      }
      const fresh = (r) => r.audit && r.audited_at && Date.now() - Date.parse(r.audited_at + 'Z') < 14 * 86_400_000;
      const setAudit = db.prepare(`UPDATE businesses SET audit=?, audited_at=datetime('now') WHERE id=?`);
      tx(() => {
        for (const r of rows) {
          if (r.website || fresh(r)) continue;
          setAudit.run(JSON.stringify({ kind: 'none', confirmed: JSON.parse(r.sources || '[]').includes('google'), issues: [], checkedAt: new Date().toISOString() }), r.id);
          rescoreBusiness(r.id);
        }
      });
      // Sites para visitar: no máximo AUDIT_BUDGET por busca, começando pelos de maior nota prévia.
      const AUDIT_BUDGET = 400;
      const withSite = rows.filter((r) => r.website && !fresh(r));
      for (const r of withSite) rescoreBusiness(r.id);
      const order = new Map(db.prepare(`SELECT id, score FROM businesses WHERE id IN (${withSite.slice(0, 900).map(() => '?').join(',') || 'NULL'})`).all(...withSite.slice(0, 900).map((r) => r.id)).map((x) => [x.id, x.score]));
      withSite.sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
      const toAudit = withSite.slice(0, AUDIT_BUDGET);
      const skipped = withSite.slice(AUDIT_BUDGET);
      if (skipped.length) {
        tx(() => { for (const r of skipped) { setAudit.run(JSON.stringify({ kind: 'unchecked', url: r.website, issues: ['Site ainda não verificado (limite de verificações por busca). Abra o lead e clique em verificar.'] }), r.id); rescoreBusiness(r.id); } });
      }
      setStage('audit', `Visitando ${toAudit.length} sites…`);
      emit('progress', { total: toAudit.length, audited: 0 });
      let audited = 0;
      await pool(toAudit, 20, async (r) => {
        if (abort.signal.aborted) return;
        const audit = await auditWebsite(r.website, { derived: Boolean(r.website_derived) }).catch((e) => ({ kind: 'broken', url: r.website, issues: [`Não consegui verificar: ${e.message}`] }));
        setAudit.run(JSON.stringify(audit), r.id);
        audited++;
        rescoreBusiness(r.id);
        if (toAudit.length <= 250) emitter.emit('event', { type: 'lead', data: rowToLead(db.prepare('SELECT * FROM businesses WHERE id=?').get(r.id)) });
        if (audited % 5 === 0 || audited === toAudit.length) emit('progress', { audited, message: `Visitando sites (${audited}/${toAudit.length})…` });
      });
      if (abort.signal.aborted) throw new Error('Busca cancelada.');

      setStage('score', 'Comparando com a concorrência e pontuando…');
      if (ids.length) {
        computeCompetitorShare(ids);
        tx(() => { for (const bid of ids) rescoreBusiness(bid); });
      }
      db.prepare(`UPDATE searches SET status='done', stage='done', finished_at=datetime('now'), error=? WHERE id=?`)
        .run(state.warnings.length ? state.warnings.join(' | ') : null, id);
      emit('done', { stage: 'done', done: true, message: ids.length ? `${ids.length.toLocaleString('pt-BR')} estabelecimentos pontuados.` : state.warnings.length ? 'A fonte de dados não respondeu. Nada foi encontrado desta vez.' : 'Nenhum estabelecimento encontrado nesse raio.' });
    } catch (e) {
      db.prepare(`UPDATE searches SET status='error', stage='error', error=?, finished_at=datetime('now') WHERE id=?`).run(e.message, id);
      emit('error', { stage: 'error', done: true, message: e.message });
    } finally {
      setTimeout(() => running.delete(id), 5 * 60_000);
    }
  })();

  return id;
}

export function cancelSearch(id) {
  const job = running.get(Number(id));
  if (job && !job.state.done) job.abort.abort();
  return Boolean(job);
}
