// Modelo de propensão de compra.
//
// É uma regressão logística: z = viés + Σ peso·sinal, nota = 100·σ(z).
// Os pesos iniciais são heurísticos (o "prior"), escolhidos a partir do que
// costuma fechar venda de site para comércio local:
//   1) NECESSIDADE  – não tem site, site quebrado, só rede social, site ruim;
//   2) CAPACIDADE   – movimento (avaliações), reputação, nicho de ticket alto;
//   3) INTENÇÃO     – dono ativo no Google (fotos, horário), já investe em Instagram;
//   4) ALCANCE      – tem celular/WhatsApp para a abordagem;
//   5) CONTEXTO     – concorrentes próximos já têm site; não é franquia.
// Quando o time marca leads como "ganho" ou "perdido", o modelo é reajustado
// com esses resultados (MAP com prior gaussiano centrado nos pesos iniciais),
// então a nota passa a refletir o histórico real da Synch.
import { getSetting, setSetting } from './db.js';
import { NICHE_BY_ID } from './niches.js';

export const PRIOR = {
  bias: -2.6,
  p_none: 1.4,
  p_social: 1.7,
  p_aggregator: 1.5,
  p_dead_free: 1.9,
  p_broken: 2.0,
  p_working: -1.6,
  w_noHttps: 0.7,
  w_noMobile: 0.9,
  w_outdated: 0.5,
  w_oldTech: 0.3,
  w_slow: 0.25,
  w_freeBuilder: 0.6,
  reviews_log: 0.45,
  few_reviews: -0.5,
  huge_reviews: -0.8,
  rating_c: 0.6,
  photos_many: 0.2,
  has_hours: 0.15,
  tier_A: 0.5,
  tier_C: -0.6,
  phone_mobile: 0.5,
  phone_none: -1.8,
  chain: -3.0,
  competitor_share: 0.6,
  closed_temp: -2.0,
  price_high: 0.25,
  insta_known: 0.25,
  // Base CNPJ (Receita Federal)
  p_unverified_none: 1.0,
  free_email: 0.4,
  new_business: 0.7,
  young_business: 0.3,
  mei: -0.35,
  porte_plus: 0.35,
  capital_high: 0.25,
  phone_shared: -0.6,
};

export const FEATURE_GROUPS = {
  Necessidade: ['p_none', 'p_unverified_none', 'free_email', 'p_social', 'p_aggregator', 'p_dead_free', 'p_broken', 'p_working', 'w_noHttps', 'w_noMobile', 'w_outdated', 'w_oldTech', 'w_slow', 'w_freeBuilder'],
  Capacidade: ['reviews_log', 'few_reviews', 'huge_reviews', 'rating_c', 'tier_A', 'tier_C', 'price_high', 'porte_plus', 'capital_high', 'mei'],
  Intenção: ['photos_many', 'has_hours', 'insta_known', 'new_business', 'young_business'],
  Alcance: ['phone_mobile', 'phone_none', 'phone_shared'],
  Contexto: ['competitor_share', 'chain', 'closed_temp'],
};

export const FEATURE_INFO = {
  p_none: 'Não tem site',
  p_social: 'Link leva só para rede social',
  p_aggregator: 'Depende de página em marketplace',
  p_dead_free: 'Site gratuito do Google desativado',
  p_broken: 'Site informado fora do ar',
  p_working: 'Já tem site funcionando',
  w_noHttps: 'Site sem HTTPS',
  w_noMobile: 'Site não adaptado ao celular',
  w_outdated: 'Site desatualizado (3+ anos)',
  w_oldTech: 'Tecnologia ultrapassada',
  w_slow: 'Site lento',
  w_freeBuilder: 'Site em construtor gratuito',
  reviews_log: 'Volume de avaliações (log)',
  few_reviews: 'Menos de 5 avaliações',
  huge_reviews: 'Mais de 1.500 avaliações',
  rating_c: 'Nota no Google',
  photos_many: 'Perfil com 5+ fotos',
  has_hours: 'Horário publicado',
  tier_A: 'Nicho de ticket alto',
  tier_C: 'Nicho de ticket baixo',
  phone_mobile: 'Celular / WhatsApp',
  phone_none: 'Sem telefone',
  chain: 'Franquia ou rede',
  competitor_share: '% de concorrentes com site',
  closed_temp: 'Fechado temporariamente',
  price_high: 'Faixa de preço alta',
  insta_known: 'Tem Instagram',
  p_unverified_none: 'Nenhum site encontrado',
  free_email: 'E-mail gratuito (sem domínio próprio)',
  new_business: 'Empresa aberta há menos de 1 ano',
  young_business: 'Empresa com 1 a 3 anos',
  mei: 'MEI (ticket menor)',
  porte_plus: 'Porte EPP ou maior',
  capital_high: 'Capital social de R$ 100 mil ou mais',
  phone_shared: 'Telefone usado por várias empresas',
};

const CHAINS = /\b(odontocompany|sorridents|oral sin|amor sa[uú]de|dr\.? ?consulta|o botic[aá]rio|botic[aá]rio|cacau show|subway|mc ?donald|burger king|habib|bob'?s|giraffas|spoleto|china in box|chiquinho|kopenhagen|natura|hering|renner|riachuelo|c&a|drogasil|droga raia|pague menos|drogaria s[aã]o paulo|panvel|smart ?fit|bluefit|selfit|bodytech|localiza|unidas|wizard|ccaa|fisk|kumon|y[aá]zigi|wise up|5 ?[aà] ?sec|espa[cç]olaser|depyl action|s[oó]brancelhas|jacques janine|mundo verde|casa do p[aã]o de queijo|[oó]ticas? diniz|[oó]ticas? carol|chilli beans|carrefour|p[aã]o de a[cç][uú]car|assa[ií]|atacad[aã]o|oxxo|ita[uú]|bradesco|santander|caixa econ|banco do brasil|correios|ipiranga|petrobras|shell|pizza hut|domino'?s|outback|coco bambu|madero|jeronimo|lojas americanas|americanas|magazine luiza|magalu|casas bahia|havan|centauro|decathlon|cobasi|petz|petlove|imaginarium|puket|lupo|arezzo|vivara|pandora|samsung|vivo|claro|tim|oi)\b/i;

export function classifyPhone(raw) {
  if (!raw) return { kind: 'none', digits: null };
  let d = String(raw).replace(/\D/g, '');
  if (/^(0800|0300|0500|4004|4003|3003|3004)/.test(d)) return { kind: 'landline', digits: d };
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 11 && d[2] === '9') return { kind: 'mobile', digits: `55${d}` };
  if (d.length === 10 && /[2-5]/.test(d[2])) return { kind: 'landline', digits: `55${d}` };
  if (d.length === 10 && /[6-9]/.test(d[2])) return { kind: 'mobile', digits: `55${d.slice(0, 2)}9${d.slice(2)}` }; // celular antigo sem o 9
  return { kind: 'landline', digits: d.length >= 10 ? `55${d}` : d };
}

export function isChainName(name, brand) {
  return Boolean(brand) || CHAINS.test(name || '');
}

/** Extrai o vetor de sinais de um estabelecimento já auditado. */
export function extractFeatures(b) {
  const a = b.audit || { kind: b.website ? 'ok' : 'none' };
  const f = {};
  const kind = a.kind;
  // "Sem site" só é confirmado quando o Google tem a ficha da empresa e ela não informa site.
  // Na base CNPJ e no OpenStreetMap, ausência de site é só "não encontrado".
  const confirmed = a.confirmed ?? Boolean(b.sources?.includes('google'));
  f.p_none = kind === 'none' && confirmed ? 1 : 0;
  f.p_unverified_none = kind === 'none' && !confirmed ? 1 : 0;
  const domain = b.email?.includes('@') ? b.email.split('@')[1] : null;
  f.free_email = domain && FREE_MAIL.test(domain) && !b.website ? 1 : 0;
  f.p_social = kind === 'social' ? 1 : 0;
  f.p_aggregator = kind === 'aggregator' ? 1 : 0;
  f.p_dead_free = kind === 'dead_free' ? 1 : 0;
  f.p_broken = kind === 'broken' ? 1 : 0;
  f.p_working = kind === 'ok' || kind === 'weak' ? 1 : 0;
  const fl = a.flags || {};
  f.w_noHttps = f.p_working && fl.noHttps ? 1 : 0;
  f.w_noMobile = f.p_working && fl.noMobile ? 1 : 0;
  f.w_outdated = f.p_working && fl.outdated ? 1 : 0;
  f.w_oldTech = f.p_working && fl.oldTech ? 1 : 0;
  f.w_slow = f.p_working && fl.slow ? 1 : 0;
  f.w_freeBuilder = f.p_working && fl.freeBuilder ? 1 : 0;

  const reviewsKnown = b.reviews != null && b.sources?.includes('google');
  f.reviews_log = reviewsKnown ? Math.min(Math.log10(1 + b.reviews), 3) : 1.0; // sem Google: assume ~10 avaliações
  f.few_reviews = reviewsKnown && b.reviews < 5 ? 1 : 0;
  f.huge_reviews = reviewsKnown && b.reviews > 1500 ? 1 : 0;
  f.rating_c = b.rating != null && reviewsKnown && b.reviews >= 3 ? Math.max(-2, Math.min(0.8, b.rating - 4.2)) : 0;
  f.photos_many = (b.photos || 0) >= 5 ? 1 : 0;
  f.has_hours = b.has_hours ? 1 : 0;

  const tier = NICHE_BY_ID[b.niche]?.tier || 'B';
  f.tier_A = tier === 'A' ? 1 : 0;
  f.tier_C = tier === 'C' ? 1 : 0;

  const phone = classifyPhone(b.phone);
  f.phone_mobile = phone.kind === 'mobile' ? 1 : 0;
  f.phone_none = phone.kind === 'none' ? 1 : 0;

  f.chain = b.chain ? 1 : 0;
  f.competitor_share = b.competitor_share ?? 0;
  f.closed_temp = b.business_status === 'CLOSED_TEMPORARILY' ? 1 : 0;
  f.price_high = (b.price_level ?? 0) >= 3 ? 1 : 0;
  f.insta_known = (b.instagram || a.platform === 'Instagram') ? 1 : 0;

  const months = monthsSince(b.opened_at);
  f.new_business = months != null && months < 12 ? 1 : 0;
  f.young_business = months != null && months >= 12 && months < 36 ? 1 : 0;
  f.mei = b.mei ? 1 : 0;
  f.porte_plus = b.porte === '03' || b.porte === '05' ? 1 : 0;
  f.capital_high = (b.capital || 0) >= 100000 ? 1 : 0;
  f.phone_shared = b.phone_shared ? 1 : 0;
  return f;
}

const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|bol|uol|terra|ig|globo|globomail|icloud|me|mac|r7|zipmail|oi|superig|gmx|protonmail|proton|aol|zoho|yandex)\./i;

export function monthsSince(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function currentWeights() {
  const learned = getSetting('model', null);
  return learned?.weights ? { ...PRIOR, ...learned.weights } : { ...PRIOR };
}

function labelFor(key, b, f) {
  const a = b.audit || {};
  const niche = NICHE_BY_ID[b.niche];
  switch (key) {
    case 'p_social': return `Link do site leva só para o ${a.platform || 'perfil social'}`;
    case 'p_broken': return a.derived ? 'Domínio do e-mail sem site no ar' : 'Site informado fora do ar';
    case 'p_aggregator': return `Depende de página no ${a.platform || 'marketplace'}`;
    case 'reviews_log': return b.sources?.includes('google') ? `${(b.reviews || 0).toLocaleString('pt-BR')} avaliações no Google` : 'Movimento estimado (sem Google)';
    case 'rating_c': return `Nota ${String(b.rating).replace('.', ',')} no Google`;
    case 'tier_A': return `Nicho de ticket alto (${niche?.label?.toLowerCase() || 'segmento'})`;
    case 'tier_C': return `Nicho de ticket baixo (${niche?.label?.toLowerCase() || 'segmento'})`;
    case 'phone_mobile': return 'Celular: dá para chamar no WhatsApp';
    case 'phone_none': return 'Sem telefone cadastrado';
    case 'competitor_share': return `${Math.round(f.competitor_share * 100)}% dos concorrentes têm site`;
    case 'chain': return 'Franquia ou rede: o site costuma ser da matriz';
    case 'photos_many': return 'Perfil com fotos: o dono cuida do Google';
    case 'has_hours': return 'Horário de funcionamento publicado';
    case 'insta_known': return 'Tem Instagram: já investe em presença online';
    case 'free_email': return `E-mail @${b.email.split('@')[1]}: sem domínio próprio`;
    case 'new_business': return `Empresa aberta há ${monthsSince(b.opened_at)} ${monthsSince(b.opened_at) === 1 ? 'mês' : 'meses'}`;
    case 'young_business': return `Empresa aberta em ${b.opened_at.slice(0, 4)}`;
    case 'capital_high': return `Capital social de ${Number(b.capital).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}`;
    case 'phone_shared': return 'Telefone usado por várias empresas (pode ser do contador)';
    default: return FEATURE_INFO[key];
  }
}

/** Distribui pontos inteiros que somam exatamente (nota − ponto de partida). */
function allocate(parts, total) {
  const raw = parts.map((p) => p.raw);
  const floors = raw.map((r) => Math.trunc(r));
  let diff = total - floors.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [Math.abs(r - floors[i]), i, Math.sign(r - floors[i])]).sort((x, y) => y[0] - x[0]);
  for (const [, i, sign] of order) {
    if (diff === 0) break;
    const step = Math.sign(diff);
    if (sign === step || sign === 0) { floors[i] += step; diff -= step; }
  }
  if (diff !== 0 && floors.length) floors[0] += diff;
  return parts.map((p, i) => ({ ...p, points: floors[i] }));
}

export function scoreBusiness(b, weights = currentWeights()) {
  const f = extractFeatures(b);
  // Sinais não medidos (ex.: avaliações sem o Google) entram no ponto de partida como valor médio,
  // para o vendedor nunca citar como argumento algo que não foi verificado.
  const imputed = new Set(b.sources?.includes('google') ? [] : ['reviews_log']);
  let baseZ = weights.bias;
  for (const k of imputed) baseZ += (weights[k] ?? 0) * (f[k] || 0);
  let z = baseZ;
  const parts = [];
  for (const [k, x] of Object.entries(f)) {
    if (!x || imputed.has(k)) continue;
    const c = (weights[k] ?? 0) * x;
    if (Math.abs(c) < 1e-9) continue;
    z += c;
    parts.push({ key: k, logit: c });
  }
  const p = sigmoid(z);
  const score = Math.round(p * 100);
  const base = Math.round(sigmoid(baseZ) * 100);
  const dz = z - baseZ;
  const scale = Math.abs(dz) > 1e-6 ? (p * 100 - sigmoid(baseZ) * 100) / dz : 100 * sigmoid(z) * (1 - sigmoid(z));
  const explained = allocate(parts.map((x) => ({ ...x, raw: x.logit * scale })), score - base)
    .map(({ key, points }) => ({ key, label: labelFor(key, b, f), points }))
    .filter((x) => x.points !== 0)
    .sort((x, y) => y.points - x.points);

  const temperature = score >= 70 ? 'quente' : score >= 45 ? 'morno' : 'frio';
  return { features: f, score, probability: p, base, explanation: explained, temperature, pain: painOf(b) };
}

/** A dor principal vira o rótulo da plaquinha e o gancho da abordagem. */
export function painOf(b) {
  const a = b.audit || {};
  switch (a.kind) {
    case 'broken': return { code: 'site_fora', label: a.derived ? 'Domínio sem site' : 'Site fora do ar' };
    case 'unchecked': return { code: 'site_fraco', label: 'Site não verificado' };
    case 'dead_free': return { code: 'site_desativado', label: 'Site desativado' };
    case 'social': return { code: 'so_social', label: `Só ${a.platform || 'rede social'}` };
    case 'aggregator': return { code: 'so_marketplace', label: `Só ${a.platform || 'marketplace'}` };
    case 'none': return { code: 'sem_site', label: (a.confirmed ?? b.sources?.includes('google')) ? 'Sem site' : 'Sem site encontrado' };
    case 'weak': {
      const fl = a.flags || {};
      if (fl.noMobile) return { code: 'site_fraco', label: 'Não abre no celular' };
      if (fl.noHttps) return { code: 'site_fraco', label: 'Site “não seguro”' };
      if (fl.outdated) return { code: 'site_fraco', label: `Site de ${a.copyrightYear}` };
      if (fl.freeBuilder) return { code: 'site_fraco', label: 'Site gratuito' };
      if (fl.oldTech) return { code: 'site_fraco', label: 'Site ultrapassado' };
      if (fl.slow) return { code: 'site_fraco', label: 'Site lento' };
      return { code: 'site_fraco', label: 'Site fraco' };
    }
    case 'ok': return { code: 'site_ok', label: 'Site ok' };
    default: return { code: 'sem_site', label: 'Sem site' };
  }
}

/**
 * Reajusta os pesos com os resultados reais (ganho = 1, perdido = 0).
 * Gradiente descendente no objetivo MAP: log-loss + (λ/2)·‖w − prior‖².
 * λ alto no começo mantém o modelo perto do prior quando há poucos exemplos.
 */
export function fitModel(examples, { lambda = 2.0, iters = 1500, lr = 0.05 } = {}) {
  const keys = Object.keys(PRIOR);
  const w = { ...PRIOR };
  const n = examples.length;
  for (let it = 0; it < iters; it++) {
    const g = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const { x, y } of examples) {
      let z = w.bias;
      for (const k of keys) if (k !== 'bias' && x[k]) z += w[k] * x[k];
      const err = sigmoid(z) - y;
      g.bias += err;
      for (const k of keys) if (k !== 'bias' && x[k]) g[k] += err * x[k];
    }
    for (const k of keys) {
      const grad = g[k] / n + (lambda / n) * (w[k] - PRIOR[k]);
      w[k] -= lr * grad * 10;
    }
  }
  let correct = 0, logloss = 0;
  for (const { x, y } of examples) {
    let z = w.bias;
    for (const k of keys) if (k !== 'bias' && x[k]) z += w[k] * x[k];
    const p = sigmoid(z);
    if ((p >= 0.5 ? 1 : 0) === y) correct++;
    logloss += -(y * Math.log(Math.max(p, 1e-9)) + (1 - y) * Math.log(Math.max(1 - p, 1e-9)));
  }
  return { weights: w, n, accuracy: n ? correct / n : null, logloss: n ? logloss / n : null };
}

export const MIN_EXAMPLES = 6;

export function trainFromOutcomes(rows) {
  const examples = rows
    .filter((r) => r.features && (r.status === 'ganho' || r.status === 'perdido'))
    .map((r) => ({ x: JSON.parse(r.features), y: r.status === 'ganho' ? 1 : 0 }));
  const wins = examples.filter((e) => e.y === 1).length;
  const losses = examples.length - wins;
  if (examples.length < MIN_EXAMPLES || wins < 2 || losses < 2) {
    return { trained: false, n: examples.length, wins, losses };
  }
  const fit = fitModel(examples);
  const model = { weights: fit.weights, n: fit.n, wins, losses, accuracy: fit.accuracy, logloss: fit.logloss, trainedAt: new Date().toISOString() };
  setSetting('model', model);
  return { trained: true, ...model };
}
