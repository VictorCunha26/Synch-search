import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, Store } from 'lucide-react';
import { useDismiss } from '../store.jsx';

const MAX = 8;

export default function NichePicker({ niches, value, onChange, id }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useDismiss(open, () => setOpen(false));

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const out = {};
    for (const n of niches) {
      const hay = `${n.label} ${n.group}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (term && !hay.includes(term)) continue;
      (out[n.group] ||= []).push(n);
    }
    return out;
  }, [niches, q]);

  const labels = value.map((v) => niches.find((n) => n.id === v)?.label).filter(Boolean);
  const toggle = (nid) => {
    if (value.includes(nid)) onChange(value.filter((v) => v !== nid));
    else if (value.length < MAX) onChange([...value, nid]);
  };

  return (
    <div className="pop-anchor" ref={ref}>
      <button id={id} type="button" className="niche-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Store size={15} strokeWidth={1.75} className="faint" />
        {labels.length ? (
          <span className="val">{labels.slice(0, 2).join(', ')}{labels.length > 2 ? ` +${labels.length - 2}` : ''}</span>
        ) : <span className="val ph">Escolha os segmentos</span>}
        <ChevronDown size={15} strokeWidth={1.75} className="faint" />
      </button>
      {open && (
        <div className="popover niche-pop" role="dialog" aria-label="Segmentos">
          <div className="head">
            <div style={{ position: 'relative' }}>
              <Search size={15} strokeWidth={1.75} className="faint" style={{ position: 'absolute', left: 9, top: 8.5 }} />
              <input autoFocus className="input" style={{ paddingLeft: 30 }} placeholder="Buscar segmento" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="list">
            {Object.entries(groups).map(([g, list]) => (
              <div key={g}>
                <div className="group">{g}</div>
                {list.map((n) => (
                  <label key={n.id} className="check">
                    <input type="checkbox" checked={value.includes(n.id)} disabled={!value.includes(n.id) && value.length >= MAX} onChange={() => toggle(n.id)} />
                    {n.label}
                    <span className={`tier ${n.tier}`} title={n.tier === 'A' ? 'Ticket alto: mais chance de fechar' : n.tier === 'B' ? 'Ticket médio' : 'Ticket baixo'}>{n.tier === 'A' ? 'Ticket alto' : n.tier === 'B' ? 'Médio' : 'Baixo'}</span>
                  </label>
                ))}
              </div>
            ))}
            {!Object.keys(groups).length && <p className="muted" style={{ fontSize: 13, padding: '12px 0' }}>Nenhum segmento com “{q}”.</p>}
          </div>
          <div className="foot">
            <span className="num">{value.length} de {MAX} selecionados</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {value.length > 0 && <button type="button" className="btn ghost sm" onClick={() => onChange([])}>Limpar</button>}
              <button type="button" className="btn sm" onClick={() => setOpen(false)}>Pronto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
