// IA que conversa com o lead pelo WhatsApp em nome da Synch (Google Gemini, plano gratuito).
import { GoogleGenAI, ApiError } from '@google/genai';
import { getSetting } from './db.js';
import { NICHE_BY_ID } from './niches.js';

export const DEFAULT_BRIEF = `A Synch cria sites profissionais para pequenos negócios: site rápido, adaptado ao celular, com botão de WhatsApp, mapa do Google, domínio próprio e boa aparição nas buscas do Google.
Objetivo da conversa: entender o negócio do cliente, mostrar como um site traz clientes novos e marcar uma conversa rápida (ligação ou videochamada de 15 minutos) com o time, ou oferecer uma prévia gratuita do site.
Preços e prazos: não informe valores. Diga que o consultor passa a proposta depois de entender o que o cliente precisa.`;

function apiKey() {
  return getSetting('geminiKey', '') || process.env.GEMINI_API_KEY || '';
}
export function aiReady() { return Boolean(apiKey()); }
export function aiModel() { return aiModels()[0]; }
/** Modelos em ordem de preferência; o primeiro que não estiver sobrecarregado responde. */
export function aiModels() {
  const list = getSetting('geminiModels', null);
  if (Array.isArray(list) && list.length) return list;
  return [getSetting('geminiModel', '') || 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);
}
const busy = (e) => (e instanceof ApiError && [500, 502, 503, 504].includes(e.status)) || /abort|timeout|timed out|deadline/i.test(`${e?.name} ${e?.message}`);
// Modelos que falharam recentemente ficam "de castigo" por 10 min: as próximas respostas vão direto para um que funciona.
const downUntil = new Map();
function orderedModels() {
  const now = Date.now();
  const all = aiModels();
  const up = all.filter((m) => (downUntil.get(m) || 0) < now);
  return up.length ? [...up, ...all.filter((m) => !up.includes(m))] : all;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const NO_QUOTA = 'O limite gratuito do Gemini acabou por agora (ele renova diariamente). A IA volta a responder quando a cota renovar.';
export function friendlyError(e) {
  if (e instanceof ApiError) {
    if (e.status === 429) return NO_QUOTA;
    if (e.status === 400 && /api key/i.test(e.message)) return 'A chave do Gemini foi recusada pelo Google. Gere outra no Google AI Studio.';
    if (e.status === 403) return 'O Google negou acesso com essa chave. Confira se a Gemini API está liberada no projeto.';
    if (e.status >= 500) return 'Os modelos grátis do Gemini estão sobrecarregados agora. A IA tenta de novo na próxima mensagem do cliente.';
  }
  return e?.message || 'erro desconhecido';
}

let cached = { key: null, ai: null };
function client() {
  const key = apiKey();
  if (!key) throw new Error('Falta a chave do Google Gemini (Configurações → WhatsApp e IA).');
  if (cached.key !== key) cached = { key, ai: new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 20_000, retryOptions: { attempts: 1 } } }) };
  return cached.ai;
}

/** Testa os modelos em paralelo (chamada mínima) e deixa de castigo os que estão travando. */
export async function probeModels() {
  if (!aiReady()) return;
  const ai = new GoogleGenAI({ apiKey: apiKey(), httpOptions: { timeout: 12_000, retryOptions: { attempts: 1 } } });
  const results = await Promise.all(aiModels().map(async (model) => {
    try { await ai.models.generateContent({ model, contents: 'ok', config: { maxOutputTokens: 5 } }); downUntil.delete(model); return `${model} ok`; }
    catch (e) { if (busy(e)) downUntil.set(model, Date.now() + 10 * 60_000); return `${model} ${e.status || e.name}`; }
  }));
  console.log('[ia] modelos Gemini:', results.join(' · '));
}

/** Escolhe o melhor modelo "Flash" disponível para a chave (são os liberados no plano grátis). */
function pickModels(names) {
  const ver = (n) => parseFloat(n.replace(/^gemini-/, '')) || 0;
  const by = (re) => names.filter((n) => re.test(n)).sort((a, b) => ver(b) - ver(a));
  const out = [...by(/^gemini-[\d.]+-flash$/), ...names.filter((n) => n === 'gemini-flash-latest'), ...by(/^gemini-[\d.]+-flash-lite$/), ...names.filter((n) => n === 'gemini-flash-lite-latest')];
  return [...new Set(out)].slice(0, 4);
}

/** Valida a chave, escolhe o modelo e faz uma chamada mínima de teste. Devolve { key, model }. */
export async function testGeminiKey(raw) {
  const key = String(raw).replace(/\s+/g, '').replace(/^["']|["']$/g, '');
  // O Google tem mais de um formato de chave (as antigas começam com "AIza"); quem decide se vale é o próprio Google.
  if (key.length < 20 || /^sk-ant-/.test(key)) throw new Error(`Isso não parece uma chave do Gemini (o texto colado tem ${key.length} caracteres). Copie a chave inteira no Google AI Studio.`);
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 15_000, retryOptions: { attempts: 1 } } });
  try {
    const names = [];
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      if (!m.supportedActions || m.supportedActions.includes('generateContent')) names.push(String(m.name).replace(/^models\//, ''));
    }
    const models = pickModels(names);
    if (!models.length) throw new Error('Essa chave não tem acesso a nenhum modelo Gemini Flash.');
    // A listagem (que exige a chave) já prova que ela vale. Não gera texto aqui: com o modelo
    // sobrecarregado isso pode demorar muito, e a IA já sabe tentar de novo na hora de responder.
    return { key, models };
  } catch (e) {
    console.error('[ia] validação da chave do Gemini falhou:', e.status, e.message);
    if (e instanceof ApiError && e.status === 429) return { key, models: aiModels(), warning: `Chave salva. ${NO_QUOTA}` };
    if (busy(e)) return { key, models: aiModels(), warning: 'Chave salva. O Gemini está sobrecarregado agora; a IA tenta de novo sozinha quando for responder.' };
    if (e instanceof ApiError && /ACCESS_TOKEN_TYPE_UNSUPPORTED/.test(e.message)) {
      throw new Error(`O Google diz que isso não é uma chave de API do Gemini, e sim outro tipo de credencial (o texto colado começa com "${key.slice(0, 4)}…"). Crie a chave em aistudio.google.com/app/apikey, no botão "Create API key".`);
    }
    if (e instanceof ApiError && (e.status === 400 || e.status === 401 || e.status === 403)) {
      throw new Error(/location|region|country/i.test(e.message) ? 'O Google não libera o Gemini gratuito nesta região.' : 'O Google recusou essa chave. Copie de novo no Google AI Studio (botão de copiar) e cole aqui.');
    }
    if (!(e instanceof ApiError)) throw new Error(e.message.startsWith('Essa chave') ? e.message : 'Não consegui falar com o Google. Verifique a internet.');
    throw new Error(`O Google respondeu com erro ${e.status}: ${String(e.message).slice(0, 200)}`);
  }
}

// Instruções fixas (sem nada que mude por conversa, para o cache do prompt funcionar).
const SYSTEM = `Você é o assistente comercial de uma empresa brasileira que vende sites, e atende o WhatsApp da empresa. Alguns contatos são donos de pequenos negócios abordados pelo time; outros chamaram a empresa por conta própria (o "Contexto do lead" diz qual é o caso).

Como escrever:
- Português do Brasil, tom cordial e direto, como um consultor de verdade no WhatsApp.
- Mensagens curtas: 1 a 3 frases. Uma pergunta por vez. Sem listas, sem markdown, no máximo um emoji quando fizer sentido.
- Responda ao que o cliente disse antes de puxar o assunto de volta para o site.
- Use só fatos do "Contexto do lead" e das "Informações da empresa". Nunca invente preços, prazos, descontos, garantias, clientes ou resultados.
- Se perguntarem se você é um robô ou uma IA, diga com honestidade que é o assistente virtual da empresa e que um consultor humano pode assumir a qualquer momento.
- Nunca peça senhas, dados bancários ou documentos.

Contato que chamou por conta própria: cumprimente, pergunte com naturalidade como pode ajudar e qual é o negócio da pessoa, sem supor nada. Se o assunto não for um possível cliente (conversa pessoal, fornecedor, cobrança, entrega, suporte de um cliente atual etc.), responda com educação que vai avisar o responsável e marque handoff = true.

Objetivo: entender o negócio, despertar interesse em ter um site e levar para um próximo passo concreto (prévia gratuita ou uma conversa de 15 minutos com o consultor).

Passe para um humano (handoff = true) quando: o cliente pedir para falar com uma pessoa; quiser negociar preço, prazo ou condições; aceitar uma reunião e for preciso combinar horário; reclamar ou parecer irritado; ou perguntar algo que as informações não cobrem. Nesse caso, a resposta avisa com naturalidade que o consultor vai continuar o atendimento em breve.

Se o cliente disser que não tem interesse ou pedir para não receber mais mensagens, agradeça em uma frase, não insista, e marque stage = "sem_interesse".

Se a última mensagem do cliente não pedir resposta (ex.: "ok", "👍", "obrigado" depois de você já ter se despedido), devolva reply vazio.`;

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Mensagem a enviar no WhatsApp. Vazio se não for preciso responder.' },
    stage: { type: 'string', enum: ['conversando', 'interessado', 'reuniao', 'sem_interesse'], description: 'Momento da negociação depois desta resposta.' },
    handoff: { type: 'boolean', description: 'true se um humano precisa assumir a conversa.' },
    handoff_reason: { type: 'string', description: 'Motivo curto do handoff, para o vendedor. Vazio se handoff = false.' },
  },
  required: ['reply', 'stage', 'handoff', 'handoff_reason'],
  additionalProperties: false,
};

function leadContext(lead) {
  if (lead.inbound) {
    return [
      'Origem: esta pessoa chamou a empresa no WhatsApp por conta própria (não foi abordada pelo time).',
      `Nome no WhatsApp: ${lead.name}`,
      lead.category && lead.category !== 'Chamou no WhatsApp' ? `Segmento: ${lead.category}` : 'Ainda não sabemos o segmento nem se é um negócio.',
    ].join('\n');
  }
  const a = lead.audit || {};
  const site = {
    none: 'não encontramos site',
    social: `o "site" é uma rede social (${a.platform || 'Instagram/Facebook'})`,
    aggregator: `o link é uma página em plataforma de terceiros (${a.platform || 'agregador'})`,
    broken: a.derived ? 'o domínio do e-mail não tem site no ar' : 'o site informado está fora do ar',
    dead_free: 'o link aponta para o business.site, desativado pelo Google',
    weak: `site com problemas: ${(a.issues || []).slice(0, 3).join('; ')}`,
    ok: 'tem site funcionando',
    unchecked: 'site não verificado',
  }[a.kind] || 'não encontramos site';
  return [
    `Empresa: ${lead.name}`,
    `Segmento: ${NICHE_BY_ID[lead.niche]?.label || lead.category || 'não informado'}`,
    `Local: ${[lead.neighborhood, lead.city].filter(Boolean).join(', ') || 'não informado'}`,
    `Situação do site: ${site}`,
    lead.rating && lead.reviews ? `Google: ${lead.rating} estrelas, ${lead.reviews} avaliações` : null,
    lead.opened_at ? `Empresa aberta em: ${lead.opened_at}` : null,
  ].filter(Boolean).join('\n');
}

/**
 * Gera a próxima mensagem da conversa.
 * @param {object} lead  linha de businesses (com audit já parseado)
 * @param {{direction:string, author:string, text:string}[]} history  mensagens em ordem
 */
export async function nextReply(lead, history, { company = 'Synch', seller = null } = {}) {
  const brief = getSetting('aiBrief', '') || DEFAULT_BRIEF;
  const transcript = history.slice(-40).map((m) => `${m.direction === 'in' ? 'CLIENTE' : company.toUpperCase()}: ${m.text}`).join('\n');
  const user = [
    `Empresa que você representa: ${company}${seller ? ` (consultor responsável: ${seller})` : ''}`,
    `Informações da empresa:\n${brief}`,
    `Contexto do lead:\n${leadContext(lead)}`,
    `Conversa no WhatsApp até agora:\n${transcript}`,
    'Escreva a próxima mensagem para o cliente.',
  ].join('\n\n');

  const config = {
    systemInstruction: SYSTEM,
    responseMimeType: 'application/json',
    responseJsonSchema: SCHEMA,
    temperature: 0.6,
    maxOutputTokens: 2048,
  };
  // Plano grátis: modelos ficam sobrecarregados (503/504) com frequência. Cai para o próximo modelo na hora.
  let res;
  let lastErr;
  for (const model of orderedModels()) {
    try {
      res = await client().models.generateContent({ model, contents: user, config });
      downUntil.delete(model);
      break;
    } catch (e) {
      lastErr = e;
      if (!busy(e)) throw e;
      console.warn(`[ia] ${model} ocupado (${e.status || e.name}); tentando o próximo modelo`);
      downUntil.set(model, Date.now() + 10 * 60_000);
    }
  }
  if (!res) throw lastErr;

  const text = res.text;
  if (!text) {
    // bloqueado pelos filtros do Google ou resposta vazia
    return { reply: '', stage: 'conversando', handoff: true, handoff_reason: 'A IA não conseguiu responder esta mensagem. Responda você.' };
  }
  try {
    const out = JSON.parse(text);
    return {
      reply: String(out.reply || '').trim().slice(0, 1500),
      stage: ['conversando', 'interessado', 'reuniao', 'sem_interesse'].includes(out.stage) ? out.stage : 'conversando',
      handoff: Boolean(out.handoff),
      handoff_reason: String(out.handoff_reason || '').slice(0, 300),
    };
  } catch {
    return { reply: '', stage: 'conversando', handoff: true, handoff_reason: 'A IA devolveu uma resposta incompleta. Responda você.' };
  }
}
