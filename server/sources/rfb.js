// Base nacional de empresas: dados abertos do CNPJ (Receita Federal).
//
// Todo mês a Receita publica o cadastro de TODAS as empresas do Brasil
// (~65 milhões de estabelecimentos) num compartilhamento público.
// O importador baixa os arquivos, lê direto do zip e guarda só o que
// interessa à Synch: estabelecimentos ATIVOS dos CNAEs dos segmentos,
// nas UFs escolhidas. Depois as buscas por cidade consultam essa base
// local, sem depender de serviço externo.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, statSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { db, getSetting, setSetting, openConnection } from '../db.js';
import { CNAE_TO_NICHES, nicheForCnae } from '../niches.js';

const SHARE = process.env.SYNCH_RFB_SHARE || 'YggdBLfdninEJX9';
const BASE = 'https://arquivos.receitafederal.gov.br/public.php/webdav/';
const AUTH = 'Basic ' + Buffer.from(`${SHARE}:`).toString('base64');
const TMP = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'rfb-tmp');

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

export const normName = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const FREE_MAIL = /^(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|bol|uol|terra|ig|globo|globomail|icloud|me|mac|r7|zipmail|oi|superig|gmx|protonmail|proton|aol|zoho|yandex|mail|email|hotmail\.com|outlook\.com|yahoo\.com)\./i;
export function isFreeMail(domain) {
  return !domain || FREE_MAIL.test(domain) || /\.(gov|jus|leg|mp|def)\.br$/.test(domain);
}

// ------------------------------------------------------------------ WebDAV
async function propfind(path) {
  const res = await fetch(BASE + path, { method: 'PROPFIND', headers: { Authorization: AUTH, Depth: '1' } });
  if (!res.ok) throw new Error(`Receita Federal respondeu HTTP ${res.status} ao listar os arquivos.`);
  const xml = await res.text();
  return [...xml.matchAll(/<d:response>([\s\S]*?)<\/d:response>/g)].map(([, r]) => ({
    href: decodeURIComponent(r.match(/<d:href>([^<]+)<\/d:href>/)?.[1] || ''),
    size: Number(r.match(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/)?.[1] || 0),
  }));
}

/** Mês mais recente que já está completo (tem os 10 arquivos de estabelecimentos). */
export async function latestMonth() {
  const months = (await propfind('')).map((e) => e.href.match(/(\d{4}-\d{2})\/$/)?.[1]).filter(Boolean).sort().reverse();
  for (const m of months.slice(0, 3)) {
    const files = await propfind(`${m}/`);
    const names = new Map(files.map((f) => [f.href.split('/').pop(), f.size]));
    if (names.get('Estabelecimentos9.zip') > 0 && names.get('Empresas9.zip') > 0) return { month: m, files: names };
  }
  throw new Error('Não encontrei um mês completo na base da Receita Federal.');
}

async function download(month, name, size, onBytes, signal) {
  mkdirSync(TMP, { recursive: true });
  const dest = resolve(TMP, `${month}-${name}`);
  let have = existsSync(dest) ? statSync(dest).size : 0;
  if (size && have === size) { onBytes(size); return dest; }
  if (have > (size || Infinity)) { rmSync(dest); have = 0; }
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`${BASE}${month}/${name}`, { headers: { Authorization: AUTH, ...(have ? { Range: `bytes=${have}-` } : {}) }, signal });
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      if (have && res.status !== 206) have = 0; // servidor ignorou o Range: recomeça
      const body = Readable.fromWeb(res.body);
      let got = have;
      body.on('data', (c) => { got += c.length; onBytes(got); });
      await pipeline(body, createWriteStream(dest, { flags: have ? 'a' : 'w' }));
      have = statSync(dest).size;
      if (!size || have >= size) return dest;
    } catch (e) {
      if (signal?.aborted) throw new Error('Importação cancelada.');
      have = existsSync(dest) ? statSync(dest).size : 0;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw new Error(`Não consegui baixar ${name} da Receita Federal. Verifique a internet e tente de novo (o download continua de onde parou).`);
}

/** Lê o CSV de dentro do zip, linha a linha, sem descompactar em disco. */
async function eachLine(zipPath, onLine, signal) {
  const child = spawn('unzip', ['-p', zipPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  const kill = () => child.kill('SIGKILL');
  signal?.addEventListener('abort', kill, { once: true });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdout.setEncoding('latin1');
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length < 4) continue;
    onLine(line.slice(1, -1).split('";"'));
  }
  const code = await new Promise((r) => (child.exitCode != null ? r(child.exitCode) : child.on('close', r)));
  signal?.removeEventListener('abort', kill);
  if (signal?.aborted) throw new Error('Importação cancelada.');
  if (code !== 0) throw new Error(`Falha ao ler ${zipPath.split('/').pop()}: ${stderr.trim() || `unzip saiu com ${code}`}. O comando "unzip" precisa estar instalado.`);
}

// ------------------------------------------------------------------ importação
const state = { running: false, done: false, step: '', file: '', fileIndex: 0, totalFiles: 0, bytes: 0, totalBytes: 0, kept: 0, error: null, startedAt: null };
let abortCtl = null;

function countByUf(conn = db) {
  return conn.prepare('SELECT uf, COUNT(*) n FROM rfb_estab GROUP BY uf ORDER BY uf').all().map((r) => ({ uf: r.uf, n: r.n }));
}

export function rfbStatus() {
  let meta = getSetting('rfbMeta', null);
  if (meta && !meta.byUf) { meta = { ...meta, byUf: countByUf() }; setSetting('rfbMeta', meta); }
  const byUf = meta?.byUf || [];
  return { ...state, meta, total: byUf.reduce((s, r) => s + r.n, 0), byUf };
}

export function cancelRfbImport() {
  if (abortCtl) abortCtl.abort();
}

export function startRfbImport({ ufs, parts, skipSimples = false }) {
  if (state.running) throw new Error('Já existe uma importação em andamento.');
  const wanted = new Set((ufs?.length ? ufs : UFS).filter((u) => UFS.includes(u)));
  abortCtl = new AbortController();
  const signal = abortCtl.signal;
  Object.assign(state, { running: true, done: false, step: 'Consultando a Receita Federal…', file: '', fileIndex: 0, totalFiles: 0, bytes: 0, totalBytes: 0, kept: 0, error: null, startedAt: new Date().toISOString() });

  const idb = openConnection();
  (async () => {
    const { month, files } = await latestMonth();
    // `parts` limita a alguns dos 10 lotes (usado em testes); o padrão é a base inteira.
    const idx = parts?.length ? parts : [...Array(10).keys()];
    const est = idx.map((i) => `Estabelecimentos${i}.zip`);
    const emp = idx.map((i) => `Empresas${i}.zip`);
    const plan = ['Municipios.zip', ...est, ...emp, ...(skipSimples ? [] : ['Simples.zip'])];
    state.totalFiles = plan.length;
    state.totalBytes = plan.reduce((s, f) => s + (files.get(f) || 0), 0);
    let doneBytes = 0;

    // Baixa o próximo arquivo enquanto o atual é processado.
    const fetchFile = (name) => download(month, name, files.get(name), (b) => { state.bytes = doneBytes + b; }, signal);

    // Começa limpando as UFs que vão ser (re)importadas.
    idb.exec('BEGIN');
    const del = idb.prepare('DELETE FROM rfb_estab WHERE uf = ?');
    for (const uf of wanted) del.run(uf);
    idb.exec('COMMIT');

    const insEst = idb.prepare(`INSERT OR REPLACE INTO rfb_estab
      (cnpj, basico, matriz, fantasia, cnae, niche, inicio, logradouro, numero, complemento, bairro, bairro_norm, cep, uf, mun_cod, tel1, tel2, email, email_domain)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insEmp = idb.prepare('INSERT OR REPLACE INTO rfb_empresa (basico, razao, natureza, capital, porte) VALUES (?,?,?,?,?)');
    const insSim = idb.prepare('INSERT OR REPLACE INTO rfb_simples (basico, mei) VALUES (?,?)');
    const insMun = idb.prepare('INSERT OR REPLACE INTO rfb_municipio (cod, nome, norm) VALUES (?,?,?)');

    let batch = 0;
    const flush = (force) => { if (batch >= 5000 || (force && batch)) { idb.exec('COMMIT'); idb.exec('BEGIN'); batch = 0; } };
    // Consulta no banco em vez de um Set em memória: a base do Brasil passa de 5 milhões de empresas.
    const hasBasico = idb.prepare('SELECT 1 FROM rfb_estab WHERE basico = ? LIMIT 1');

    let next = fetchFile(plan[0]);
    for (let i = 0; i < plan.length; i++) {
      const name = plan[i];
      state.fileIndex = i + 1;
      state.file = name;
      state.step = `Baixando ${name} (${i + 1}/${plan.length})…`;
      const path = await next;
      doneBytes += files.get(name) || 0;
      next = i + 1 < plan.length ? fetchFile(plan[i + 1]) : null;
      next?.catch(() => {}); // o erro aparece quando o arquivo for aguardado

      state.step = `Lendo ${name} (${i + 1}/${plan.length})…`;
      idb.exec('BEGIN');
      if (name === 'Municipios.zip') {
        await eachLine(path, (f) => { insMun.run(f[0], f[1], normName(f[1])); }, signal);
      } else if (name.startsWith('Estabelecimentos')) {
        await eachLine(path, (f) => {
          // 5 = situação cadastral (02 = ativa), 11 = CNAE principal, 19 = UF
          if (f[5] !== '02' || !wanted.has(f[19]) || !CNAE_TO_NICHES[f[11]]) return;
          const fantasia = f[4]?.trim() || null;
          const email = (f[27] || '').trim().toLowerCase() || null;
          const tel = (ddd, n) => (n && n.trim() ? `${(ddd || '').trim()}${n.trim()}`.replace(/\D/g, '') : null);
          insEst.run(
            f[0] + f[1] + f[2], f[0], f[3] === '1' ? 1 : 0, fantasia, f[11], nicheForCnae(f[11], fantasia || ''),
            f[10] || null, [f[13], f[14]].filter((x) => x && x.trim()).join(' ').trim() || null, f[15] || null, f[16] || null,
            f[17] || null, normName(f[17]), f[18] || null, f[19], f[20], tel(f[21], f[22]), tel(f[23], f[24]),
            email, email?.includes('@') ? email.split('@')[1] : null,
          );
          state.kept++;
          batch++; flush();
        }, signal);
      } else if (name.startsWith('Empresas')) {
        await eachLine(path, (f) => {
          if (!hasBasico.get(f[0])) return;
          insEmp.run(f[0], f[1], f[2], Number((f[4] || '0').replace(/\./g, '').replace(',', '.')) || 0, f[5] || null);
          batch++; flush();
        }, signal);
      } else if (name === 'Simples.zip') {
        await eachLine(path, (f) => {
          if (!hasBasico.get(f[0])) return;
          insSim.run(f[0], f[4] === 'S' ? 1 : 0);
          batch++; flush();
        }, signal);
      }
      idb.exec('COMMIT');
      rmSync(path, { force: true });
    }

    state.step = 'Calculando e-mails e telefones compartilhados (contadores)…';
    idb.exec(`
      DELETE FROM rfb_domain_freq;
      INSERT INTO rfb_domain_freq SELECT email_domain, COUNT(DISTINCT basico) FROM rfb_estab WHERE email_domain IS NOT NULL GROUP BY email_domain;
      DELETE FROM rfb_phone_freq;
      INSERT INTO rfb_phone_freq SELECT tel1, COUNT(DISTINCT basico) FROM rfb_estab WHERE tel1 IS NOT NULL GROUP BY tel1;
    `);
    const prev = getSetting('rfbMeta', null);
    const ufsDone = [...new Set([...(prev?.ufs || []), ...wanted])].sort();
    state.step = 'Contando empresas por estado…';
    setSetting('rfbMeta', { month, ufs: ufsDone, importedAt: new Date().toISOString(), byUf: countByUf(idb) });
    Object.assign(state, { running: false, done: true, step: `Base de ${month} importada.` });
  })().catch((e) => {
    try { idb.exec('ROLLBACK'); } catch { /* sem transação aberta */ }
    Object.assign(state, { running: false, done: false, error: e.message, step: 'Importação interrompida.' });
  }).finally(() => { abortCtl = null; try { idb.close(); } catch { /* já fechada */ } });
}

/** Remove downloads incompletos de meses antigos. */
export function cleanupRfbTmp(keepMonth) {
  if (!existsSync(TMP)) return;
  for (const f of readdirSync(TMP)) if (!f.startsWith(keepMonth)) rmSync(resolve(TMP, f), { force: true });
}

// ------------------------------------------------------------------ consulta
const UF_BY_STATE = {
  ACRE: 'AC', ALAGOAS: 'AL', AMAZONAS: 'AM', AMAPA: 'AP', BAHIA: 'BA', CEARA: 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES',
  GOIAS: 'GO', MARANHAO: 'MA', 'MINAS GERAIS': 'MG', 'MATO GROSSO DO SUL': 'MS', 'MATO GROSSO': 'MT', PARA: 'PA', PARAIBA: 'PB',
  PERNAMBUCO: 'PE', PIAUI: 'PI', PARANA: 'PR', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN', RONDONIA: 'RO', RORAIMA: 'RR',
  'RIO GRANDE DO SUL': 'RS', 'SANTA CATARINA': 'SC', SERGIPE: 'SE', 'SAO PAULO': 'SP', TOCANTINS: 'TO',
};
export function ufFromState(state) { return UF_BY_STATE[normName(state)] || null; }

export function rfbHasData() {
  return (getSetting('rfbMeta', null)?.ufs?.length || 0) > 0 && db.prepare('SELECT 1 FROM rfb_estab LIMIT 1').get() != null;
}

const title = (s) => (s || '').toLowerCase().replace(/(^|[\s/(.-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E|Em|Para|Com)\b/g, (w) => w.toLowerCase()).replace(/\bLtda\b/gi, 'Ltda').replace(/\bMe\b$/, 'ME').replace(/\bEireli\b/gi, 'EIRELI');

/** Estabelecimentos da cidade nos segmentos pedidos, já no formato de candidato. */
export function rfbCandidates({ uf, city, niches, neighborhood, limit = 6000 }) {
  const mun = db.prepare('SELECT cod, nome FROM rfb_municipio WHERE norm = ?').all(normName(city));
  if (!mun.length) return { candidates: [], total: 0, municipio: null };
  const cods = mun.map((m) => m.cod);
  const params = [uf, ...cods, ...niches];
  let where = `e.uf = ? AND e.mun_cod IN (${cods.map(() => '?').join(',')}) AND e.niche IN (${niches.map(() => '?').join(',')})`;
  if (neighborhood) { where += ' AND e.bairro_norm LIKE ?'; params.push(`%${normName(neighborhood)}%`); }
  const total = db.prepare(`SELECT COUNT(*) n FROM rfb_estab e WHERE ${where}`).get(...params).n;
  // Em cidades grandes, prioriza quem tem telefone e as empresas mais novas.
  const rows = db.prepare(`
    SELECT e.*, emp.razao, emp.natureza, emp.capital, emp.porte, s.mei,
      (SELECT n FROM rfb_domain_freq d WHERE d.domain = e.email_domain) AS domain_n,
      (SELECT n FROM rfb_phone_freq p WHERE p.phone = e.tel1) AS phone_n,
      (SELECT COUNT(*) FROM rfb_estab x WHERE x.basico = e.basico) AS units
    FROM rfb_estab e
    LEFT JOIN rfb_empresa emp ON emp.basico = e.basico
    LEFT JOIN rfb_simples s ON s.basico = e.basico
    WHERE ${where}
    ORDER BY (e.tel1 IS NOT NULL) DESC, e.inicio DESC
    LIMIT ?`).all(...params, limit);

  const cityName = title(mun[0].nome);
  const candidates = rows.map((r) => {
    // Razão social de MEI termina com o CPF do dono: não exibe.
    const razao = (r.razao || '').replace(/\s*\d{11}\s*$/, '').trim();
    const name = title(r.fantasia || razao || '').replace(/\s+/g, ' ').trim() || `CNPJ ${r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`;
    // E-mail com cara de escritório de contabilidade é do contador que fez o cadastro.
    const accountantMail = r.email && r.niche !== 'contabilidade' && /contab|contador|escrit|assessor|fiscal|dpessoal|legaliza|abertura/.test(r.email);
    if (accountantMail) r.email = null;
    const domain = r.email ? r.email_domain : null;
    // Domínio próprio no e-mail = provável site. Se o mesmo domínio aparece em 3+ empresas
    // diferentes, é do contador/escritório que fez o cadastro, não da empresa.
    const ownDomain = domain && !isFreeMail(domain) && (r.domain_n || 1) <= 2 && !(/contab|contador|assessor|escritorio/.test(domain) && r.niche !== 'contabilidade');
    const phones = [r.tel1, r.tel2].filter(Boolean);
    const mobile = phones.find((p) => p.length === 11 && p[2] === '9');
    return {
      source: 'rfb',
      cnpj: r.cnpj,
      name,
      niche: r.niche,
      category: null,
      address: title([r.logradouro, r.numero].filter(Boolean).join(', ') + (r.complemento ? ` ${r.complemento}` : '')),
      neighborhood: r.bairro ? title(r.bairro) : null,
      city: cityName,
      lat: null,
      lon: null,
      phone: mobile || phones[0] || null,
      phone_shared: (r.phone_n || 1) >= 3 ? 1 : 0,
      email: r.email,
      website: ownDomain ? `https://${domain}` : null,
      website_derived: ownDomain ? 1 : 0,
      opened_at: r.inicio ? `${r.inicio.slice(0, 4)}-${r.inicio.slice(4, 6)}-${r.inicio.slice(6, 8)}` : null,
      porte: r.porte,
      capital: r.capital,
      mei: r.mei,
      natureza: r.natureza,
      chain: r.units >= 3 ? 1 : 0,
      has_hours: 0,
    };
  });
  return { candidates, total, municipio: cityName };
}
