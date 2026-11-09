import React, { useEffect, useState } from 'react';
import { CheckCircle2, Trash2, UserPlus, KeyRound, ExternalLink } from 'lucide-react';
import { api, setSeller } from '../api.js';
import { useStore } from '../store.jsx';
import { avatarColor, initials } from '../format.js';
import RfbImport from '../components/RfbImport.jsx';

export default function Settings() {
  const { meta, refreshMeta, seller, toast } = useStore();
  const [s, setS] = useState(null);
  const [key, setKey] = useState('');
  const [keyState, setKeyState] = useState({ busy: false, error: '' });
  const [company, setCompany] = useState('');
  const [newSeller, setNewSeller] = useState({ name: '', capacity: 25 });

  const load = () => api.get('/api/settings').then((r) => { setS(r); setCompany(r.company); });
  useEffect(() => { load(); }, []);

  const saveKey = async (value) => {
    setKeyState({ busy: true, error: '' });
    try {
      await api.put('/api/settings', { googleKey: value });
      setKey('');
      setKeyState({ busy: false, error: '' });
      toast(value ? 'Chave do Google validada e salva.' : 'Chave removida.');
      load(); refreshMeta();
    } catch (e) { setKeyState({ busy: false, error: e.message }); }
  };

  const addSeller = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/api/sellers', newSeller);
      if (!seller) setSeller(r.name);
      setNewSeller({ name: '', capacity: 25 });
      refreshMeta();
      toast(`${r.name} adicionado ao time.`);
    } catch (err) { toast(err.message); }
  };

  return (
    <>
      <div className="page-head"><h1>Configurações</h1></div>
      <div className="page-body">
        <div className="settings">
          <RfbImport />

          <section className="card-box">
            <header>
              <h2>Google Places</h2>
              <p>Com a chave, cada busca traz até 60 comércios por termo, com nota, número de avaliações, telefone e o site informado no Google. Sem ela, o Synch Search usa só o OpenStreetMap, que é gratuito mas tem poucos comércios no Brasil.</p>
            </header>
            <div className="content">
              {s?.hasGoogleKey ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="inline-ok"><CheckCircle2 size={15} strokeWidth={1.75} />Conectado</span>
                  <code className="num faint">{s.googleKeyMasked}</code>
                  <span style={{ flex: 1 }} />
                  <button className="btn sm ghost" onClick={() => saveKey('')}>Remover chave</button>
                </div>
              ) : (
                <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); if (key.trim()) saveKey(key.trim()); }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <KeyRound size={15} strokeWidth={1.75} className="faint" style={{ position: 'absolute', left: 10, top: 8.5 }} />
                    <input className="input" style={{ paddingLeft: 32 }} type="password" autoComplete="off" placeholder="Cole a chave da API (começa com AIza…)" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Chave da API do Google" />
                  </div>
                  <button className="btn primary" disabled={!key.trim() || keyState.busy}>{keyState.busy ? 'Validando…' : 'Validar e salvar'}</button>
                </form>
              )}
              {keyState.error && <p className="inline-err" role="alert" style={{ margin: 0 }}>{keyState.error}</p>}
              <ol className="howto">
                <li>Acesse o <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noreferrer">Google Cloud Console <ExternalLink size={11} strokeWidth={1.75} /></a> e crie um projeto (precisa de uma conta de faturamento).</li>
                <li>Ative a <b>Places API (New)</b> no projeto.</li>
                <li>Em <b>Credenciais</b>, crie uma chave de API e restrinja o uso à Places API.</li>
                <li>Cole a chave acima. Cada termo de busca usa até 3 requisições; o Google oferece uma cota gratuita mensal. Confira os preços atuais na <a href="https://developers.google.com/maps/billing-and-pricing/pricing" target="_blank" rel="noreferrer">tabela do Google Maps Platform</a>.</li>
              </ol>
            </div>
          </section>

          <section className="card-box">
            <header>
              <h2>Time comercial</h2>
              <p>Cada vendedor tem uma capacidade diária de abordagens. A fila de hoje respeita esse número e joga o excedente para os próximos dias.</p>
            </header>
            <div className="content">
              <div>
                {(meta?.sellers || []).map((v) => (
                  <div className="seller-row" key={v.id}>
                    <span className="avatar" style={{ background: avatarColor(v.name) }}>{initials(v.name)}</span>
                    <span>{v.name}{v.name === seller && <span className="faint"> · você</span>}</span>
                    <span className="muted num">{v.capacity} abordagens/dia</span>
                    <button className="btn ghost sm icon" title={`Remover ${v.name}`} onClick={async () => { await api.del(`/api/sellers/${v.id}`); if (v.name === seller) setSeller(''); refreshMeta(); }}><Trash2 size={14} strokeWidth={1.75} /></button>
                  </div>
                ))}
                {!meta?.sellers?.length && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhum vendedor ainda. Adicione você mesmo primeiro.</p>}
              </div>
              <form style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: 8, alignItems: 'end' }} onSubmit={addSeller}>
                <label className="field"><span>Nome</span><input className="input" required value={newSeller.name} onChange={(e) => setNewSeller({ ...newSeller, name: e.target.value })} placeholder="Ex.: Victor" /></label>
                <label className="field"><span>Abordagens por dia</span><input className="input num" type="number" min={1} max={200} value={newSeller.capacity} onChange={(e) => setNewSeller({ ...newSeller, capacity: Number(e.target.value) })} /></label>
                <button className="btn"><UserPlus size={15} strokeWidth={1.75} />Adicionar</button>
              </form>
            </div>
          </section>

          <section className="card-box">
            <header>
              <h2>Empresa</h2>
              <p>Nome usado nas mensagens de abordagem.</p>
            </header>
            <div className="content">
              <form style={{ display: 'flex', gap: 8 }} onSubmit={async (e) => { e.preventDefault(); await api.put('/api/settings', { company }); toast('Nome salvo.'); refreshMeta(); }}>
                <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Nome da empresa" />
                <button className="btn">Salvar</button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
