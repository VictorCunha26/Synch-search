import { NICHE_BY_ID } from './niches.js';
import { classifyPhone } from './scoring.js';

const parse = (s, fb) => { if (s == null) return fb; try { return JSON.parse(s); } catch { return fb; } };

export const STATUSES = [
  { id: 'novo', label: 'Novo' },
  { id: 'contatado', label: 'Contatado' },
  { id: 'respondeu', label: 'Respondeu' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'ganho', label: 'Ganho' },
  { id: 'perdido', label: 'Perdido' },
  { id: 'descartado', label: 'Descartado' },
];
export const STATUS_IDS = STATUSES.map((s) => s.id);

/** Linha do banco -> objeto que a interface consome. */
export function rowToLead(r) {
  if (!r) return null;
  const audit = parse(r.audit, null);
  const phone = classifyPhone(r.phone);
  return {
    id: r.id,
    name: r.name,
    niche: r.niche,
    nicheLabel: NICHE_BY_ID[r.niche]?.label || r.category || '—',
    tier: NICHE_BY_ID[r.niche]?.tier || 'B',
    category: r.category,
    address: r.address,
    neighborhood: r.neighborhood,
    city: r.city,
    lat: r.lat,
    lon: r.lon,
    phone: r.phone,
    phoneKind: phone.kind,
    website: r.website,
    instagram: r.instagram,
    rating: r.rating,
    reviews: r.reviews,
    photos: r.photos,
    hasHours: Boolean(r.has_hours),
    businessStatus: r.business_status,
    mapsUrl: r.maps_url,
    chain: Boolean(r.chain),
    sources: parse(r.sources, []),
    audit,
    score: r.score,
    probability: r.probability,
    temperature: r.temperature,
    pain: parse(r.pain, null),
    explanation: parse(r.explanation, null),
    competitorShare: r.competitor_share,
    status: r.status,
    owner: r.owner,
    notes: r.notes,
    nextActionAt: r.next_action_at,
    contactedAt: r.contacted_at,
    closedAt: r.closed_at,
    dealValue: r.deal_value,
    cnpj: r.cnpj,
    email: r.email,
    openedAt: r.opened_at,
    porte: r.porte,
    capital: r.capital,
    mei: Boolean(r.mei),
    phoneShared: Boolean(r.phone_shared),
    websiteDerived: Boolean(r.website_derived),
    updatedAt: r.updated_at,
  };
}
