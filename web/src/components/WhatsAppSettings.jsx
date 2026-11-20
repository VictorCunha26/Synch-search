import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, ExternalLink, Smartphone } from 'lucide-react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';

const phoneOf = (jid) => {
  const d = (jid || '').split('@')[0].split(':')[0];
  return d.length >= 12 ? `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, -4)}-${d.slice(-4)}` : d;
};

export default function WhatsAppSettings({ settings, reload }) {
  const { wa, setWa, toast, refreshMeta } = useStore();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [keyErr, setKeyErr] = useState('');
  const [brief, setBrief] = useState(settings?.aiBrief || '');
  useEffect(() => { setBrief(settings?.aiBrief || ''); }, [settings?.aiBrief]);
  const [ignore, setIgnore] = useState('');
  const ignoreSaved = (settings?.aiIgnore || []).join('\n');
  useEffect(() => { setIgnore(ignoreSaved); }, [ignoreSaved]);
  const setAnswerAll = (v) => call(async () => {
    if (v && !window.confirm('A IA vai responder qualquer pessoa que mandar mensagem para este WhatsApp, inclusive contatos pessoais. Coloque na lista abaixo os números que ela não deve atender. Ligar agora?')) return;
    await api.put('/api/settings', { aiAnswerAll: v }); toast(v ? 'A IA agora atende todos os números.' : 'A IA atende só as empresas em que você ligar.'); reload(); refreshMeta();
  });

  const call = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const connect = () => call(async () => {
    const r = await api.post('/api/wa/connect'); setWa((w) => ({ ...w, ...r }));
    // o primeiro QR leva alguns segundos para chegar do WhatsApp
    for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 1000)); const st = await api.get('/api/wa'); setWa(st); if (st.status !== 'connecting') break; }
  });
  const disconnect = () => { if (window.confirm('Desconectar o WhatsApp? A IA para de responder até você conectar de novo.')) call(async () => { const r = await api.post('/api/wa/disconnect', { logout: true }); setWa((w) => ({ ...w, ...r })); }); };

  const saveKey = (value) => call(async () => {
    setKeyErr('');
    let r;
    try { r = await api.put('/api/settings', { geminiKey: value }); } catch (e) { setKeyErr(e.message); return; }
    setKey(''); reload(); refreshMeta();
    if (r?.warning) setKeyErr(r.warning); else toast(value ? 'Chave do Gemini validada e salva.' : 'Chave removida.');
  });

  const st = wa?.status || 'off';
  return (
    <section className="card-box">
      <header>
        <h2>WhatsApp e IA</h2>
        <p>Conecte o WhatsApp da empresa uma vez. Em cada lead, ligue <b>IA responde</b> e ela conversa com o cliente sozinha enquanto o Synch Search estiver rodando, passando para você quando ele pedir preço, reunião ou uma pessoa.</p>
      </header>
      <div className="content">
        <div>
          <h3 className="sub">1. WhatsApp</h3>
          {st === 'open' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="inline-ok"><CheckCircle2 size={15} strokeWidth={1.75} />Conectado</span>
              <span className="num faint">{phoneOf(wa.me)}</span>
              <span style={{ flex: 1 }} />
              <button className="btn sm ghost" onClick={disconnect} disabled={busy}>Desconectar</button>
            </div>
          )}
          {st === 'qr' && wa.qr && (
            <div className="wa-qr">
              <img src={wa.qr} alt="QR code para parear o WhatsApp" />
              <ol>
                <li>No celular da empresa, abra o WhatsApp.</li>
                <li>Toque em <b>Mais opções</b> (⋮) ou <b>Configurações</b> e depois em <b>Dispositivos conectados</b>.</li>
                <li>Toque em <b>Conectar dispositivo</b> e aponte a câmera para este código.</li>
                <li className="faint">O código se renova sozinho a cada 20 segundos.</li>
              </ol>
            </div>
          )}
          {st === 'connecting' && <p className="muted" style={{ margin: 0, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><span className="spinner sm" />Conectando ao WhatsApp…</p>}
          {st === 'off' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn primary" onClick={connect} disabled={busy}><Smartphone size={15} strokeWidth={1.75} />Conectar WhatsApp</button>
              {wa?.error && <span className="inline-err" role="alert">{wa.error}</span>}
            </div>
          )}
          <p className="faint" style={{ margin: '10px 0 0', fontSize: 12 }}>Usa o mesmo pareamento do WhatsApp Web, não é a API oficial da Meta. Converse só com quem você abordou e evite mandar muitas mensagens iniciais por dia, para o número não ser bloqueado.</p>
        </div>

        <div>
          <h3 className="sub">2. Chave da IA (Google Gemini, grátis)</h3>
          {settings?.hasAiKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="inline-ok"><CheckCircle2 size={15} strokeWidth={1.75} />Chave salva</span>
              <code className="num faint">{settings.aiKeyMasked}</code>
              <span style={{ flex: 1 }} />
              <button className="btn sm ghost" onClick={() => saveKey('')} disabled={busy}>Remover chave</button>
            </div>
          ) : settings?.aiKeyFromEnv ? (
            <span className="inline-ok"><CheckCircle2 size={15} strokeWidth={1.75} />Usando a chave da variável GEMINI_API_KEY</span>
          ) : (
            <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (key.trim()) saveKey(key.trim()); }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <KeyRound size={15} strokeWidth={1.75} className="faint" style={{ position: 'absolute', left: 10, top: 8.5 }} />
                <input className="input" style={{ paddingLeft: 32 }} type="password" name="gemini-api-key" autoComplete="new-password" spellCheck={false} data-1p-ignore data-lpignore="true" placeholder="Cole a chave do Gemini" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Chave da API do Google Gemini" />
              </div>
              <button className="btn primary" disabled={!key.trim() || busy}>{busy ? 'Validando…' : 'Validar e salvar'}</button>
            </form>
          )}
          {keyErr && <p className="inline-err" role="alert" style={{ margin: '8px 0 0' }}>{keyErr}</p>}
          <p className="faint" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Crie a chave grátis no <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio <ExternalLink size={11} strokeWidth={1.75} /></a> (botão <b>Create API key</b>). O plano gratuito tem limite diário de uso e o Google pode usar as conversas para melhorar os produtos dele.{settings?.hasAiKey && settings?.aiModel ? ` Modelo em uso: ${settings.aiModel}.` : ''}
          </p>
        </div>

        <div>
          <h3 className="sub">3. Quem a IA atende</h3>
          <div className="choice" role="radiogroup" aria-label="Quem a IA atende">
            <label className={!settings?.aiAnswerAll ? 'on' : ''}>
              <input type="radio" name="answerAll" checked={!settings?.aiAnswerAll} onChange={() => setAnswerAll(false)} disabled={busy} />
              <span><b>Só as empresas em que eu ligar a IA</b><small>Você liga o interruptor “IA responde” em cada empresa. As outras conversas do WhatsApp são ignoradas.</small></span>
            </label>
            <label className={settings?.aiAnswerAll ? 'on' : ''}>
              <input type="radio" name="answerAll" checked={Boolean(settings?.aiAnswerAll)} onChange={() => setAnswerAll(true)} disabled={busy} />
              <span><b>Todos os números que mandarem mensagem</b><small>Quem chamar e ainda não estiver no Synch Search vira um contato novo no Pipeline (coluna Respondeu), já com a IA atendendo. Grupos são sempre ignorados.</small></span>
            </label>
          </div>
          {settings?.aiAnswerAll && (
            <div style={{ marginTop: 10 }}>
              <label className="field"><span>Números que a IA nunca atende (um por linha, com DDD)</span>
                <textarea className="textarea num" rows={3} value={ignore} onChange={(e) => setIgnore(e.target.value)} placeholder={'11 99999-1234\n21 98888-5678'} />
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button className="btn" disabled={busy || ignore === ignoreSaved} onClick={() => call(async () => { await api.put('/api/settings', { aiIgnore: ignore.split(/[\n,;]+/) }); toast('Lista salva.'); reload(); })}>Salvar lista</button>
                <span className="faint" style={{ fontSize: 12 }}>Use para família, amigos e fornecedores. Se você responder alguém pelo celular, a IA também sai daquela conversa.</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="sub">4. O que a IA sabe sobre a {settings?.company || 'empresa'}</h3>
          <textarea className="textarea" rows={7} value={brief} onChange={(e) => setBrief(e.target.value)} aria-label="Instruções para a IA" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn" disabled={busy || brief === settings?.aiBrief} onClick={() => call(async () => { await api.put('/api/settings', { aiBrief: brief }); toast('Instruções salvas.'); reload(); })}>Salvar instruções</button>
            <span className="faint" style={{ fontSize: 12 }}>Coloque serviços, preços (se quiser que ela informe), prazos e como agendar. Ela nunca inventa o que não estiver aqui.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
