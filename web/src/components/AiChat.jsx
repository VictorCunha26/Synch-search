import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, AlertTriangle, Smartphone, KeyRound } from 'lucide-react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';

const hhmm = (at) => {
  const d = new Date(`${at.replace(' ', 'T')}Z`);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

/** Conversa do lead no WhatsApp conectado + interruptor da IA. */
export default function AiChat({ lead, onChanged }) {
  const { wa, toast } = useStore();
  const [messages, setMessages] = useState([]);
  const [ai, setAi] = useState(lead.ai || { enabled: false, state: null });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  const load = () => api.get(`/api/leads/${lead.id}/messages`).then((r) => { setMessages(r.messages); setAi(r.ai); }).catch(() => {});
  useEffect(() => { setMessages([]); setAi(lead.ai || { enabled: false, state: null }); load(); }, [lead.id]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.detail.businessId !== lead.id) return;
      setMessages((ms) => (ms.some((m) => m.id === e.detail.message.id) ? ms : [...ms, e.detail.message]));
    };
    const onLead = (e) => { if (e.detail.businessId === lead.id) { setAi(e.detail.ai); onChanged?.(); } };
    window.addEventListener('synch:wa-message', onMsg);
    window.addEventListener('synch:wa-lead', onLead);
    return () => { window.removeEventListener('synch:wa-message', onMsg); window.removeEventListener('synch:wa-lead', onLead); };
  }, [lead.id]);

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);

  const connected = wa?.status === 'open';
  const hasMobile = lead.phoneKind === 'mobile' || Boolean(lead.ai?.jid);

  const toggle = async (enabled) => {
    setBusy(true);
    try {
      const r = await api.post(`/api/leads/${lead.id}/ai`, { enabled });
      setAi(r.ai);
      toast(enabled ? 'IA ligada para este cliente.' : 'IA desligada. Você responde.');
      onChanged?.();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  };

  const send = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try { const m = await api.post(`/api/leads/${lead.id}/messages`, { text }); setDraft(''); if (m?.id) setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m])); onChanged?.(); }
    catch (err) { toast(err.message); } finally { setBusy(false); }
  };

  let blocker = null;
  if (!hasMobile) blocker = { icon: Smartphone, text: 'Este lead não tem celular cadastrado, então não dá para conversar pelo WhatsApp.' };
  else if (!connected) blocker = { icon: Smartphone, text: wa?.status === 'connecting' ? 'Conectando ao WhatsApp…' : 'Conecte o WhatsApp da empresa para mandar mensagens e ligar a IA.', link: true };
  else if (!wa?.aiReady) blocker = { icon: KeyRound, text: 'Cadastre a chave do Google Gemini para a IA poder responder.', link: true };

  return (
    <div className="section ai-chat">
      <h3>
        <Bot size={14} strokeWidth={1.75} />Atendimento no WhatsApp
        <span className="right ai-toggle">
          <span className={ai.enabled ? 'on' : ''}>{ai.enabled ? 'IA respondendo' : 'IA desligada'}</span>
          <Switch checked={ai.enabled} disabled={busy || (!ai.enabled && Boolean(blocker))} onChange={toggle} label="IA responde este cliente" />
        </span>
      </h3>

      {blocker && (
        <p className="ai-note">
          <blocker.icon size={14} strokeWidth={1.75} />
          <span>{blocker.text}{blocker.link && <> <a href="#/configuracoes">Abrir configurações</a></>}</span>
        </p>
      )}
      {!blocker && ai.enabled && !ai.state && (
        <p className="ai-note on"><span className="pulse" aria-hidden="true" />A IA responde este cliente sozinha enquanto o Synch Search estiver rodando. Se ele pedir preço, reunião ou uma pessoa, ela avisa e passa para você.</p>
      )}
      {ai.state && (
        <p className="ai-note warn" role="status"><AlertTriangle size={14} strokeWidth={1.75} /><span>{ai.state}</span></p>
      )}

      {messages.length > 0 ? (
        <div className="thread" ref={listRef} aria-label="Conversa no WhatsApp" role="log">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.direction}`}>
              <div className="txt">{m.text}</div>
              <div className="by">{m.direction === 'in' ? 'Cliente' : m.author === 'ia' ? 'IA' : m.author} · {hhmm(m.at)}</div>
            </div>
          ))}
        </div>
      ) : (
        !blocker && <p className="faint" style={{ margin: '0 0 10px', fontSize: 12.5 }}>Nenhuma mensagem ainda. Mande a abordagem abaixo com <b>Enviar agora</b>; quando o cliente responder, a IA continua a conversa.</p>
      )}

      {connected && hasMobile && (
        <form className="composer" onSubmit={send}>
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ai.enabled ? 'Escrever você mesmo (a IA continua ligada)…' : 'Responder o cliente…'} aria-label="Mensagem para o cliente" />
          <button className="btn icon primary" disabled={busy || !draft.trim()} title="Enviar"><Send size={15} strokeWidth={1.75} /></button>
        </form>
      )}
    </div>
  );
}
