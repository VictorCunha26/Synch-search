import React, { useEffect, useRef, useState } from 'react';
import {
  Mail, ChevronUp, ChevronDown, X, MapPin, ExternalLink, Globe, MessageCircle, Phone, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Info, Clock, Copy,
} from 'lucide-react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { TEMP_LABEL, fmtInt, fmtRating, fmtMoney, phoneDisplay, relTime, avatarColor, initials } from '../format.js';

function ScoreBreakdown({ lead }) {
  const parts = lead.explanation?.parts || [];
  const base = lead.explanation?.base ?? 0;
  const max = Math.max(10, ...parts.map((p) => Math.abs(p.points)));
  return (
    <div>
      <div className="why" role="list">
        {parts.map((p) => {
          const w = `${(Math.abs(p.points) / max) * 50}%`;
          const pos = p.points > 0;
          return (
            <div className="why-row" role="listitem" key={p.key}>
              <span className="lbl" title={p.label}>{p.label}</span>
              <span className="track" aria-hidden="true"><i className={pos ? 'pos' : 'neg'} style={{ width: w }} /></span>
              <span className={`pts ${pos ? 'pos' : 'neg'}`}>{pos ? '+' : '−'}{Math.abs(p.points)}</span>
            </div>
          );
        })}
      </div>
      <div className="why-total">
        <span title="Nota de um comércio médio antes de olhar os sinais medidos deste lead">Ponto de partida <span className="why-base num">{base}</span> + sinais</span>
        <span>{lead.score}</span>
      </div>
    </div>
  );
}

function Findings({ lead }) {
  const a = lead.audit || {};
  const ok = a.kind === 'ok';
  const items = a.issues?.length ? a.issues : a.kind === 'none' ? ['Nenhum site cadastrado no Google nem no OpenStreetMap'] : [];
  return (
    <>
      <ul className="findings">
        {items.map((t, i) => (
          <li key={i}>
            {a.kind === 'broken' || a.kind === 'dead_free' ? <XCircle size={15} strokeWidth={1.75} color="var(--hot)" /> : <AlertTriangle size={15} strokeWidth={1.75} color="var(--warm)" />}
            <span>{t}</span>
          </li>
        ))}
        {ok && <li><CheckCircle2 size={15} strokeWidth={1.75} color="var(--pos)" /><span>Site funcionando, com HTTPS e adaptado ao celular. Pouca dor para explorar.</span></li>}
      </ul>
      {(a.ms || a.generator || a.copyrightYear || a.title) && (
        <dl className="kv">
          {a.title && <><dt>Título</dt><dd>{a.title}</dd></>}
          {a.ms != null && <><dt>Resposta</dt><dd className="num">{(a.ms / 1000).toFixed(1).replace('.', ',')} s</dd></>}
          {a.generator && <><dt>Feito com</dt><dd>{a.generator}</dd></>}
          {a.copyrightYear && <><dt>Ano no rodapé</dt><dd className="num">{a.copyrightYear}</dd></>}
          {a.hasWhats != null && <><dt>Botão WhatsApp</dt><dd>{a.hasWhats ? 'Tem' : 'Não tem'}</dd></>}
        </dl>
      )}
    </>
  );
}

function Approach({ lead, onAction }) {
  const [tab, setTab] = useState('whats');
  const [text, setText] = useState(lead.approach?.whatsappText || '');
  const { toast } = useStore();
  useEffect(() => { setText(lead.approach?.whatsappText || ''); }, [lead.id, lead.approach?.whatsappText]);
  const ap = lead.approach || {};
  const waBase = ap.whatsappUrl ? ap.whatsappUrl.split('?')[0] : null;

  return (
    <div className="section">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'whats'} onClick={() => setTab('whats')}>WhatsApp</button>
        <button role="tab" aria-selected={tab === 'call'} onClick={() => setTab('call')}>Roteiro de ligação</button>
        <button role="tab" aria-selected={tab === 'obj'} onClick={() => setTab('obj')}>Objeções</button>
      </div>
      {tab === 'whats' && (
        <>
          <textarea className="textarea" rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label="Mensagem de WhatsApp" />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {waBase ? (
              <a className="btn wa" style={{ flex: 1 }} href={`${waBase}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" onClick={() => onAction('whatsapp')}>
                <MessageCircle size={16} strokeWidth={1.75} />Abrir no WhatsApp
              </a>
            ) : (
              <span className="btn" style={{ flex: 1 }} aria-disabled="true" title="O telefone cadastrado é fixo ou não existe">
                <MessageCircle size={16} strokeWidth={1.75} />Sem celular para WhatsApp
              </span>
            )}
            {ap.mailtoUrl && <a className="btn icon" title="Enviar por e-mail" href={`${ap.mailtoUrl.split('&body=')[0]}&body=${encodeURIComponent(text)}`} onClick={() => onAction('email')}><Mail size={15} strokeWidth={1.75} /></a>}
            <button className="btn icon" title="Copiar mensagem" onClick={() => { navigator.clipboard?.writeText(text); toast('Mensagem copiada.'); }}><Copy size={15} strokeWidth={1.75} /></button>
          </div>
        </>
      )}
      {tab === 'call' && (
        <ol className="call-steps">
          {ap.call?.map((s) => <li key={s.step}><b>{s.step}</b>{s.text}</li>)}
        </ol>
      )}
      {tab === 'obj' && ap.objections?.map((o) => <div className="objection" key={o.q}><b>{o.q}</b>{o.a}</div>)}
      <div className="besttime"><Clock size={14} strokeWidth={1.75} />Melhor horário para este segmento: {ap.bestTime}</div>
    </div>
  );
}

export default function LeadPanel({ leadId, onClose, onChanged, docked = false, onStep, position }) {
  const { meta, toast } = useStore();
  const [lead, setLead] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editSite, setEditSite] = useState(false);
  const [siteDraft, setSiteDraft] = useState('');
  const notesRef = useRef(null);

  const load = (id = leadId) => api.get(`/api/leads/${id}`).then((l) => { setLead(l); setError(''); }).catch((e) => setError(e.message));

  useEffect(() => {
    if (!leadId) return;
    setEditSite(false);
    load(leadId);
  }, [leadId]);

  const patch = async (body, msg) => {
    try {
      const r = await api.patch(`/api/leads/${lead.id}`, body);
      setLead((l) => ({ ...l, ...r.lead }));
      onChanged?.(r.lead);
      if (r.retrained?.trained) toast(`Modelo reajustado com ${r.retrained.n} resultados reais. Notas atualizadas.`, { ms: 5000 });
      else if (msg) toast(msg);
      window.dispatchEvent(new Event('synch:queue'));
      load(lead.id);
    } catch (e) { toast(e.message); }
  };

  const onAction = (kind) => {
    patch({ event: kind, ...(lead.status === 'novo' ? { status: 'contatado' } : {}) }, lead.status === 'novo' ? 'Marcado como contatado.' : null);
  };

  const reaudit = async () => {
    setBusy(true);
    try { const l = await api.post(`/api/leads/${lead.id}/reaudit`); setLead((x) => ({ ...x, ...l })); onChanged?.(l); load(lead.id); toast('Site verificado de novo.'); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const saveSite = async () => {
    setBusy(true);
    try { const l = await api.patch(`/api/leads/${lead.id}/website`, { website: siteDraft }); setLead((x) => ({ ...x, ...l })); onChanged?.(l); setEditSite(false); load(lead.id); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  };

  const open = Boolean(leadId);
  const l = lead && lead.id === leadId ? lead : null;
  const sellers = meta?.sellers || [];

  return (
    <aside className={`panel${docked ? ' docked' : ''}`} data-open={open} aria-hidden={!open} aria-label="Detalhes do lead">
      {open && !l && !error && <div className="empty"><div className="spinner" /></div>}
      {open && error && <div className="empty"><div className="inner"><p>{error}</p><button className="btn" onClick={() => load()}>Tentar de novo</button></div></div>}
      {l && (
        <>
          <div className="panel-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{l.name}</h2>
              <div className="meta">{[l.nicheLabel, l.neighborhood, l.city].filter(Boolean).join(' · ')}{l.chain ? ' · franquia/rede' : ''}</div>
              <div className="links">
                {l.mapsUrl ? <a href={l.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={13} strokeWidth={1.75} />Google Maps</a>
                  : l.lat && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name} ${l.address || ''} ${l.city || ''}`)}`} target="_blank" rel="noreferrer"><MapPin size={13} strokeWidth={1.75} />Procurar no Maps</a>}
                {l.website && <a href={l.audit?.url || l.website} target="_blank" rel="noreferrer"><Globe size={13} strokeWidth={1.75} />{l.websiteDerived ? 'Domínio do e-mail' : 'Site informado'}<ExternalLink size={11} strokeWidth={1.75} /></a>}
                {l.phone && <a href={l.approach?.telUrl} onClick={() => onAction('ligacao')}><Phone size={13} strokeWidth={1.75} />{phoneDisplay(l.phone)}</a>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
              {onStep && (
                <>
                  <button className="btn ghost icon" onClick={() => onStep(-1)} disabled={position?.index <= 0} aria-label="Lead anterior" title="Lead anterior (↑)"><ChevronUp size={17} strokeWidth={1.75} /></button>
                  <button className="btn ghost icon" onClick={() => onStep(1)} disabled={position?.index >= position?.total - 1} aria-label="Próximo lead" title="Próximo lead (↓)"><ChevronDown size={17} strokeWidth={1.75} /></button>
                </>
              )}
              <button className="btn ghost icon" onClick={onClose} aria-label="Fechar painel" title="Fechar (Esc)"><X size={17} strokeWidth={1.75} /></button>
            </div>
          </div>

          <div className="panel-body">
            <div className="section">
              <div className="scorecard">
                <div className={`scorebig ${l.temperature}`}>{l.score}</div>
                <div>
                  <div className="t"><span className={`tdot ${l.temperature}`} />{TEMP_LABEL[l.temperature]} · {l.pain?.label}</div>
                  <div className="d">
                    {meta?.model?.trained
                      ? `Probabilidade estimada de fechar: ${Math.round((l.probability || 0) * 100)}% (calibrada com ${meta.model.n} resultados da Synch)`
                      : 'Propensão de 0 a 100. Vira probabilidade calibrada quando o time registrar ganhos e perdas.'}
                  </div>
                  <div className="meter"><i style={{ width: `${l.score}%`, background: `var(--${l.temperature === 'quente' ? 'hot' : l.temperature === 'morno' ? 'warm' : 'cold'})` }} /></div>
                </div>
              </div>
            </div>

            <div className="section">
              <h3>Por que essa nota</h3>
              <ScoreBreakdown lead={l} />
            </div>

            <div className="section">
              <h3>
                Presença digital
                <span className="right" style={{ display: 'flex', gap: 4 }}>
                  <button className="btn ghost sm" onClick={() => { setEditSite((v) => !v); setSiteDraft(l.website || ''); }}>Corrigir site</button>
                  <button className="btn ghost sm icon" onClick={reaudit} disabled={busy} title="Verificar de novo"><RefreshCw size={14} strokeWidth={1.75} className={busy ? 'spin' : ''} /></button>
                </span>
              </h3>
              {editSite && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <input className="input" placeholder="https://… ou deixe vazio se não tem" value={siteDraft} onChange={(e) => setSiteDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSite()} autoFocus />
                  <button className="btn primary" onClick={saveSite} disabled={busy}>Auditar</button>
                </div>
              )}
              <Findings lead={l} />
              <dl className="kv">
                {l.sources?.includes('google') && <><dt>Google</dt><dd>{`${fmtRating(l.rating)} ★ · ${fmtInt(l.reviews)} avaliações · ${l.photos ?? 0} fotos`}</dd></>}
                {l.competitorShare > 0 && <><dt>Concorrência</dt><dd>{Math.round(l.competitorShare * 100)}% dos concorrentes do mesmo segmento, num raio de 2 km, têm site</dd></>}
                {l.address && <><dt>Endereço</dt><dd>{l.address}</dd></>}
                {l.cnpj && <><dt>CNPJ</dt><dd className="num">{l.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</dd></>}
                {l.openedAt && <><dt>Aberta em</dt><dd className="num">{new Date(`${l.openedAt}T12:00:00`).toLocaleDateString('pt-BR')}</dd></>}
                {(l.mei || l.porte) && <><dt>Porte</dt><dd>{l.mei ? 'MEI' : ({ '01': 'Microempresa', '03': 'Pequeno porte (EPP)', '05': 'Médio ou grande' }[l.porte] || 'Não informado')}{l.capital > 0 ? ` · capital ${fmtMoney(l.capital)}` : ''}</dd></>}
                {l.email && <><dt>E-mail</dt><dd><a href={`mailto:${l.email}`}>{l.email}</a></dd></>}
                {l.phoneShared && <><dt>Atenção</dt><dd>Este telefone aparece em várias empresas na Receita: pode ser do contador.</dd></>}
                <dt>Fontes</dt><dd>{l.sources?.map((s) => ({ google: 'Google Places', osm: 'OpenStreetMap', rfb: 'Receita Federal (CNPJ)' }[s] || s)).join(' + ')}</dd>
              </dl>
            </div>

            <Approach lead={l} onAction={onAction} />

            <div className="section">
              <h3>Pipeline</h3>
              <div className="grid2">
                <label className="field"><span>Status</span>
                  <select className="select" value={l.status} onChange={(e) => patch({ status: e.target.value }, 'Status atualizado.')}>
                    {meta?.statuses?.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="field"><span>Responsável</span>
                  <select className="select" value={l.owner || ''} onChange={(e) => patch({ owner: e.target.value || null }, 'Responsável atualizado.')}>
                    <option value="">Ninguém</option>
                    {sellers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    {l.owner && !sellers.some((s) => s.name === l.owner) && <option value={l.owner}>{l.owner}</option>}
                  </select>
                </label>
                <label className="field"><span>Retornar em</span>
                  <input className="input" type="date" value={l.nextActionAt || ''} onChange={(e) => patch({ nextActionAt: e.target.value || null }, e.target.value ? 'Retorno agendado.' : null)} />
                </label>
                <label className="field"><span>Valor do contrato (R$)</span>
                  <input className="input num" type="number" min="0" step="50" defaultValue={l.dealValue ?? ''} key={`dv-${l.id}`} onBlur={(e) => e.target.value !== String(l.dealValue ?? '') && patch({ dealValue: e.target.value })} placeholder="ex.: 1800" />
                </label>
              </div>
              <label className="field" style={{ marginTop: 10 }}><span>Notas</span>
                <textarea ref={notesRef} className="textarea" rows={3} key={`n-${l.id}`} defaultValue={l.notes} placeholder="O que foi conversado, objeções, próximo passo…" onBlur={(e) => e.target.value !== l.notes && patch({ notes: e.target.value }, 'Notas salvas.')} />
              </label>
            </div>

            {l.events?.length > 0 && (
              <div className="section">
                <h3>Histórico</h3>
                <ul className="timeline">
                  {l.events.map((ev, i) => (
                    <li key={i}>
                      <span><b>{ev.who || 'Alguém'}</b> {describeEvent(ev, meta?.statuses)}</span>
                      <span className="faint">{relTime(ev.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="section" style={{ borderBottom: 0 }}>
              <p className="faint" style={{ margin: 0, fontSize: 12, display: 'flex', gap: 6 }}><Info size={13} strokeWidth={1.75} style={{ flex: 'none', marginTop: 2 }} />Site verificado {relTime(l.audit?.checkedAt)}. Dados públicos (Receita Federal, Google, OpenStreetMap) podem estar desatualizados: confira antes de citar na abordagem.</p>
            </div>
          </div>
          {l.owner && (
            <div className="panel-foot">
              <span className="owner"><span className="avatar sm" style={{ background: avatarColor(l.owner) }}>{initials(l.owner)}</span>Com {l.owner}</span>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function describeEvent(ev, statuses) {
  const lbl = (id) => statuses?.find((s) => s.id === id)?.label || id;
  if (ev.type === 'status') { const [a, b] = (ev.detail || '').split(' → '); return `mudou de ${lbl(a)} para ${lbl(b)}`; }
  if (ev.type === 'whatsapp') return 'abriu conversa no WhatsApp';
  if (ev.type === 'ligacao') return 'ligou';
  if (ev.type === 'email') return 'enviou e-mail';
  if (ev.type === 'owner') return ev.detail;
  if (ev.type === 'followup') return `agendou ${ev.detail}`;
  return ev.detail || ev.type;
}
