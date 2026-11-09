import React, { useCallback, useEffect, useState } from 'react';
import { Database, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { fmtInt } from '../format.js';

const REGIONS = [
  ['Sudeste', ['SP', 'RJ', 'MG', 'ES']],
  ['Sul', ['PR', 'SC', 'RS']],
  ['Centro-Oeste', ['DF', 'GO', 'MT', 'MS']],
  ['Nordeste', ['BA', 'PE', 'CE', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI']],
  ['Norte', ['AM', 'PA', 'RO', 'TO', 'AC', 'AP', 'RR']],
];

export default function RfbImport() {
  const { refreshMeta, toast } = useStore();
  const [st, setSt] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [err, setErr] = useState('');

  const load = useCallback(() => api.get('/api/rfb').then((r) => { setSt(r); return r; }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load().then((r) => { if (r?.meta?.ufs?.length) setSel(new Set(r.meta.ufs)); }); }, [load]);
  useEffect(() => {
    if (!st?.running) return;
    const t = setInterval(async () => { const r = await load(); if (r && !r.running) { refreshMeta(); if (r.done) toast('Base nacional importada. As próximas buscas já usam esses dados.', { ms: 6000 }); } }, 2000);
    return () => clearInterval(t);
  }, [st?.running, load, refreshMeta, toast]);

  const toggle = (uf) => setSel((s) => { const n = new Set(s); n.has(uf) ? n.delete(uf) : n.add(uf); return n; });
  const all = st?.ufsAll || [];
  const start = async () => {
    setErr('');
    try { await api.post('/api/rfb/import', { ufs: [...sel] }); load(); } catch (e) { setErr(e.message); }
  };

  if (!st) return null;
  const pct = st.totalBytes ? Math.min(100, Math.round((st.bytes / st.totalBytes) * 100)) : 0;
  const outdated = st.meta?.month && st.latestMonth && st.latestMonth > st.meta.month;

  return (
    <section className="card-box">
      <header>
        <h2>Base nacional de empresas (Receita Federal)</h2>
        <p>Todas as empresas ativas do Brasil nos seus segmentos, com telefone, e-mail e data de abertura. É a fonte que cobre qualquer cidade. Gratuita e atualizada pela Receita todo mês.</p>
      </header>
      <div className="content">
        {st.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="inline-ok"><CheckCircle2 size={15} strokeWidth={1.75} />{fmtInt(st.total)} empresas importadas</span>
            <span className="muted" style={{ fontSize: 13 }}>{st.meta?.ufs?.join(', ')} · base de {st.meta?.month}</span>
            {outdated && <span className="chip need">Nova base disponível: {st.latestMonth}</span>}
          </div>
        )}

        {st.running ? (
          <div className="rfb-progress" aria-live="polite">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span>{st.step}</span>
              <span className="muted num">{fmtInt(Math.round(st.bytes / 1e6))} de {fmtInt(Math.round(st.totalBytes / 1e6))} MB · {fmtInt(st.kept)} empresas</span>
            </div>
            <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%`, background: 'var(--ink)' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="faint" style={{ fontSize: 12.5 }}>Pode continuar usando o app. Se a internet cair, a importação retoma de onde parou.</span>
              <button className="btn sm" onClick={async () => { await api.post('/api/rfb/cancel'); load(); }}><X size={14} strokeWidth={1.75} />Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="uf-grid">
              <div className="uf-head">
                <span className="field-label">Estados para importar</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn ghost sm" onClick={() => setSel(new Set(all))}>Brasil inteiro</button>
                  {sel.size > 0 && <button type="button" className="btn ghost sm" onClick={() => setSel(new Set())}>Limpar</button>}
                </div>
              </div>
              {REGIONS.map(([region, ufs]) => (
                <div className="uf-row" key={region}>
                  <span className="faint">{region}</span>
                  <div className="uf-chips">
                    {ufs.map((uf) => (
                      <button type="button" key={uf} className="uf-chip" aria-pressed={sel.has(uf)} onClick={() => toggle(uf)}>{uf}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              O download é de cerca de 7 GB (uns 30 minutos numa internet de 30 Mbps) com 1 ou com 27 estados, porque a Receita não separa os arquivos por estado. O que muda é o espaço ocupado no banco. Os arquivos baixados são apagados depois da leitura.
            </p>
            {(st.error || err) && <p className="inline-err" role="alert" style={{ margin: 0, display: 'flex', gap: 6 }}><AlertTriangle size={14} strokeWidth={1.75} style={{ marginTop: 2 }} />{st.error || err}</p>}
            <div>
              <button className="btn primary" disabled={!sel.size} onClick={start}>
                <Database size={15} strokeWidth={1.75} />
                {st.total > 0 ? (outdated ? `Atualizar para ${st.latestMonth}` : 'Importar de novo') : 'Importar base'}{sel.size ? ` (${sel.size === all.length ? 'Brasil inteiro' : `${sel.size} ${sel.size === 1 ? 'estado' : 'estados'}`})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
