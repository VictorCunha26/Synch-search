export const TEMP_LABEL = { quente: 'Quente', morno: 'Morno', frio: 'Frio' };

export const PAINS = [
  { code: 'site_fora', label: 'Site fora do ar' },
  { code: 'site_desativado', label: 'Site desativado' },
  { code: 'sem_site', label: 'Sem site' },
  { code: 'so_social', label: 'Só rede social' },
  { code: 'so_marketplace', label: 'Só marketplace' },
  { code: 'site_fraco', label: 'Site fraco' },
  { code: 'site_ok', label: 'Site ok' },
];

export function painClass(code) {
  if (code === 'site_fora' || code === 'site_desativado') return 'broken';
  if (code === 'site_ok') return 'ok';
  return 'need';
}

export const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
export const fmtRating = (r) => (r == null ? '—' : Number(r).toFixed(1).replace('.', ','));
export const fmtMoney = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

export function initials(name = '') {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

// Identidade preto e branco: avatares monocromáticos, diferenciados pelas iniciais.
export function avatarColor() {
  return '#0a0a0a';
}

export function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `há ${days} d`;
  return d.toLocaleDateString('pt-BR');
}

export function phoneDisplay(p) {
  if (!p) return '';
  const d = p.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}
