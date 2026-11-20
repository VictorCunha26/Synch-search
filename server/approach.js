// Roteiros de abordagem. A Synch vende tecnologia para pequenas e médias empresas
// (sites, automações e sistemas sob medida), então a mensagem não oferece um produto:
// apresenta a empresa, mostra que conhecemos o segmento e abre a conversa perguntando
// qual é o principal problema do cliente.
import { NICHE_BY_ID } from './niches.js';
import { classifyPhone, monthsSince } from './scoring.js';

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// Exemplo concreto do que a Synch resolve em cada segmento. NÃO entra na primeira mensagem
// (ela só pergunta o problema): a IA usa como referência depois de entender o que o cliente precisa.
const SOLUTIONS = {
  dentista: 'Para clínicas odontológicas, por exemplo, criamos agendamento online com lembrete automático no WhatsApp, o que reduz as faltas e libera a recepção.',
  clinica: 'Para clínicas, por exemplo, automatizamos agendamento, confirmação e lembrete de consulta pelo WhatsApp, o que reduz faltas e tira trabalho da recepção.',
  estetica: 'Para clínicas de estética, por exemplo, automatizamos agendamento, lembretes e o retorno de clientes para novas sessões, tudo pelo WhatsApp.',
  fisioterapia: 'Para fisioterapia e pilates, por exemplo, criamos controle de pacotes e agenda com lembrete automático, para ninguém esquecer sessão nem pagamento.',
  psicologia: 'Para consultórios de psicologia, por exemplo, automatizamos agendamento, lembretes e cobrança das sessões, sem você precisar ficar no WhatsApp.',
  nutricao: 'Para nutricionistas, por exemplo, automatizamos agendamento, lembretes e o acompanhamento dos pacientes entre as consultas.',
  veterinario: 'Para clínicas veterinárias, por exemplo, automatizamos lembrete de vacina e retorno pelo WhatsApp, o que traz o cliente de volta sem esforço da equipe.',
  otica: 'Para óticas, por exemplo, automatizamos o aviso de óculos pronto e o lembrete de revisão anual, que traz o cliente de volta para comprar de novo.',
  advocacia: 'Para escritórios de advocacia, por exemplo, automatizamos a triagem de novos clientes no WhatsApp e o aviso de andamento dos processos.',
  contabilidade: 'Para escritórios de contabilidade, por exemplo, automatizamos a cobrança de documentos dos clientes e o envio de guias, que tomam muito tempo da equipe todo mês.',
  imobiliaria: 'Para imobiliárias, por exemplo, criamos atendimento automático no WhatsApp que qualifica o interessado e já agenda a visita.',
  arquitetura: 'Para escritórios de arquitetura, por exemplo, criamos portfólio online e automação de orçamentos, para não perder tempo com quem não tem perfil.',
  seguros: 'Para corretoras, por exemplo, automatizamos o aviso de renovação das apólices e a cotação inicial pelo WhatsApp.',
  fotografia: 'Para fotógrafos, por exemplo, criamos agenda online com orçamento automático e entrega das fotos em galeria própria.',
  salao: 'Para salões de beleza, por exemplo, criamos agendamento online com lembrete automático, para a agenda ficar cheia sem você parar para responder mensagem.',
  barbearia: 'Para barbearias, por exemplo, criamos agendamento online com lembrete automático e plano de assinatura mensal para os clientes.',
  unhas: 'Para esmalterias, por exemplo, criamos agendamento online com lembrete automático, para a agenda encher sem você parar o atendimento.',
  academia: 'Para academias, por exemplo, automatizamos cobrança de mensalidade, aviso de inadimplência e o contato com quem parou de treinar.',
  idiomas: 'Para escolas de idiomas, por exemplo, automatizamos matrícula, cobrança de mensalidade e o atendimento de quem pede informação no WhatsApp.',
  escola: 'Para escolas, por exemplo, automatizamos matrícula, cobrança de mensalidade e a comunicação com os pais pelo WhatsApp.',
  autoescola: 'Para autoescolas, por exemplo, automatizamos o agendamento de aulas e o atendimento de quem pergunta preço no WhatsApp.',
  cursos: 'Para escolas de cursos, por exemplo, automatizamos inscrição, cobrança e o atendimento de quem pede informação no WhatsApp.',
  oficina: 'Para oficinas, por exemplo, criamos sistema de orçamento e ordem de serviço com aviso automático ao cliente quando o carro fica pronto.',
  autopecas: 'Para lojas de autopeças, por exemplo, automatizamos o atendimento de cotação pelo WhatsApp e o controle de estoque.',
  estetica_auto: 'Para estéticas automotivas, por exemplo, criamos agendamento online e lembrete automático para o cliente voltar na próxima lavagem.',
  moveis: 'Para lojas de móveis planejados, por exemplo, automatizamos o atendimento inicial e o acompanhamento de orçamentos, para nenhum cliente esfriar.',
  construcao: 'Para lojas de material de construção, por exemplo, automatizamos orçamentos pelo WhatsApp e o controle de pedidos e entregas.',
  marmoraria: 'Para marmorarias e vidraçarias, por exemplo, criamos sistema de orçamento e acompanhamento de pedidos, do pedido até a instalação.',
  reformas: 'Para empresas de reformas e serviços, por exemplo, criamos orçamento rápido pelo WhatsApp e controle das obras e da equipe.',
  dedetizacao: 'Para empresas de dedetização e limpeza, por exemplo, automatizamos agendamento e o lembrete de manutenção periódica, que gera venda recorrente.',
  restaurante: 'Para restaurantes, por exemplo, criamos cardápio digital com pedido direto no WhatsApp, sem pagar comissão para aplicativo.',
  pizzaria: 'Para pizzarias, por exemplo, criamos pedido online direto no WhatsApp, sem comissão de aplicativo, e campanhas automáticas para os clientes pedirem de novo.',
  confeitaria: 'Para confeitarias, por exemplo, criamos catálogo online com encomenda pelo WhatsApp e controle dos pedidos por data de entrega.',
  padaria: 'Para padarias, por exemplo, criamos pedido online de encomendas e controle de estoque e vendas.',
  lanchonete: 'Para lanchonetes e cafés, por exemplo, criamos cardápio digital com pedido direto no WhatsApp, sem comissão de aplicativo.',
  bar: 'Para bares, por exemplo, criamos cardápio digital, reservas online e campanhas automáticas para os clientes voltarem.',
  petshop: 'Para pet shops, por exemplo, criamos agendamento de banho e tosa com lembrete automático, para o cliente voltar todo mês.',
  moda: 'Para lojas de roupas, por exemplo, criamos catálogo online com venda pelo WhatsApp e avisos automáticos de novidades para os clientes.',
  joalheria: 'Para joalherias, por exemplo, criamos catálogo online e lembretes automáticos de datas especiais dos clientes, que geram vendas.',
  floricultura: 'Para floriculturas, por exemplo, criamos pedido online com entrega agendada e lembrete automático de datas especiais.',
  tecnologia: 'Para assistências técnicas, por exemplo, criamos sistema de ordem de serviço com aviso automático ao cliente quando o aparelho fica pronto.',
  grafica: 'Para gráficas, por exemplo, automatizamos orçamentos pelo WhatsApp e o acompanhamento dos pedidos até a entrega.',
  mercado: 'Para mercados e empórios, por exemplo, criamos pedido online com entrega e controle de estoque e vendas.',
  hospedagem: 'Para pousadas e hotéis, por exemplo, criamos reserva direta no site e no WhatsApp, sem pagar comissão para as plataformas.',
  eventos: 'Para buffets e espaços de eventos, por exemplo, automatizamos orçamento, agenda de datas e o acompanhamento de cada festa.',
  transportadora: 'Para transportadoras, por exemplo, criamos sistema de cotação de frete e rastreio com aviso automático ao cliente.',
  distribuidora: 'Para distribuidoras, por exemplo, criamos catálogo de pedidos para os clientes, integrado ao estoque, e cobrança automática.',
  veiculos: 'Para lojas de veículos, por exemplo, criamos atendimento automático no WhatsApp que qualifica o interessado e agenda o test drive.',
  laboratorio: 'Para laboratórios, por exemplo, automatizamos agendamento de exames e o envio dos resultados pelo WhatsApp.',
  manipulacao: 'Para farmácias de manipulação, por exemplo, automatizamos orçamento de receitas pelo WhatsApp e o aviso de pedido pronto.',
  viagens: 'Para agências de viagem, por exemplo, automatizamos cotação, atendimento no WhatsApp e o acompanhamento de cada cliente até a viagem.',
  provedor: 'Para provedores de internet, por exemplo, automatizamos atendimento de suporte, segunda via de boleto e aviso de cobrança pelo WhatsApp.',
  confeccao: 'Para confecções, por exemplo, criamos sistema de pedidos e controle de produção, para saber em que etapa está cada encomenda.',
};
export function solutionFor(niche) { return SOLUTIONS[niche] || null; }

const fmtRating = (r) => String(r).replace('.', ',');

/** Uma observação real sobre a empresa, quando temos uma. Mostra que não é mensagem em massa. */
function observation(b) {
  const a = b.audit || {};
  const sources = Array.isArray(b.sources) ? b.sources : JSON.parse(b.sources || '[]');
  const fromGoogle = sources.includes('google');
  if (a.kind === 'broken') {
    if (a.derived) {
      const host = (() => { try { return new URL(a.url).hostname.replace(/^www\./, ''); } catch { return 'o domínio de vocês'; } })();
      return `Reparei que vocês usam o domínio ${host} no e-mail, mas o site nesse endereço não abre.`;
    }
    return 'Reparei que o site de vocês não está abrindo, e isso pode estar fazendo vocês perderem clientes.';
  }
  if (a.kind === 'dead_free') return 'Reparei que o link de site de vocês no Google ainda aponta para o business.site, que o Google desativou: quem clica cai numa página de erro.';
  if (a.kind === 'aggregator' && /ifood|rappi|aiqfome|booking|airbnb/i.test(a.platform || '')) return `Reparei que as vendas de vocês passam pelo ${a.platform}, que cobra comissão em cada pedido.`;
  if (fromGoogle && b.reviews >= 30) {
    const proof = b.rating ? `${fmtRating(b.rating)} estrelas e ${b.reviews.toLocaleString('pt-BR')} avaliações` : `${b.reviews.toLocaleString('pt-BR')} avaliações`;
    return `Vi que vocês têm ${proof} no Google, então imagino que o movimento seja grande e o WhatsApp não pare.`;
  }
  const months = monthsSince(b.opened_at);
  if (months != null && months < 12) return 'Vi que a empresa abriu há pouco tempo: parabéns! É a melhor fase para organizar os processos.';
  if (a.kind === 'weak' && a.issues?.[0]) return `Dei uma olhada no site de vocês e notei um ponto: ${a.issues[0].charAt(0).toLowerCase()}${a.issues[0].slice(1).replace(/\.$/, '')}.`;
  return null;
}

/** Nome fantasia curto entra na frase; razão social ("... Ltda", "Sociedade Individual de ...") vira "a sua empresa". */
function shortName(name) {
  if (!name) return null;
  const legal = /\b(ltda|eireli|epp|s\/?a|sociedade|limitada|me)\b\.?$|\bsociedade\b/i.test(name.trim());
  const shouting = name === name.toUpperCase() && /[A-Z]{4}/.test(name);
  return legal || shouting || name.split(/\s+/).length > 5 ? null : name;
}

export function buildApproach(b, { seller = '', company = 'Synch' } = {}) {
  const niche = NICHE_BY_ID[b.niche];
  const hi = greeting();
  const intro = seller
    ? `Meu nome é ${seller}, sou da ${company}, uma empresa de tecnologia que cria soluções para pequenas e médias empresas, com o objetivo de facilitar processos e aumentar o faturamento.`
    : `Somos a ${company}, uma empresa de tecnologia que cria soluções para pequenas e médias empresas, com o objetivo de facilitar processos e aumentar o faturamento.`;
  const obs = observation(b);
  const nm = shortName(b.name);
  const ask = `Gostaria de saber: qual é o principal problema que ${nm ? `a ${nm}` : 'a sua empresa'} enfrenta hoje?`;
  const whatsappText = [`${hi}! Tudo bem?`, intro, obs, ask].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const phone = classifyPhone(b.phone);
  const whatsappUrl = phone.kind === 'mobile' ? `https://wa.me/${phone.digits}?text=${encodeURIComponent(whatsappText)}` : null;
  const telUrl = phone.digits ? `tel:+${phone.digits.startsWith('55') ? phone.digits : `55${phone.digits}`}` : null;

  const call = [
    { step: 'Abertura', text: `${hi}, falo com o responsável ${nm ? `pela ${nm}` : 'pela empresa'}?` },
    { step: 'Apresentação', text: intro },
    obs && { step: 'Gancho', text: obs },
    { step: 'Pergunta', text: `Qual é hoje o principal problema ${nm ? `da ${nm}` : 'da empresa'}? O que mais toma tempo de vocês no dia a dia?` },
    { step: 'Aprofundar', text: 'Com que frequência isso acontece? Quanto tempo ou dinheiro isso custa para vocês hoje? E como vocês resolvem isso agora?' },
    { step: 'Próximo passo', text: 'Pelo que você me contou, dá para resolver isso. Quero marcar uma conversa rápida para o nosso consultor te mostrar como funcionaria e já passar os valores. Amanhã ou quinta fica bom?' },
  ].filter(Boolean);

  const objections = [
    { q: '“Já tenho site.”', a: 'Ótimo! A gente não faz só site, trabalhamos com o que estiver travando a empresa. Hoje, o que mais toma tempo de vocês no dia a dia?' },
    { q: '“Não preciso, está tudo funcionando.”', a: 'Que bom! A pergunta é quanto tempo vocês gastam com tarefas repetitivas, como responder as mesmas dúvidas no WhatsApp ou montar orçamento na mão. Tem alguma tarefa assim que te incomoda hoje?' },
    { q: '“Está caro / agora não dá.”', a: 'A gente começa pelo problema que mais pesa, com uma solução do tamanho da empresa. O consultor mostra as opções e o preço na reunião, sem compromisso.' },
    { q: '“Já uso planilha / um sistema pronto.”', a: 'Perfeito, não precisa trocar nada. O que ainda dá trabalho mesmo com a planilha ou o sistema?' },
  ];

  const emailOk = b.email && b.email.includes('@');
  const mailtoUrl = emailOk ? `mailto:${b.email}?subject=${encodeURIComponent(`Tecnologia para a ${b.name}`)}&body=${encodeURIComponent(whatsappText)}` : null;
  return { whatsappText, whatsappUrl, telUrl, mailtoUrl, call, objections, bestTime: niche?.best || 'ter–qui, 9h–11h', phoneKind: phone.kind, phoneShared: Boolean(b.phone_shared) };
}
