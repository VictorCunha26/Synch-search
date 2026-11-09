// Cliente da API. O vendedor ativo vai no cabeçalho X-Seller.
export function getSeller() {
  return localStorage.getItem('synch.seller') || '';
}
export function setSeller(name) {
  if (name) localStorage.setItem('synch.seller', name);
  else localStorage.removeItem('synch.seller');
  window.dispatchEvent(new Event('synch:seller'));
}

async function req(method, url, body) {
  const headers = { Accept: 'application/json' };
  const seller = getSeller();
  if (seller) headers['X-Seller'] = encodeURIComponent(seller);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Sem conexão com o servidor do Synch Search. Ele está rodando?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b = {}) => req('POST', u, b),
  put: (u, b = {}) => req('PUT', u, b),
  patch: (u, b = {}) => req('PATCH', u, b),
  del: (u) => req('DELETE', u),
};

export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
