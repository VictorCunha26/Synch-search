import { cacheGet, cacheSet } from '../db.js';

const UA = 'SynchSearch/0.1 (ferramenta interna de prospeccao)';
const DAY = 86_400_000;

let lastNominatim = 0;
async function politeNominatim(url) {
  // Política do Nominatim: no máximo 1 requisição por segundo.
  const wait = Math.max(0, lastNominatim + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } });
  if (!res.ok) throw new Error(`Geocodificação falhou (HTTP ${res.status}).`);
  return res.json();
}

/** Converte "Bairro, Cidade, UF" em coordenadas. */
export async function geocode(city, neighborhood) {
  const q = [neighborhood, city, 'Brasil'].filter(Boolean).join(', ');
  const key = `geo2:${q.toLowerCase()}`;
  const hit = cacheGet(key, 90 * DAY);
  if (hit) return hit;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(q)}`;
  const data = await politeNominatim(url);
  if (!data.length) {
    throw new Error(`Não encontrei "${q}". Confira a grafia da cidade (ex.: "Campinas, SP").`);
  }
  const d = data[0];
  if (['state', 'country', 'region'].includes(d.addresstype)) {
    throw new Error(`"${q.replace(', Brasil', '')}" é um estado, não uma cidade. Informe a cidade, por exemplo "Campinas, SP".`);
  }
  const iso = d.address?.['ISO3166-2-lvl4'] || '';
  const out = {
    lat: Number(d.lat),
    lon: Number(d.lon),
    label: d.display_name,
    city: d.address?.city || d.address?.town || d.address?.municipality || d.address?.village || city,
    state: d.address?.state,
    uf: iso.startsWith('BR-') ? iso.slice(3) : null,
  };
  cacheSet(key, out);
  return out;
}

export function distanceMeters(a, b) {
  const R = 6371e3;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export { UA };
