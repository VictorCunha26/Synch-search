import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Map as MapIcon, List, Download, AlertTriangle, X, Info, SearchX } from 'lucide-react';
import { api, qs } from '../api.js';
import { useStore } from '../store.jsx';
import { PAINS, fmtInt } from '../format.js';
import NichePicker from '../components/NichePicker.jsx';
import LeadTable from '../components/LeadTable.jsx';
import LeadPanel from '../components/LeadPanel.jsx';
import MapView from '../components/MapView.jsx';

const RADII = [1, 2, 3, 5, 8, 10, 15, 25];
const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const DEFAULT_FILTERS = { temperature: ['quente', 'morno', 'frio'], pain: [], niche: [], status: [], owner: '', hideChains: true, contactable: false };
const EXAMPLES = [
  { label: 'Dentistas e estética em Campinas', city: 'Campinas, SP', niches: ['dentista', 'estetica'] },
  { label: 'Oficinas em Belo Horizonte', city: 'Belo Horizonte, MG', niches: ['oficina'] },
  { label: 'Advocacia e contabilidade em Curitiba', city: 'Curitiba, PR', niches: ['advocacia', 'contabilidade'] },
];

function passes(l, f, q) {
  if (f.temperature.length && !f.temperature.includes(l.temperature)) return false;
  if (f.pain.length && !f.pain.includes(l.pain?.code)) return false;
  if (f.niche.length && !f.niche.includes(l.niche)) return false;
  if (f.status.length && !f.status.includes(l.status)) return false;
  if (f.owner === '__none' ? l.owner : f.owner && l.owner !== f.owner) return false;
  if (f.hideChains && l.chain) return false;
  if (f.contactable && !l.phone) return false;
  if (q && !`${l.name} ${l.neighborhood || ''} ${l.address || ''}`.toLowerCase().includes(q.toLowerCase())) return false;
  return true;
}
const SORTERS = {
  score: (a, b) => b.score - a.score || (b.reviews || 0) - (a.reviews || 0),
  reviews: (a, b) => (b.reviews || 0) - (a.reviews || 0) || b.score - a.score,
  name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
};

function CheckList({ options, value, onChange, counts }) {
  return options.map((o) => (
    <label className="check" key={o.id}>
      <input type="checkbox" checked={value.includes(o.id)} onChange={() => onChange(value.includes(o.id) ? value.filter((v) => v !== o.id) : [...value, o.id])} />
      {o.dot && <span className={`tdot ${o.id}`} />}
      {o.label}
      {counts && <span className="count num">{fmtInt(counts[o.id] || 0)}</span>}
    </label>
  ));
}

export default function Prospect() {
  const { meta, seller, toast, refreshMeta } = useStore();
  const [form, setForm] = useState(() => load('synch.form', { niches: [], city: '', neighborhood: '', radiusKm: 5 }));
  const [searchId, setSearchId] = useState(() => load('synch.searchId', null));
  const [live, setLive] = useState(null);
  const [scope, setScope] = useState(() => load('synch.scope', 'search'));
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, ...load('synch.filters.v2', {}) }));
  const [sort, setSort] = useState('score');
  const [q, setQ] = useState('');
  const [view, setView] = useState('lista');
  const [data, setData] = useState({ leads: [], totals: null, loading: false, error: '' });
  // ?lead=ID abre um lead direto (link compartilhável).
  const [selectedId, setSelectedId] = useState(() => Number(new URLSearchParams(window.location.search).get('lead')) || null);
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [formError, setFormError] = useState('');
  const [promoHidden, setPromoHidden] = useState(() => load('synch.promoHidden', false));
  const esRef = useRef(null);
  const reqSeq = useRef(0);

  useEffect(() => save('synch.form', form), [form]);
  useEffect(() => save('synch.filters.v2', filters), [filters]);
  useEffect(() => save('synch.scope', scope), [scope]);
  useEffect(() => save('synch.searchId', searchId), [searchId]);

  const query = useMemo(() => ({
    ...(scope === 'search' && searchId ? { searchId } : {}),
    temperature: filters.temperature, pain: filters.pain, niche: filters.niche, status: filters.status,
    owner: filters.owner, hideChains: filters.hideChains ? '1' : '0', contactable: filters.contactable ? '1' : '', q, sort,
  }), [scope, searchId, filters, q, sort]);

  const fetchLeads = useCallback(async () => {
    const seq = ++reqSeq.current;
    setData((d) => ({ ...d, loading: true, error: '' }));
    try {
      const r = await api.get(`/api/leads${qs(query)}`);
      if (seq === reqSeq.current) setData({ leads: r.leads, totals: r.totals, loading: false, error: '' });
    } catch (e) {
      if (seq === reqSeq.current) setData((d) => ({ ...d, loading: false, error: e.message }));
    }
  }, [query]);

  const loadMore = useCallback(async () => {
    setData((d) => ({ ...d, loadingMore: true }));
    try {
      const r = await api.get(`/api/leads${qs({ ...query, offset: data.leads.length })}`);
      setData((d) => ({ ...d, leads: [...d.leads, ...r.leads.filter((l) => !d.leads.some((x) => x.id === l.id))], loadingMore: false }));
    } catch (e) { setData((d) => ({ ...d, loadingMore: false, error: e.message })); }
  }, [query, data.leads.length]);

  const running = live && !live.done;
  useEffect(() => { if (!running) { const t = setTimeout(fetchLeads, q ? 220 : 0); return () => clearTimeout(t); } }, [fetchLeads, running, q]);

  // Acompanha uma busca em andamento (inclusive se a página for recarregada no meio).
  const follow = useCallback((id) => {
    esRef.current?.close();
    const es = new EventSource(`/api/searches/${id}/events`);
    esRef.current = es;
    es.addEventListener('progress', (e) => setLive(JSON.parse(e.data)));
    es.addEventListener('lead', (e) => {
      const lead = JSON.parse(e.data);
      setFreshIds((s) => new Set(s).add(lead.id));
      setData((d) => {
        const rest = d.leads.filter((x) => x.id !== lead.id);
        return { ...d, leads: passes(lead, filters, q) ? [...rest, lead].sort(SORTERS[sort] || SORTERS.score) : rest };
      });
    });
    const finish = (e) => {
      const st = JSON.parse(e.data || '{}');
      setLive({ ...st, done: true });
      es.close();
      fetchLeads();
      window.dispatchEvent(new Event('synch:queue'));
      if (e.type === 'done' && st.message) toast(st.message);
      setTimeout(() => setFreshIds(new Set()), 800);
    };
    es.addEventListener('done', finish);
    es.addEventListener('error', (e) => { if (e.data) finish(e); else if (es.readyState === EventSource.CLOSED) setLive((l) => (l ? { ...l, done: true } : l)); });
  }, [filters, q, sort, fetchLeads, toast]);

  useEffect(() => {
    if (!searchId) return;
    api.get(`/api/searches/${searchId}`).then((s) => {
      if (s.status === 'running' && s.live && !s.live.done) follow(searchId);
      else setLive({ done: true, stage: s.status, message: s.error || '', warnings: s.error ? [s.error] : [], center: s.lat ? { lat: s.lat, lon: s.lon } : null, found: s.found });
    }).catch(() => setSearchId(null));
    return () => esRef.current?.close();
  }, []);

  const runSearch = async (override) => {
    const f = override || form;
    setFormError('');
    if (!f.niches.length) return setFormError('Escolha pelo menos um segmento.');
    if (!f.city.trim()) return setFormError('Informe a cidade, por exemplo “Campinas, SP”.');
    try {
      const { id } = await api.post('/api/searches', f);
      setSearchId(id);
      setScope('search');
      setSelectedId(null);
      setData({ leads: [], totals: null, loading: false, error: '' });
      setLive({ stage: 'geocode', message: 'Localizando a região…', done: false });
      follow(id);
    } catch (e) { setFormError(e.message); }
  };

  const cancel = async () => { if (searchId) await api.post(`/api/searches/${searchId}/cancel`).catch(() => {}); };

  // Navegação por teclado na lista quando o painel está aberto.
  useEffect(() => {
    const on = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (e.key === 'Escape' && selectedId) setSelectedId(null);
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'j' || e.key === 'k') && data.leads.length) {
        e.preventDefault();
        const i = data.leads.findIndex((l) => l.id === selectedId);
        const next = e.key === 'ArrowDown' || e.key === 'j' ? Math.min(data.leads.length - 1, i + 1) : Math.max(0, i - 1);
        setSelectedId(data.leads[next < 0 ? 0 : next].id);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [selectedId, data.leads]);

  const onLeadChanged = (lead) => setData((d) => ({ ...d, leads: d.leads.map((x) => (x.id === lead.id ? { ...x, ...lead } : x)) }));
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const niches = meta?.niches || [];
  const tot = data.totals;
  const hasAnySearch = Boolean(searchId);
  const activeFilters = filters.pain.length + filters.niche.length + filters.status.length + (filters.owner ? 1 : 0) + (filters.contactable ? 1 : 0) + (filters.temperature.length < 3 ? 1 : 0);
  const filterCount = (filters.temperature.length < 3 ? 1 : 0) + filters.pain.length + filters.niche.length + filters.status.length + (filters.owner ? 1 : 0) + (filters.contactable ? 1 : 0);
  const pct = live?.total ? Math.round(((live.audited || 0) / live.total) * 100) : null;

  return (
    <>
      <div className="page-head">
        <h1>Prospectar</h1>
        <span className="sub">Encontre comércios que precisam de site, do mais quente ao mais frio.</span>
      </div>

      <form className="searchbar" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
        <div className="field"><span>Segmentos</span><NichePicker id="f-niches" niches={niches} value={form.niches} onChange={(v) => setForm({ ...form, niches: v })} /></div>
        <label className="field"><span>Cidade</span><input className="input" placeholder="Campinas, SP" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        <label className="field"><span>Bairro (opcional)</span><input className="input" placeholder="Cambuí" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></label>
        <label className="field"><span>Raio</span>
          <select className="select num" value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: Number(e.target.value) })}>
            {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </label>
        <div className="go">
          {running ? <button type="button" className="btn" onClick={cancel}><X size={15} strokeWidth={1.75} />Cancelar</button>
            : <button type="submit" className="btn primary"><Search size={15} strokeWidth={2} />Buscar leads</button>}
        </div>
      </form>

      {formError && <div className="notice error" role="alert"><AlertTriangle size={15} strokeWidth={1.75} />{formError}</div>}
      {running && (
        <div className="progress" aria-live="polite">
          <span className="spinner" />
          <div>
            <div style={{ marginBottom: 6 }}>{live.message}</div>
            <div className={`bar ${pct == null ? 'indeterminate' : ''}`}><i style={pct != null ? { width: `${pct}%` } : undefined} /></div>
          </div>
          <span className="muted num">{live.found ? `${fmtInt(live.found)} encontrados` : ''}</span>
        </div>
      )}
      {!running && live?.notes?.length > 0 && (
        <div className="notice"><Info size={15} strokeWidth={1.75} /><div>{live.notes.join(' ')}</div></div>
      )}
      {!running && live?.warnings?.length > 0 && (
        <div className="notice error" role="alert"><AlertTriangle size={15} strokeWidth={1.75} /><div>{[...new Set(live.warnings)].join(' ')}</div></div>
      )}
      {meta && !meta.rfb?.total && !running && (
        <div className="notice"><Info size={15} strokeWidth={1.75} />
          <div style={{ flex: 1 }}>Para ver <b>todas</b> as empresas de qualquer cidade do Brasil, importe a base nacional de CNPJ da Receita Federal (gratuita). <a href="#/configuracoes">Importar em Configurações</a></div>
        </div>
      )}
      {meta?.rfb?.total > 0 && !meta?.google && hasAnySearch && !running && !live?.warnings?.length && !promoHidden && (
        <div className="notice"><Info size={15} strokeWidth={1.75} />
          <div style={{ flex: 1 }}>Base CNPJ ativa. Para somar nota e avaliações do Google a cada empresa, <a href="#/configuracoes">conecte o Google Places</a>.</div>
          <button className="btn ghost sm icon" aria-label="Dispensar aviso" onClick={() => { setPromoHidden(true); save('synch.promoHidden', true); }}><X size={14} strokeWidth={1.75} /></button>
        </div>
      )}

      {!hasAnySearch && scope === 'search' ? (
        <div className="page-body">
          <div className="onboard">
            <h2>Comece por uma cidade e um segmento</h2>
            <p>Escolha acima ou teste uma destas buscas: o Synch Search visita o site de cada comércio e ordena a lista pela chance de fechar.</p>
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex.label} className="btn" onClick={() => { const f = { ...form, city: ex.city, niches: ex.niches, neighborhood: '' }; setForm(f); runSearch(f); }}>{ex.label}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="workspace" data-panel={selectedId ? 'open' : 'closed'}>
          <aside className="filters" aria-label="Filtros">
            <div className="filter-group">
              <h3>Temperatura</h3>
              <CheckList value={filters.temperature} onChange={(v) => setF('temperature', v)} counts={tot}
                options={[{ id: 'quente', label: 'Quente', dot: true }, { id: 'morno', label: 'Morno', dot: true }, { id: 'frio', label: 'Frio', dot: true }]} />
            </div>
            <div className="filter-group">
              <h3>Dor detectada{filters.pain.length > 0 && <button onClick={() => setF('pain', [])}>Limpar</button>}</h3>
              <CheckList value={filters.pain} onChange={(v) => setF('pain', v)} options={PAINS.map((p) => ({ id: p.code, label: p.label }))} />
            </div>
            {niches.length > 0 && (
              <div className="filter-group">
                <h3>Segmento{filters.niche.length > 0 && <button onClick={() => setF('niche', [])}>Limpar</button>}</h3>
                <CheckList value={filters.niche} onChange={(v) => setF('niche', v)}
                  options={(scope === 'search' && form.niches.length ? niches.filter((n) => form.niches.includes(n.id) || filters.niche.includes(n.id)) : niches.filter((n) => filters.niche.includes(n.id) || n.tier === 'A').slice(0, 12)).map((n) => ({ id: n.id, label: n.label }))} />
              </div>
            )}
            <div className="filter-group">
              <h3>Status{filters.status.length > 0 && <button onClick={() => setF('status', [])}>Limpar</button>}</h3>
              <CheckList value={filters.status} onChange={(v) => setF('status', v)} options={(meta?.statuses || []).slice(0, 7)} />
            </div>
            <div className="filter-group">
              <h3>Responsável</h3>
              <select className="select" value={filters.owner} onChange={(e) => setF('owner', e.target.value)}>
                <option value="">Todos</option>
                <option value="__none">Sem responsável</option>
                {(meta?.sellers || []).map((s) => <option key={s.id} value={s.name}>{s.name}{s.name === seller ? ' (você)' : ''}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label className="switch"><input type="checkbox" checked={filters.hideChains} onChange={(e) => setF('hideChains', e.target.checked)} />Ocultar franquias e redes</label>
              <label className="switch"><input type="checkbox" checked={filters.contactable} onChange={(e) => setF('contactable', e.target.checked)} />Só com telefone</label>
              {activeFilters > 0 && <button className="btn ghost sm" style={{ marginTop: 8, marginLeft: -9 }} onClick={() => setFilters(DEFAULT_FILTERS)}>Restaurar filtros</button>}
            </div>
          </aside>

          <section className="results" aria-label="Leads">
            <div className="toolbar">
              <div className="seg" role="group" aria-label="Escopo">
                <button aria-pressed={scope === 'search'} onClick={() => setScope('search')} disabled={!hasAnySearch}>Última busca</button>
                <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Todos os leads</button>
              </div>
              <span className="count">
                {running ? <><b className="num">{fmtInt(data.leads.length)}</b> pontuados até agora</>
                  : tot ? <><b className="num">{fmtInt(tot.total)}</b> leads{!selectedId && <> · <span className="num">{fmtInt(tot.quente || 0)}</span> quentes</>}</> : ''}
              </span>
              <button className="btn sm filters-chip" onClick={() => setSelectedId(null)} title={`Filtrando: ${filters.temperature.map((t) => t[0].toUpperCase() + t.slice(1)).join(' + ') || 'todas as temperaturas'}. Feche o painel para ver os filtros.`}>
                Filtros{filterCount > 0 && <span className="num"> · {filterCount}</span>}
              </button>
              <span className="spacer" />
              <div className="find">
                <Search size={14} strokeWidth={1.75} />
                <input className="input" placeholder="Nome ou bairro" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar por nome ou bairro" />
              </div>
              <div className="seg" role="group" aria-label="Visualização">
                <button aria-pressed={view === 'lista'} onClick={() => setView('lista')}><List size={14} strokeWidth={1.75} />Lista</button>
                <button aria-pressed={view === 'mapa'} onClick={() => setView('mapa')}><MapIcon size={14} strokeWidth={1.75} />Mapa</button>
              </div>
              <a className="btn sm csv" href={`/api/export.csv${qs(query)}`} download><Download size={14} strokeWidth={1.75} />CSV</a>
            </div>

            {data.error && <div className="notice error"><AlertTriangle size={15} strokeWidth={1.75} />{data.error}</div>}

            {view === 'mapa' ? (
              <MapView leads={data.leads} selectedId={selectedId} onSelect={setSelectedId} center={scope === 'search' ? live?.center : null} />
            ) : (
              <div className="table-wrap">
                {data.leads.length > 0 ? (
                  <>
                  <LeadTable leads={data.leads} selectedId={selectedId} onSelect={setSelectedId} sort={sort} onSort={setSort} statuses={meta?.statuses} freshIds={running ? freshIds : null}
                    compact={Boolean(selectedId)} showGoogle={Boolean(meta?.google) || data.leads.some((l) => l.sources?.includes('google'))} />
                  {!running && tot && tot.total > data.leads.length && (
                    <div className="load-more">
                      <button className="btn" onClick={loadMore} disabled={data.loadingMore}>{data.loadingMore ? 'Carregando…' : `Mostrar mais (${fmtInt(tot.total - data.leads.length)} restantes)`}</button>
                    </div>
                  )}
                  </>
                ) : running ? (
                  <div className="skeleton" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, i) => <div className="skel-row" key={i}><i style={{ width: 34 }} /><i style={{ width: `${30 + ((i * 37) % 25)}%` }} /><i style={{ width: 90 }} /><i style={{ width: 70 }} /></div>)}
                  </div>
                ) : !data.loading ? (
                  <div className="empty">
                    <div className="inner">
                      <span className="ico"><SearchX size={20} strokeWidth={1.75} /></span>
                      <h2>{tot?.total === 0 && activeFilters ? 'Nenhum lead com esses filtros' : 'Nenhum lead nesta busca'}</h2>
                      <p>{activeFilters ? 'Inclua os leads mornos e frios ou limpe os filtros para ver todos.' : live?.warnings?.length ? 'A fonte de dados falhou. Tente de novo em alguns minutos.' : 'Aumente o raio ou escolha outros segmentos.'}</p>
                      {activeFilters > 0 && <button className="btn" onClick={() => setFilters({ ...DEFAULT_FILTERS, temperature: ['quente', 'morno', 'frio'] })}>Mostrar todos</button>}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
          {selectedId && (
            <LeadPanel docked leadId={selectedId} onClose={() => setSelectedId(null)} onChanged={(l) => { onLeadChanged(l); refreshMeta(); }}
              onStep={(dir) => { const i = data.leads.findIndex((l) => l.id === selectedId); const n = data.leads[i + dir]; if (n) setSelectedId(n.id); }}
              position={{ index: data.leads.findIndex((l) => l.id === selectedId), total: data.leads.length }} />
          )}
        </div>
      )}
    </>
  );
}
