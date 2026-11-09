import React, { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../api.js';
import { useStore } from '../store.jsx';
import { avatarColor, fmtMoney, initials, painClass, relTime } from '../format.js';
import LeadPanel from '../components/LeadPanel.jsx';

export default function Pipeline() {
  const { meta, seller, toast } = useStore();
  const [owner, setOwner] = useState('__all');
  const [data, setData] = useState(null);
  const [over, setOver] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => api.get(`/api/pipeline${qs({ owner })}`).then(setData).catch((e) => toast(e.message)), [owner, toast]);
  useEffect(() => { load(); }, [load]);

  const move = async (id, status) => {
    const from = data.columns.find((c) => c.leads.some((l) => l.id === id));
    if (!from || from.id === status) return;
    const lead = from.leads.find((l) => l.id === id);
    // Atualização otimista: o cartão muda de coluna na hora.
    setData((d) => ({ ...d, columns: d.columns.map((c) => c.id === from.id ? { ...c, leads: c.leads.filter((l) => l.id !== id) } : c.id === status ? { ...c, leads: [{ ...lead, status }, ...c.leads] } : c) }));
    try {
      const r = await api.patch(`/api/leads/${id}`, { status });
      if (r.retrained?.trained) toast(`Modelo reajustado com ${r.retrained.n} resultados reais.`, { ms: 5000 });
      if (status === 'ganho') { toast('Ganho registrado. Informe o valor do contrato no painel.'); setSelectedId(id); }
    } catch (e) { toast(e.message); }
    load();
  };

  const total = data?.columns.reduce((s, c) => s + c.leads.length, 0) || 0;
  return (
    <>
      <div className="page-head">
        <h1>Pipeline</h1>
        <span className="sub num">{total} em andamento · {fmtMoney(data?.wonValue || 0)} ganhos</span>
        <span style={{ flex: 1 }} />
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span>Vendedor</span>
          <select className="select" style={{ width: 200 }} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="__all">Todo o time</option>
            {(meta?.sellers || []).map((s) => <option key={s.id} value={s.name}>{s.name}{s.name === seller ? ' (você)' : ''}</option>)}
          </select>
        </label>
      </div>
      <div className="page-body" style={{ overflow: 'hidden' }}>
        {data && total === 0 ? (
          <div className="empty"><div className="inner">
            <h2>Nenhuma negociação ainda</h2>
            <p>Quando você abordar um lead pelo WhatsApp ou mudar o status dele, ele aparece aqui. Arraste os cartões entre as colunas conforme a conversa avança.</p>
            <a className="btn" href="#/fila">Abrir a fila de hoje</a>
          </div></div>
        ) : (
          <div className="board">
            {data?.columns.map((c) => (
              <section key={c.id} className="col" data-over={over === c.id}
                onDragOver={(e) => { e.preventDefault(); setOver(c.id); }}
                onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); setOver(null); const id = Number(e.dataTransfer.getData('text/plain')); if (id) move(id, c.id); }}
                aria-label={c.label}>
                <div className="col-head">
                  <span className={`status-pill`} data-s={c.id}><i /></span>{c.label}<span className="n num">{c.leads.length}</span>
                  {c.id === 'ganho' && <span className="v num">{fmtMoney(c.leads.reduce((s, l) => s + (l.dealValue || 0), 0))}</span>}
                </div>
                <div className="col-body">
                  {c.leads.map((l) => (
                    <article key={l.id} className="card" draggable data-dragging={dragId === l.id}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(l.id)); e.dataTransfer.effectAllowed = 'move'; setDragId(l.id); }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setSelectedId(l.id)}>
                      <div className="top"><b>{l.name}</b><span className={`score ${l.temperature}`}>{l.score}</span></div>
                      <div className="bottom">
                        <span className={`chip ${painClass(l.pain?.code)}`}>{l.pain?.label}</span>
                        <span className="faint">{relTime(l.updatedAt)}</span>
                        {l.owner && <span className="avatar sm" title={l.owner} style={{ background: avatarColor(l.owner) }}>{initials(l.owner)}</span>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <LeadPanel leadId={selectedId} onClose={() => { setSelectedId(null); load(); }} onChanged={() => {}} />
    </>
  );
}
