// Roteiros de abordagem: a dor detectada vira o gancho da conversa.
import { NICHE_BY_ID } from './niches.js';
import { classifyPhone, monthsSince } from './scoring.js';

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

const fmtRating = (r) => String(r).replace('.', ',');

function socialProof(b) {
  if (b.rating && b.reviews >= 10) return `${fmtRating(b.rating)} estrelas com ${b.reviews.toLocaleString('pt-BR')} avaliações no Google`;
  if (b.reviews >= 3) return `${b.reviews} avaliações no Google`;
  return null;
}

function competitorLine(b) {
  const pct = Math.round((b.competitor_share || 0) * 100);
  if (pct >= 40) return `Dos ${NICHE_BY_ID[b.niche]?.label?.toLowerCase() || 'concorrentes'} que encontrei aqui perto, ${pct}% já têm site próprio.`;
  return null;
}

export function buildApproach(b, { seller = '', company = 'Synch' } = {}) {
  const a = b.audit || {};
  const niche = NICHE_BY_ID[b.niche];
  const nicheTerm = (niche?.google?.[0] || niche?.label || 'o seu serviço').toLowerCase();
  const where = b.neighborhood || b.city || 'na região';
  const proof = socialProof(b);
  const comp = competitorLine(b);
  const me = seller ? `Aqui é ${seller}, da ${company}.` : `Aqui é da ${company}.`;
  const name = b.name;
  const sources = Array.isArray(b.sources) ? b.sources : JSON.parse(b.sources || '[]');
  const fromGoogle = sources.includes('google');

  let hook, value;
  switch (a.kind) {
    case 'broken':
      if (a.derived) {
        const host = (() => { try { return new URL(a.url).hostname.replace(/^www\./, ''); } catch { return 'o domínio de vocês'; } })();
        hook = `Vi que a ${name} usa o domínio ${host} no e-mail, mas quando a gente digita ${host} no navegador não abre nenhum site.`;
        value = 'Vocês já pagam pelo domínio: dá para colocar um site profissional nesse mesmo endereço, com WhatsApp e localização, sem trocar o e-mail.';
        break;
      }
      hook = `${fromGoogle ? `Fui pesquisar a ${name} no Google e o site de vocês` : `Tentei abrir o site da ${name} e ele`} não está abrindo${a.issues?.[0] ? ` (${a.issues[0].replace(/^O site informado está fora do ar: /, '')})` : ''}.`;
      value = `${proof ? `Com ${proof}, ` : ''}muita gente que tenta abrir o site deve estar caindo nesse erro e indo para outro lugar. Consigo colocar um site novo no ar rápido, já com botão de WhatsApp.`;
      break;
    case 'dead_free':
      hook = `Vi que o link de site da ${name} no Google ainda aponta para o business.site, que o Google desativou em 2024: hoje ele mostra "página não encontrada".`;
      value = `${proof ? `Vocês têm ${proof}, ` : ''}então vale muito ter um endereço que funcione. A gente faz o site novo e ajusta o link no Google para vocês.`;
      break;
    case 'social':
      hook = `Vi que o link de site da ${name}${fromGoogle ? ' no Google' : ''} leva para o ${a.platform}.`;
      value = `${a.platform} é ótimo para quem já segue vocês, mas quem pesquisa "${nicheTerm} em ${where}" no Google procura um site para conferir serviços, endereço e chamar no WhatsApp. ${comp || ''}`.trim();
      break;
    case 'aggregator':
      hook = `Vi que o link da ${name}${fromGoogle ? ' no Google' : ''} leva para a página de vocês no ${a.platform}.`;
      value = `Ali vocês dividem a vitrine com concorrentes${/ifood|rappi|aiqfome|booking|airbnb/i.test(a.platform) ? ' e pagam comissão em cada pedido' : ''}. Um site próprio leva o cliente direto para vocês.`;
      break;
    case 'weak': {
      const issues = (a.issues || []).slice(0, 2).map((s) => s.charAt(0).toLowerCase() + s.slice(1));
      hook = `Dei uma olhada no site da ${name} e notei alguns pontos: ${issues.join('; ')}.`;
      value = `Hoje a maioria das pessoas abre pelo celular e o Google prioriza sites rápidos e seguros. ${comp || 'Dá para resolver isso com um site novo.'}`;
      break;
    }
    case 'ok':
      hook = `Vi o site da ${name} e queria trocar uma ideia sobre como trazer mais clientes pelo Google.`;
      value = 'Trabalhamos com sites focados em conversão e WhatsApp.';
      break;
    default:
      hook = `Encontrei a ${name}${fromGoogle ? ' no Google' : ''}${proof ? ` (${proof})` : ''}, mas não achei um site de vocês.`;
      if (!fromGoogle && monthsSince(b.opened_at) != null && monthsSince(b.opened_at) < 12) {
        hook = `Vi que a ${name} abriu recentemente: parabéns pela empresa nova! Procurei vocês na internet e ainda não achei um site.`;
      }
      value = `Hoje quem pesquisa "${nicheTerm} em ${where}" acaba indo para quem tem site. ${comp || ''}`.trim();
  }

  value = value.charAt(0).toUpperCase() + value.slice(1);
  const ask = 'Posso te mandar um exemplo de como ficaria o site de vocês? Sem compromisso.';
  const whatsappText = `${greeting()}! ${me} ${hook} ${value} ${ask}`.replace(/\s+/g, ' ').trim();

  const phone = classifyPhone(b.phone);
  const whatsappUrl = phone.kind === 'mobile' ? `https://wa.me/${phone.digits}?text=${encodeURIComponent(whatsappText)}` : null;
  const telUrl = phone.digits ? `tel:+${phone.digits.startsWith('55') ? phone.digits : `55${phone.digits}`}` : null;

  const call = [
    { step: 'Abertura', text: `${greeting()}, falo com o responsável pela ${name}? ${me}` },
    { step: 'Gancho', text: hook },
    { step: 'Pergunta', text: a.kind === 'none' || a.kind === 'social'
      ? 'Hoje, quando alguém novo procura vocês, chega mais pelo Instagram, pelo Google ou por indicação?'
      : 'Vocês sabiam disso? Quem cuida do site hoje?' },
    { step: 'Valor', text: value },
    { step: 'Próximo passo', text: 'Posso montar uma prévia do site e te mostrar em 15 minutos, amanhã ou quinta?' },
  ];

  const objections = [
    { q: '“Já tenho Instagram, não preciso.”', a: 'Instagram fala com quem já te segue. O site é o que aparece para quem ainda não te conhece e está pesquisando no Google agora.' },
    { q: '“Está caro / agora não dá.”', a: 'Dá para começar com uma página única, com WhatsApp e localização, e crescer depois. Um cliente novo por mês já paga o site.' },
    { q: '“Meu sobrinho faz.”', a: 'Ótimo! Posso te mandar a lista do que eu vi que precisa corrigir, e se preferir a gente entrega pronto, com domínio e manutenção.' },
  ];

  const emailOk = b.email && b.email.includes('@');
  const mailtoUrl = emailOk ? `mailto:${b.email}?subject=${encodeURIComponent(`Site para a ${name}`)}&body=${encodeURIComponent(whatsappText)}` : null;
  return { whatsappText, whatsappUrl, telUrl, mailtoUrl, call, objections, bestTime: niche?.best || 'ter–qui, 9h–11h', phoneKind: phone.kind, phoneShared: Boolean(b.phone_shared) };
}
