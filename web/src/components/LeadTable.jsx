import React from 'react';
import { ArrowDown, Star, MessageCircle, Phone, PhoneOff, Mail } from 'lucide-react';
import { avatarColor, fmtInt, fmtRating, initials, painClass, phoneDisplay } from '../format.js';

const COLS = [
  { id: 'score', label: 'Nota', sort: 'score', w: 70 },
  { id: 'name', label: 'Estabelecimento', sort: 'name' },
  { id: 'pain', label: 'Dor' },
  { id: 'google', label: 'Google', sort: 'reviews' },
  { id: 'contact', label: 'Contato' },
  { id: 'status', label: 'Status' },
  { id: 'owner', label: 'Responsável' },
];

export function StatusPill({ status, statuses }) {
  const label = statuses?.find((s) => s.id === status)?.label || status;
  return <span className="status-pill" data-s={status}><i />{label}</span>;
}

export default function LeadTable({ leads, selectedId, onSelect, sort, onSort, statuses, freshIds, compact, showGoogle = true }) {
  // Com o painel aberto, Google/Contato/Responsável já estão no painel: a tabela fica só com o que compara leads.
  const hidden = new Set([...(compact ? ['google', 'contact', 'owner'] : []), ...(showGoogle ? [] : ['google'])]);
  const cols = COLS.filter((c) => !hidden.has(c.id));
  const show = (id) => !hidden.has(id);
  return (
    <table className="leads">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c.id} data-col={c.id} style={c.w ? { width: c.w } : undefined} aria-sort={c.sort && sort === c.sort ? 'descending' : undefined}>
              {c.sort ? (
                <button type="button" onClick={() => onSort(c.sort)}>
                  {c.label}{sort === c.sort && <ArrowDown size={12} strokeWidth={2} />}
                </button>
              ) : c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {leads.map((l) => (
          <tr key={l.id} aria-selected={l.id === selectedId} className={freshIds?.has(l.id) ? 'enter' : undefined} onClick={() => onSelect(l.id)}>
            <td><span className={`score ${l.temperature}`} title={`Propensão ${l.score}/100`}>{l.score}</span></td>
            <td>
              <div className="biz">
                <b>{l.name}</b>
                <span>{[l.nicheLabel, l.neighborhood].filter(Boolean).join(' · ')}{l.chain ? ' · rede' : ''}</span>
                <span className={`chip pain-inline ${painClass(l.pain?.code)}`}>{l.pain?.label}</span>
              </div>
            </td>
            <td data-col="pain"><span className={`chip ${painClass(l.pain?.code)}`}>{l.pain?.label}</span></td>
            {show('google') && <td>
              {l.reviews != null && l.sources?.includes('google') ? (
                <span className="rating"><Star size={13} fill="currentColor" strokeWidth={0} />{fmtRating(l.rating)} <span className="faint">({fmtInt(l.reviews)})</span></span>
              ) : <span className="faint">sem dados</span>}
            </td>}
            {show('contact') && <td data-col="contact">
              {l.phoneKind === 'mobile' ? <span className="contact" title="Celular (WhatsApp)"><MessageCircle size={14} strokeWidth={1.75} className="wa-dot" /><span className="phone-text">{phoneDisplay(l.phone)}</span></span>
                : l.phoneKind === 'landline' ? <span className="contact" title="Telefone fixo"><Phone size={14} strokeWidth={1.75} /><span className="phone-text">{phoneDisplay(l.phone)}</span></span>
                : l.email ? <span className="contact" title={l.email}><Mail size={14} strokeWidth={1.75} /><span className="phone-text">e-mail</span></span>
                : <span className="contact faint" title="Sem telefone"><PhoneOff size={14} strokeWidth={1.75} /><span className="phone-text">sem telefone</span></span>}
            </td>}
            <td data-col="status"><StatusPill status={l.status} statuses={statuses} /></td>
            {show('owner') && <td data-col="owner">
              {l.owner ? <span className="owner"><span className="avatar sm" style={{ background: avatarColor(l.owner) }}>{initials(l.owner)}</span>{l.owner}</span> : <span className="faint">—</span>}
            </td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
