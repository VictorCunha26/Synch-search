// Auditoria de presença digital: classifica o "site" informado do comércio
// e, quando é um site de verdade, visita a página e mede os problemas que
// viram argumento de venda.
import { Agent, request } from 'undici';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { cacheGet, cacheSet } from './db.js';

const DAY = 86_400_000;
const TIMEOUT = 9000;
const UA = 'Mozilla/5.0 (compatible; SynchSearchAudit/0.1; verificacao de presenca digital)';
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false }, headersTimeout: TIMEOUT, bodyTimeout: TIMEOUT });
const strictAgent = new Agent({ headersTimeout: TIMEOUT, bodyTimeout: TIMEOUT });

const SOCIAL = [
  ['instagram.com', 'Instagram'], ['facebook.com', 'Facebook'], ['fb.com', 'Facebook'], ['fb.me', 'Facebook'],
  ['tiktok.com', 'TikTok'], ['linktr.ee', 'Linktree'], ['linktree.com', 'Linktree'], ['beacons.ai', 'Beacons'],
  ['bio.link', 'bio.link'], ['taplink.cc', 'Taplink'], ['linkbio.co', 'link na bio'], ['wa.me', 'WhatsApp'],
  ['whatsapp.com', 'WhatsApp'], ['api.whatsapp.com', 'WhatsApp'], ['youtube.com', 'YouTube'], ['linkedin.com', 'LinkedIn'],
  ['twitter.com', 'X/Twitter'], ['x.com', 'X/Twitter'], ['kwai.com', 'Kwai'], ['msha.ke', 'link na bio'],
];
const AGGREGATOR = [
  ['ifood.com.br', 'iFood'], ['doctoralia.com.br', 'Doctoralia'], ['booking.com', 'Booking'], ['tripadvisor', 'Tripadvisor'],
  ['getninjas.com.br', 'GetNinjas'], ['goomer.app', 'Goomer'], ['anota.ai', 'Anota AI'], ['aiqfome.com', 'aiqfome'],
  ['rappi.com', 'Rappi'], ['mercadolivre.com', 'Mercado Livre'], ['shopee.com', 'Shopee'], ['olx.com.br', 'OLX'],
  ['zapimoveis.com.br', 'Zap Imóveis'], ['vivareal.com.br', 'Viva Real'], ['imovelweb.com.br', 'Imovelweb'],
  ['booksy.com', 'Booksy'], ['trinks.com', 'Trinks'], ['agendor', 'Agendor'], ['simplesagenda', 'Simples Agenda'],
  ['avec.app', 'Avec'], ['google.com', 'Google'], ['g.page', 'Google'], ['goo.gl', 'Google'], ['maps.app.goo.gl', 'Google Maps'],
  ['airbnb.com', 'Airbnb'], ['cardapioweb', 'Cardápio Web'], ['menudino.com', 'MenuDino'], ['ola.click', 'OlaClick'],
];
// Construtores gratuitos e subdomínios: sinal de que o dono quis um site mas não investiu.
const FREE_BUILDER = [
  'wixsite.com', 'blogspot.com', 'wordpress.com', 'webnode.page', 'webnode.com.br', 'site123.me', 'weebly.com',
  'godaddysites.com', 'square.site', 'ueniweb.com', 'jimdosite.com', 'jimdofree.com', 'carrd.co', 'negocio.site',
  'sites.google.com', 'wix.com', 'yolasite.com', 'hostingersite.com', 'vercel.app', 'netlify.app', 'github.io',
];
const PARKED = /(dom[ií]nio (est[aá] )?(à|a) venda|this domain (is )?(for sale|may be for sale)|buy this domain|comprar este dom[ií]nio|domain parking|parked (free|domain)|registro\.br.*(expirad|congelad)|dom[ií]nio expirado|account (has been )?suspended|conta suspensa|site suspenso|default web site page|it works!|index of \/|hostgator.*(p[aá]gina padr[aã]o|default)|locaweb.*(em constru|padr[aã]o)|site em constru[cç][aã]o|em constru[cç][aã]o|under construction|coming soon|em breve no ar|website coming soon)/i;

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
function matchList(host, list) {
  // Domínio completo casa só por igualdade ou subdomínio (senão "sorrix.com.br" viraria "x.com").
  // Entradas sem ponto (ex.: "tripadvisor") casam como parte do nome.
  return list.find(([d]) => (d.includes('.') ? host === d || host.endsWith('.' + d) : host.split('.').some((p) => p.includes(d))));
}

export function normalizeUrl(raw) {
  if (!raw) return null;
  let u = String(raw).trim();
  if (!u) return null;
  if (u.startsWith('@')) return `https://instagram.com/${u.slice(1)}`;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  try { return new URL(u).toString(); } catch { return null; }
}

function isPrivateAddress(ip) {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l === '::';
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function assertPublicHost(host) {
  if (isIP(host)) { if (isPrivateAddress(host)) throw Object.assign(new Error('endereço privado'), { code: 'PRIVATE' }); return; }
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw Object.assign(new Error('endereço privado'), { code: 'PRIVATE' });
}

/** Faz GET seguindo redirecionamentos manualmente (bloqueando IPs internos a cada salto). */
async function fetchPage(startUrl) {
  let url = startUrl;
  const hops = [];
  const t0 = Date.now();
  let certError = false;
  for (let i = 0; i < 6; i++) {
    const host = new URL(url).hostname;
    await assertPublicHost(host);
    let res;
    try {
      res = await request(url, { method: 'GET', headers: { 'user-agent': UA, accept: 'text/html,*/*', 'accept-language': 'pt-BR' }, dispatcher: strictAgent, maxRedirections: 0 });
    } catch (e) {
      const code = e.code || e.cause?.code || '';
      if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(code + e.message)) {
        certError = true;
        res = await request(url, { method: 'GET', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, dispatcher: insecureAgent, maxRedirections: 0 });
      } else throw e;
    }
    hops.push({ url, status: res.statusCode });
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      await res.body.dump();
      url = new URL(res.headers.location, url).toString();
      continue;
    }
    let html = '';
    const ct = String(res.headers['content-type'] || '');
    if (/html|text/i.test(ct) || !ct) {
      const chunks = [];
      let size = 0;
      for await (const c of res.body) { chunks.push(c); size += c.length; if (size > 1_500_000) break; }
      html = Buffer.concat(chunks).toString('utf8');
    } else await res.body.dump();
    return { finalUrl: url, status: res.statusCode, html, ms: Date.now() - t0, hops, certError };
  }
  throw Object.assign(new Error('redirecionamentos demais'), { code: 'REDIRECT_LOOP' });
}

function inspectHtml(html, now = new Date()) {
  const lower = html.toLowerCase();
  const title = (html.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1] || '').trim();
  const viewport = /<meta[^>]+name=["']?viewport/i.test(html);
  const generator = html.match(/<meta[^>]+name=["']?generator["']?[^>]+content=["']([^"']+)/i)?.[1] || null;
  const years = [...html.matchAll(/(?:©|&copy;|copyright|todos os direitos reservados)[^0-9]{0,40}((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)]
    .map((m) => Number(m[2] || m[1])).filter((y) => y <= now.getFullYear());
  const copyrightYear = years.length ? Math.max(...years) : null;
  const jq = html.match(/jquery[.-]?(\d)\.(\d+)(?:\.\d+)?(?:\.min)?\.js/i);
  const oldTech = /\.swf["']|<frameset|<marquee|<font\s/i.test(html) || (jq && Number(jq[1]) === 1 && Number(jq[2]) < 9);
  const hasWhats = /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(html);
  const hasForm = /<form[\s>]/i.test(html);
  const textLen = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
  const parked = PARKED.test(lower.slice(0, 60000)) && textLen < 4000;
  return { title, viewport, generator, copyrightYear, oldTech: Boolean(oldTech), hasWhats, hasForm, textLen, parked };
}

/**
 * Resultado:
 *  kind: none | social | aggregator | dead_free | broken | weak | ok
 *  issues: lista de problemas legíveis
 */
export async function auditWebsite(rawUrl, opts = {}) {
  const out = await auditWebsiteRaw(rawUrl, opts);
  // Site deduzido do domínio do e-mail cadastrado na Receita: se não abre, a empresa
  // tem domínio (e paga por ele) mas não tem site. Ótimo gancho, mas a mensagem muda.
  if (opts.derived && out.kind === 'broken') {
    const host = (() => { try { return new URL(out.url).hostname.replace(/^www\./, ''); } catch { return out.url; } })();
    return { ...out, derived: true, issues: [`A empresa usa o domínio ${host} no e-mail, mas não há site no ar nesse endereço`] };
  }
  return opts.derived ? { ...out, derived: true } : out;
}

async function auditWebsiteRaw(rawUrl, { force = false } = {}) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { kind: 'none', url: null, issues: [], checkedAt: new Date().toISOString() };

  const host = hostOf(url);
  const social = matchList(host, SOCIAL);
  if (social) return { kind: 'social', url, platform: social[1], issues: [`O link do perfil leva para ${social[1]}, não para um site próprio`], checkedAt: new Date().toISOString() };
  if (host.endsWith('business.site')) {
    return { kind: 'dead_free', url, platform: 'Google Sites (business.site)', issues: ['Site gratuito do Google (business.site), desativado pelo Google em 2024: o link não abre mais'], checkedAt: new Date().toISOString() };
  }
  const agg = matchList(host, AGGREGATOR);
  if (agg) return { kind: 'aggregator', url, platform: agg[1], issues: [`O link leva para uma página no ${agg[1]}, não para um site próprio`], checkedAt: new Date().toISOString() };

  const cacheKey = `audit:${url}`;
  if (!force) { const hit = cacheGet(cacheKey, 14 * DAY); if (hit) return hit; }

  const out = { kind: 'ok', url, issues: [], checkedAt: new Date().toISOString() };
  const free = FREE_BUILDER.find((d) => host === d || host.endsWith('.' + d));
  try {
    // Tenta https primeiro (é o que o Google e o navegador fazem); só cai para http se https falhar.
    // Também testa com e sem "www.", porque muito domínio só tem um dos dois configurado.
    const u0 = new URL(url);
    const altHost = u0.hostname.startsWith('www.') ? u0.hostname.slice(4) : `www.${u0.hostname}`;
    const variants = [];
    for (const host of [u0.hostname, altHost]) {
      for (const proto of ['https:', 'http:']) { const v = new URL(url); v.hostname = host; v.protocol = proto; variants.push(v.toString()); }
    }
    let page;
    let firstErr;
    for (const v of variants) {
      try { page = await fetchPage(v); break; } catch (e) { firstErr ||= e; }
    }
    if (!page) throw firstErr;
    const info = inspectHtml(page.html);
    Object.assign(out, {
      finalUrl: page.finalUrl, status: page.status, ms: page.ms, title: info.title, generator: info.generator,
      copyrightYear: info.copyrightYear, viewport: info.viewport, https: page.finalUrl.startsWith('https:') && !page.certError,
      certError: page.certError, hasWhats: info.hasWhats, hasForm: info.hasForm,
    });
    if ([401, 403, 429, 503].includes(page.status)) {
      // Proteção anti-robô (Cloudflare etc.) não prova que não há site: não usar como argumento.
      out.kind = 'unchecked';
      out.issues.push(`O site bloqueou a verificação automática (HTTP ${page.status}). Confira abrindo no navegador.`);
    } else if (page.status >= 400) {
      out.kind = 'broken';
      out.issues.push(page.status === 404 ? 'O site informado retorna "página não encontrada" (404)' : `O site informado retorna erro ${page.status}`);
    } else if (info.parked) {
      out.kind = 'broken';
      out.issues.push('O domínio mostra página de "em construção", domínio à venda ou hospedagem padrão');
    } else if (info.textLen < 120 && !/<script/i.test(page.html)) {
      out.kind = 'broken';
      out.issues.push('A página abre praticamente vazia');
    } else {
      const weak = [];
      if (!out.https) weak.push(page.certError ? 'Certificado de segurança inválido: o navegador mostra "não seguro"' : 'Sem HTTPS: o navegador marca o site como "não seguro"');
      if (!info.viewport) weak.push('Não é adaptado para celular (sem viewport)');
      const age = info.copyrightYear ? new Date().getFullYear() - info.copyrightYear : null;
      if (age != null && age >= 3) weak.push(`Rodapé com ano ${info.copyrightYear}: site sem atualização há ${age} anos`);
      if (info.oldTech) weak.push('Tecnologia ultrapassada (Flash, frames ou jQuery antigo)');
      if (page.ms > 4500) weak.push(`Lento: levou ${(page.ms / 1000).toFixed(1)} s para responder`);
      if (free) weak.push(`Feito em construtor gratuito (${free}), sem domínio próprio`);
      out.flags = { noHttps: !out.https, noMobile: !info.viewport, outdated: age != null && age >= 3, oldTech: info.oldTech, slow: page.ms > 4500, freeBuilder: Boolean(free) };
      out.issues.push(...weak);
      out.kind = weak.length ? 'weak' : 'ok';
    }
  } catch (e) {
    const code = e.code || e.cause?.code || '';
    out.kind = code === 'PRIVATE' ? 'none' : 'broken';
    out.errorCode = code || e.name;
    const why = /ENOTFOUND|EAI_AGAIN/.test(code) ? 'o domínio não existe mais ou expirou'
      : /ECONNREFUSED/.test(code) ? 'o servidor recusa conexão'
      : /TIMEOUT|ETIMEDOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_CONNECT_TIMEOUT|AbortError/i.test(code + e.message) ? 'demorou mais de 9 s e não respondeu'
      : /REDIRECT_LOOP/.test(code) ? 'entra em loop de redirecionamento'
      : 'não carrega';
    if (out.kind === 'broken') out.issues.push(`O site informado está fora do ar: ${why}`);
  }
  cacheSet(cacheKey, out);
  return out;
}
