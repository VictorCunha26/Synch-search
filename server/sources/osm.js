import { cacheGet, cacheSet } from '../db.js';
import { NICHE_BY_ID } from '../niches.js';
import { UA } from './geo.js';

// SYNCH_OSM_ENDPOINTS permite apontar para um Overpass próprio (lista separada por vírgula).
const ENDPOINTS = process.env.SYNCH_OSM_ENDPOINTS
  ? process.env.SYNCH_OSM_ENDPOINTS.split(',').map((x) => x.trim()).filter(Boolean)
  : [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
const HOUR = 3_600_000;

export function buildQuery(nicheIds, center, radiusM) {
  // Caixa geográfica (bbox) é bem mais leve para o Overpass do que "around";
  // o recorte exato pelo raio é feito depois, no servidor do Synch.
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const bbox = [center.lat - dLat, center.lon - dLon, center.lat + dLat, center.lon + dLon].map((x) => x.toFixed(5)).join(',');
  const lines = [];
  for (const id of nicheIds) {
    const n = NICHE_BY_ID[id];
    if (!n) continue;
    for (const f of n.osm) lines.push(`  nwr[${f}]["name"];`);
  }
  return `[out:json][timeout:90][bbox:${bbox}];\n(\n${lines.join('\n')}\n);\nout center tags 2000;`;
}

/** Descobre a qual nicho um elemento do OSM pertence, testando os filtros do catálogo. */
function matchNiche(tags, nicheIds) {
  for (const id of nicheIds) {
    const n = NICHE_BY_ID[id];
    for (const f of n.osm) {
      const clauses = [...f.matchAll(/"([^"]+)"(=|~)"([^"]+)"(,i)?/g)];
      const ok = clauses.every(([, k, op, v, ci]) => {
        const val = tags[k];
        if (val == null) return false;
        if (op === '=') return val === v;
        return new RegExp(v, ci ? 'i' : '').test(val);
      });
      if (ok) return id;
    }
  }
  return nicheIds[0];
}

export function normalize(el, nicheIds) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
  const website = t.website || t['contact:website'] || t.url || null;
  const instagram = t['contact:instagram'] || t.instagram || null;
  return {
    source: 'osm',
    osm_id: `${el.type}/${el.id}`,
    name: t.name,
    niche: matchNiche(t, nicheIds),
    category: t.amenity || t.shop || t.office || t.healthcare || t.craft || t.leisure || t.tourism || null,
    address: street || null,
    neighborhood: t['addr:suburb'] || t['addr:neighbourhood'] || t['addr:district'] || null,
    city: t['addr:city'] || null,
    lat, lon,
    phone: t.phone || t['contact:phone'] || t['contact:mobile'] || t.mobile || t['contact:whatsapp'] || null,
    website,
    instagram,
    has_hours: t.opening_hours ? 1 : 0,
    chain: t.brand || t['brand:wikidata'] ? 1 : 0,
    brand: t.brand || null,
  };
}

export async function searchOSM(nicheIds, center, radiusM, signal, onRetry, { quick = false } = {}) {
  const query = buildQuery(nicheIds, center, radiusM);
  const key = `osm:${query}`;
  const hit = cacheGet(key, 12 * HOUR);
  if (hit) return hit;

  // Os servidores públicos do Overpass vivem lotados (HTTP 429/502/504).
  // Cada tentativa consulta os espelhos em paralelo e fica com a primeira
  // resposta boa; entre tentativas, espera crescente.
  let lastErr;
  // Modo rápido (quando a base CNPJ já cobre a cidade): uma tentativa curta, o OSM é só complemento.
  const delays = quick ? [0] : [0, 8000];
  const timeoutMs = quick ? 25000 : 95000;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) {
      onRetry?.(attempt, delays[attempt]);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    if (signal?.aborted) throw new Error('Busca cancelada.');
    const race = new AbortController();
    const linked = AbortSignal.any([race.signal, AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
    try {
      const json = await Promise.any(ENDPOINTS.map(async (url) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: `data=${encodeURIComponent(query)}`,
          signal: linked,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!Array.isArray(body.elements)) throw new Error('resposta inválida');
        return body;
      }));
      race.abort(); // cancela os espelhos que ainda não responderam
      const out = json.elements.filter((e) => e.tags?.name).map((e) => normalize(e, nicheIds));
      cacheSet(key, out);
      return out;
    } catch (e) {
      race.abort();
      if (signal?.aborted) throw new Error('Busca cancelada.');
      const first = e instanceof AggregateError ? e.errors[0] : e;
      const m = String(first?.message || '');
      lastErr = new Error(first?.name === 'TimeoutError' || first?.name === 'AbortError' ? `sem resposta em ${timeoutMs / 1000} s`
        : /HTTP (429|502|503|504)/.test(m) ? 'servidores lotados' : /HTTP/.test(m) ? `erro ${m.replace('HTTP ', '')}` : 'sem conexão');
    }
  }
  throw new Error(`O OpenStreetMap não respondeu (${lastErr?.message || 'sem resposta'}). Tente de novo em alguns minutos ou conecte o Google Places em Configurações.`);
}
