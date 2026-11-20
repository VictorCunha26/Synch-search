// IA que conversa com o lead pelo WhatsApp em nome da Synch (Google Gemini, plano gratuito).
import { GoogleGenAI, ApiError } from '@google/genai';
import { getSetting } from './db.js';
import { NICHE_BY_ID } from './niches.js';
import { solutionFor } from './approach.js';

export const DEFAULT_BRIEF = `A Synch é uma empresa de tecnologia que cria soluções para pequenas e médias empresas, com o objetivo de facilitar processos e aumentar o faturamento.
O que fazemos: sites profissionais (rápidos, adaptados ao celular, com WhatsApp e boa aparição no Google); automações (atendimento e agendamento automático no WhatsApp, lembretes, cobrança, orçamentos, integração entre ferramentas e planilhas); e sistemas sob medida (ordem de serviço, controle de pedidos, estoque, clientes, agenda, painéis de gestão).
Como vendemos: primeiro entendemos o principal problema da empresa, depois propomos a solução que resolve. Não empurramos um produto pronto.
Objetivo da conversa: entender o principal problema, conduzir para a solução e marcar uma reunião rápida (ligação ou videochamada) para o consultor mostrar como funcionaria e negociar o preço.
Preços e prazos: não informe valores. O consultor apresenta a solução e o preço na reunião.`;

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

/** Começo do aviso que a IA deixa para o vendedor quando a conversa precisa dele (a IA segue ligada). */
export const HANDOFF_PREFIX = 'Precisa de você: ';
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
const SYSTEM = `Você é o assistente comercial de uma empresa brasileira de tecnologia (sites, automações e sistemas sob medida para pequenas e médias empresas) e atende o WhatsApp da empresa. Alguns contatos são donos de pequenos negócios abordados pelo time; outros chamaram a empresa por conta própria (o "Contexto do lead" diz qual é o caso).

Como escrever:
- Português do Brasil, tom cordial e direto, como um consultor de verdade no WhatsApp.
- Mensagens curtas: 1 a 3 frases. Uma pergunta por vez. Sem listas, sem markdown, no máximo um emoji quando fizer sentido.
- Responda ao que o cliente disse antes de puxar o assunto de volta para o negócio dele.
- Use só fatos do "Contexto do lead" e das "Informações da empresa". Nunca invente preços, prazos, descontos, garantias, clientes ou resultados.
- Se perguntarem se você é um robô ou uma IA, diga com honestidade que é o assistente virtual da empresa e que um consultor humano pode assumir a qualquer momento.
- Nunca peça senhas, dados bancários ou documentos.

Contato que chamou por conta própria: cumprimente, pergunte com naturalidade como pode ajudar e qual é o negócio da pessoa, sem supor nada. Se o assunto não for um possível cliente (conversa pessoal, fornecedor, cobrança, entrega, suporte de um cliente atual etc.), responda com educação que vai avisar o responsável e marque handoff = true.

A conversa tem três etapas, nesta ordem. Não pule etapas.
1. Entender o problema. Não ofereça nenhuma solução, produto ou exemplo ainda. Pergunte, uma coisa por vez: qual é o principal problema ou o que mais toma tempo da equipe; com que frequência acontece; quanto tempo, dinheiro ou clientes isso custa; como resolvem hoje. Mostre que entendeu repetindo o problema com as palavras do cliente. Só passe para a etapa 2 quando souber o problema e o impacto dele (em geral depois de 2 ou 3 respostas do cliente).
2. Conduzir para a solução. Em uma ou duas frases, explique de forma simples como um site, uma automação ou um sistema resolveria aquele problema específico, ligando ao que o cliente contou. Pode se inspirar no "Exemplo de solução do segmento" do contexto, mas adapte ao problema real. Não ofereça site para quem já tem um que funciona.
3. Marcar a reunião. Convide para uma conversa rápida (15 a 20 minutos, ligação ou videochamada) em que o consultor mostra como ficaria e passa o preço. Sugira dois horários genéricos (ex.: "amanhã de manhã ou quinta à tarde?"). Quando o cliente aceitar ou sugerir um horário, confirme com naturalidade que o consultor vai entrar em contato para fechar o horário, e marque stage = "reuniao" e handoff = true.

Se o cliente perguntar o preço antes da reunião: diga que depende do que for preciso e que o consultor apresenta a solução e o valor na reunião, e já convide para ela. Se ele insistir em negociar valor por mensagem, passe para um humano.
Se o problema não for algo que tecnologia resolve, seja honesto, agradeça e não force a venda.

Chame o consultor (handoff = true) quando: o cliente aceitar a reunião; pedir para falar com uma pessoa; insistir em negociar preço, prazo ou condições; reclamar ou parecer irritado; ou perguntar algo que as informações não cobrem. Nesse caso, a resposta avisa com naturalidade que o consultor vai entrar em contato em breve. Chamar o consultor NÃO encerra o seu atendimento: você continua respondendo o cliente normalmente.

Depois que o consultor já foi chamado (o contexto diz "Consultor já avisado"): continue atendendo com simpatia. Responda dúvidas com o que as informações cobrem, mantenha o cliente engajado, confirme que o consultor vai falar com ele, e não recomece as perguntas nem repita a oferta de reunião se ela já foi aceita. Não repita o aviso do consultor em toda mensagem. Marque handoff = true de novo só se surgir um motivo novo.

Mensagens marcadas como CONSULTOR foram escritas por uma pessoa do time. Siga o que ela disse: não contradiga, não repita o que ela já perguntou ou combinou, e continue a conversa a partir dali. Se o consultor marcou horário, preço ou condições, respeite e não renegocie.

Resposta negativa: se o cliente disser que não tem interesse, pedir para não receber mais mensagens, ou recusar de forma clara e definitiva ("não preciso", "não quero", "já resolvemos isso"), agradeça em uma frase, não insista, e marque stage = "sem_interesse" (o lead vira perdido). Uma objeção ("agora não dá", "está corrido", "depois a gente vê") ainda não é recusa: responda com uma pergunta leve sobre o problema; se ele recusar de novo, aí sim marque "sem_interesse".

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
      lead.ai_state?.startsWith(HANDOFF_PREFIX) ? `Consultor já avisado (${lead.ai_state.slice(HANDOFF_PREFIX.length).split('. A IA')[0]}). Continue atendendo até ele assumir.` : null,
    ].filter(Boolean).join('\n');
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
    lead.ai_state?.startsWith(HANDOFF_PREFIX) ? `Consultor já avisado (${lead.ai_state.slice(HANDOFF_PREFIX.length).split('. A IA')[0]}). Continue atendendo até ele assumir.` : null,
    solutionFor(lead.niche) ? `Exemplo de solução do segmento (só para a etapa 2, depois de entender o problema): ${solutionFor(lead.niche)}` : null,
  ].filter(Boolean).join('\n');
}

/**
 * Gera a próxima mensagem da conversa.
 * @param {object} lead  linha de businesses (com audit já parseado)
 * @param {{direction:string, author:string, text:string}[]} history  mensagens em ordem
 */
export async function nextReply(lead, history, { company = 'Synch', seller = null } = {}) {
  const brief = getSetting('aiBrief', '') || DEFAULT_BRIEF;
  const transcript = history.slice(-40).map((m) => `${m.direction === 'in' ? 'CLIENTE' : m.author === 'ia' ? 'VOCÊ (IA)' : `CONSULTOR ${m.author && m.author !== 'vendedor' ? `${m.author} ` : ''}(humano)`}: ${m.text}`).join('\n');
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
