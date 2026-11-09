import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Phone, CalendarClock, UserRound, Inbox, SkipForward } from 'lucide-react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { fmtInt, fmtRating, painClass } from '../format.js';
import LeadPanel from '../components/LeadPanel.jsx';

function Row({ l, i, onOpen, onSkip }) {
  return (
    <div className="q-row" onClick={() => onOpen(l.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(l.id)}>
      <span className="rank">{i + 1}</span>
      <span className={`score ${l.temperature}`}>{l.score}</span>
      <div style={{ minWidth: 0 }}>
        <div className="biz" style={{ maxWidth: 'none' }}>
          <b>{l.name}</b>
          <span>{[l.nicheLabel, l.neighborhood].filter(Boolean).join(' · ')}{l.reviews != null && l.sources?.includes('google') ? ` · ${fmtRating(l.rating)} ★ (${fmtInt(l.reviews)})` : ''}</span>
        </div>
      </div>
      <span className={`chip ${painClass(l.pain?.code)}`}>{l.pain?.label}</span>
      <div className="acts" onClick={(e) => e.stopPropagation()}>
        <button className="btn sm ghost icon" title="Pular para amanhã" onClick={() => onSkip(l)}><SkipForward size={14} strokeWidth={1.75} /></button>
        <button className="btn sm" onClick={() => onOpen(l.id)}>
          {l.phoneKind === 'mobile' ? <MessageCircle size={14} strokeWidth={1.75} /> : <Phone size={14} strokeWidth={1.75} />}Abordar
        </button>
      </div>
    </div>
  );
}

export default function Queue() {
  const { seller, toast } = useStore();
  const [q, setQ] = useState(null);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => api.get('/api/queue').then((r) => { setQ(r); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load, seller]);
  useEffect(() => { window.addEventListener('synch:queue', load); return () => window.removeEventListener('synch:queue', load); }, [load]);

  const skip = async (l) => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    await api.patch(`/api/leads/${l.id}`, { nextActionAt: iso, ...(seller && !l.owner ? { owner: seller } : {}), ...(l.status === 'novo' ? { status: 'contatado' } : {}) }).catch((e) => toast(e.message));
    toast(`${l.name} foi para amanhã.`);
    load();
  };

  const used = q ? q.contactedToday : 0;
  const cap = q?.capacity || 25;
  const planned = q ? q.followUps.length + q.fresh.length : 0;

  return (
    <>
      <div className="page-head">
        <h1>Fila de hoje</h1>
        <span className="sub">{seller ? `Os leads que mais valem uma abordagem agora, para ${seller}.` : 'Escolha quem está prospectando no canto inferior esquerdo para montar a sua fila.'}</span>
      </div>
      <div className="page-body">
        <div className="queue">
          {err && <div className="notice error" style={{ borderRadius: 8, border: 0 }}>{err}</div>}
          {q && (
            <>
              <div className="cap-bar">
                <div>
                  <h2 className="num">{fmtInt(used)} de {fmtInt(cap)} abordagens feitas hoje</h2>
                  <p>{planned ? `${planned} na fila cabem no seu dia${q.overflow ? `; ${fmtInt(q.overflow)} leads bons ficam para os próximos dias` : ''}.` : 'Nenhum lead pendente: faça uma nova busca em Prospectar.'}</p>
                </div>
                {!seller && <a className="btn sm" href="#/configuracoes"><UserRound size={14} strokeWidth={1.75} />Cadastrar vendedor</a>}
                <div className="meter" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={cap}>
                  <i style={{ width: `${Math.min(100, (used / cap) * 100)}%`, background: 'var(--accent)' }} />
                </div>
              </div>

              {q.followUps.length > 0 && (
                <div className="q-section">
                  <h3><CalendarClock size={15} strokeWidth={1.75} />Retornos combinados para hoje <span className="muted num">{q.followUps.length}</span></h3>
                  <div className="q-list">{q.followUps.map((l, i) => <Row key={l.id} l={l} i={i} onOpen={setSelectedId} onSkip={skip} />)}</div>
                </div>
              )}

              <div className="q-section">
                <h3>Novos leads, do mais quente ao mais frio <span className="muted num">{q.fresh.length}</span></h3>
                {q.fresh.length ? (
                  <div className="q-list">{q.fresh.map((l, i) => <Row key={l.id} l={l} i={i + q.followUps.length} onOpen={setSelectedId} onSkip={skip} />)}</div>
                ) : (
                  <div className="empty" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div className="inner">
                      <span className="ico"><Inbox size={20} strokeWidth={1.75} /></span>
                      <h2>{used >= cap ? 'Meta do dia batida' : 'Sem leads novos com telefone'}</h2>
                      <p>{used >= cap ? 'Você usou toda a sua capacidade de hoje. Os próximos leads aparecem amanhã.' : 'A fila só mostra leads quentes e mornos com telefone. Busque outra região ou segmento.'}</p>
                      {used < cap && <a className="btn" href="#/prospectar">Ir para Prospectar</a>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <LeadPanel leadId={selectedId} onClose={() => { setSelectedId(null); load(); }} onChanged={() => {}} />
    </>
  );
}
