import { cacheGet, cacheSet } from '../db.js';

const HOUR = 3_600_000;
const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.shortFormattedAddress',
  'places.addressComponents', 'places.location', 'places.types', 'places.primaryType',
  'places.primaryTypeDisplayName', 'places.nationalPhoneNumber', 'places.internationalPhoneNumber',
  'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.businessStatus',
  'places.googleMapsUri', 'places.regularOpeningHours.weekdayDescriptions', 'places.priceLevel',
  'places.photos.name', 'nextPageToken',
].join(',');

const PRICE = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

function component(p, type) {
  return p.addressComponents?.find((c) => c.types?.includes(type))?.longText || null;
}

function normalize(p, nicheId) {
  return {
    source: 'google',
    google_id: p.id,
    name: p.displayName?.text,
    niche: nicheId,
    category: p.primaryTypeDisplayName?.text || p.primaryType || null,
    types: p.types || [],
    address: p.shortFormattedAddress || p.formattedAddress || null,
    neighborhood: component(p, 'sublocality_level_1') || component(p, 'sublocality') || null,
    city: component(p, 'administrative_area_level_2') || null,
    lat: p.location?.latitude,
    lon: p.location?.longitude,
    phone: p.internationalPhoneNumber || p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
    photos: p.photos?.length ?? 0,
    has_hours: p.regularOpeningHours?.weekdayDescriptions?.length ? 1 : 0,
    price_level: p.priceLevel ? PRICE[p.priceLevel] ?? null : null,
    business_status: p.businessStatus || null,
    maps_url: p.googleMapsUri || null,
  };
}

async function textSearch(apiKey, body, signal) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(
      res.status === 403 || res.status === 400
        ? `Google Places recusou a chave: ${msg}. Confira se a "Places API (New)" está ativada no projeto do Google Cloud.`
        : `Google Places falhou: ${msg}`,
    );
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Busca um termo no Google Places (até 3 páginas = 60 resultados).
 * Cada página é uma requisição cobrada pelo Google (há cota gratuita mensal).
 */
export async function searchGoogle(apiKey, { term, cityLabel, center, radiusM, nicheId, maxPages = 3 }, signal) {
  const textQuery = `${term} em ${cityLabel}`;
  const key = `g:${textQuery}:${center.lat.toFixed(3)},${center.lon.toFixed(3)}:${Math.round(radiusM)}:${maxPages}`;
  const hit = cacheGet(key, 24 * HOUR);
  if (hit) return hit;

  const out = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const body = {
      textQuery,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize: 20,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lon }, radius: Math.min(50000, radiusM) } },
      ...(pageToken ? { pageToken } : {}),
    };
    const json = await textSearch(apiKey, body, signal);
    for (const p of json.places || []) {
      if (p.businessStatus === 'CLOSED_PERMANENTLY') continue;
      out.push(normalize(p, nicheId));
    }
    pageToken = json.nextPageToken;
    if (!pageToken) break;
    // O token de próxima página leva um instante para ficar válido.
    await new Promise((r) => setTimeout(r, 1500));
  }
  cacheSet(key, out);
  return out;
}

/** Testa a chave com uma busca mínima. */
export async function testGoogleKey(apiKey) {
  await textSearch(apiKey, { textQuery: 'padaria em Campinas', pageSize: 1, languageCode: 'pt-BR' });
  return true;
}
