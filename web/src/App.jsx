import React, { useEffect, useState } from 'react';
import { Search, ListChecks, KanbanSquare, Gauge, Settings as SettingsIcon } from 'lucide-react';
import { StoreProvider, useStore, useHashRoute } from './store.jsx';
import { api, setSeller } from './api.js';
import { initials } from './format.js';
import Prospect from './pages/Prospect.jsx';
import Queue from './pages/Queue.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Model from './pages/Model.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  { id: 'prospectar', label: 'Prospectar', icon: Search },
  { id: 'fila', label: 'Fila de hoje', icon: ListChecks, badge: 'queue' },
  { id: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { id: 'pontuacao', label: 'Como pontuamos', icon: Gauge },
  { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon },
];

function Sidebar({ route, queueCount }) {
  const { meta, seller } = useStore();
  const sellers = meta?.sellers || [];
  return (
    <aside className="sidebar">
      <a className="brand" href="#/prospectar" aria-label="Synch Search — início">
        <img className="brand-mark" src="/synch-mark.svg" alt="" />
        <div>Synch Search<small>Prospecção de sites</small></div>
      </a>
      <nav aria-label="Principal" style={{ display: 'contents' }}>
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className="nav-item" aria-current={route === n.id ? 'page' : undefined}>
            <n.icon size={16} strokeWidth={1.75} />
            {n.label}
            {n.badge === 'queue' && queueCount > 0 && <span className="nav-badge num">{queueCount}</span>}
          </a>
        ))}
      </nav>
      <div className="sidebar-foot">
        <a className="source-status" href="#/configuracoes" title="Fontes de dados">
          <span className={`dot ${meta?.rfb?.total ? 'on' : ''}`} />
          <span>
            {meta?.rfb?.running ? 'Importando base CNPJ…' : meta?.rfb?.total ? `Base CNPJ · ${meta.rfb.ufs.length === 27 ? 'Brasil' : meta.rfb.ufs.join(', ')}` : 'Importar base CNPJ'}
            <small>{meta?.google ? 'Google Places conectado' : 'Google Places desligado'}</small>
          </span>
        </a>
        <label className="seller-pick">
          <span className="avatar" style={{ opacity: seller ? 1 : 0.6 }}>{seller ? initials(seller) : '?'}</span>
          <span className="sr-only">Vendedor ativo</span>
          <select value={seller} onChange={(e) => {
            if (e.target.value === '__add') { window.location.hash = '#/configuracoes'; return; }
            setSeller(e.target.value);
          }}>
            <option value="">Escolher vendedor</option>
            {sellers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            <option value="__add">+ Adicionar vendedor…</option>
          </select>
        </label>
      </div>
    </aside>
  );
}

function Shell() {
  const route = useHashRoute();
  const { seller } = useStore();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => api.get('/api/queue').then((q) => alive && setQueueCount(q.followUps.length + q.fresh.length)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('synch:queue', load);
    return () => { alive = false; clearInterval(t); window.removeEventListener('synch:queue', load); };
  }, [seller]);

  const Page = { prospectar: Prospect, fila: Queue, pipeline: Pipeline, pontuacao: Model, configuracoes: Settings }[route] || Prospect;
  return (
    <div className="app">
      <Sidebar route={route} queueCount={queueCount} />
      <main className="main"><Page /></main>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
