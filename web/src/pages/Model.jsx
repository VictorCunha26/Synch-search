import React, { useEffect, useState } from 'react';
import { RotateCcw, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { fmtInt, TEMP_LABEL } from '../format.js';

const fmtW = (w) => (w > 0 ? '+' : w < 0 ? '−' : '') + Math.abs(w).toFixed(2).replace('.', ',');

export default function Model() {
  const { toast, refreshMeta } = useStore();
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/api/model').then(setM).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []);

  const retrain = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/model/retrain');
      toast(r.trained ? `Modelo reajustado com ${r.n} resultados.` : `Ainda faltam resultados: são ${r.wins} ganhos e ${r.losses} perdidos (mínimo 6, com 2 de cada).`, { ms: 5000 });
      load(); refreshMeta();
    } finally { setBusy(false); }
  };
  const reset = async () => { setBusy(true); try { await api.post('/api/model/reset'); toast('Pesos de volta ao padrão.'); load(); refreshMeta(); } finally { setBusy(false); } };

  if (!m) return <div className="page-head"><h1>Como pontuamos</h1></div>;
  const all = m.groups.flatMap((g) => g.features);
  const max = Math.max(...all.map((f) => Math.max(Math.abs(f.weight), Math.abs(f.prior))));
  const s = m.summary;
  const order = ['quente', 'morno', 'frio'];

  return (
    <>
      <div className="page-head">
        <h1>Como pontuamos</h1>
        <span className="sub">A nota é uma regressão logística sobre sinais auditados. Nada de número mágico.</span>
      </div>
      <div className="page-body">
        <div className="model">
          <div className="model-intro">
            <div>
              <p>Cada lead soma sinais de cinco grupos: <b>necessidade</b> (não tem site, site fora do ar, só Instagram, site sem HTTPS ou que não abre no celular), <b>capacidade</b> (volume de avaliações, nota, nicho de ticket alto), <b>intenção</b> (dono cuida do perfil do Google), <b>alcance</b> (tem celular para WhatsApp) e <b>contexto</b> (concorrentes já têm site; franquias saem da lista).</p>
              <p>Os pesos começam com valores definidos pela Synch. Toda vez que alguém marca um lead como <b>Ganho</b> ou <b>Perdido</b>, o modelo é reajustado com o histórico real do time, sem se afastar demais do ponto de partida enquanto há poucos dados.</p>
            </div>
            <div className="status-card">
              <div className="row"><span>Situação</span><b>{s.trained ? 'Aprendendo com o time' : 'Pesos iniciais'}</b></div>
              <div className="row"><span>Resultados registrados</span><span className="num">{fmtInt(s.wins)} ganhos · {fmtInt(s.losses)} perdidos</span></div>
              {s.trained && <div className="row"><span>Último ajuste</span><span>{new Date(s.trainedAt).toLocaleString('pt-BR')}</span></div>}
              {s.trained && s.accuracy != null && <div className="row"><span>Acerto no histórico</span><span className="num">{Math.round(s.accuracy * 100)}%</span></div>}
              {!s.trained && <p className="muted" style={{ margin: 0, fontSize: 13 }}>O ajuste começa com {s.minExamples} resultados, sendo pelo menos 2 ganhos e 2 perdidos.</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={retrain} disabled={busy}><RefreshCw size={14} strokeWidth={1.75} />Reajustar agora</button>
                {s.trained && <button className="btn sm ghost" onClick={reset} disabled={busy}><RotateCcw size={14} strokeWidth={1.75} />Voltar ao padrão</button>}
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 14, margin: '0 0 10px' }}>Resultado por temperatura</h2>
          <div className="weights" style={{ marginBottom: 24 }}>
            <table className="calib">
              <thead><tr><th>Temperatura</th><th className="num">Leads</th><th className="num">Trabalhados</th><th className="num">Ganhos</th><th className="num">Perdidos</th><th className="num">Taxa de ganho</th></tr></thead>
              <tbody>
                {order.map((t) => {
                  const b = m.buckets.find((x) => x.temperature === t) || { total: 0, ganhos: 0, perdidos: 0, trabalhados: 0 };
                  const closed = (b.ganhos || 0) + (b.perdidos || 0);
                  return (
                    <tr key={t}>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span className={`tdot ${t}`} />{TEMP_LABEL[t]}</span></td>
                      <td className="num">{fmtInt(b.total)}</td><td className="num">{fmtInt(b.trabalhados)}</td>
                      <td className="num">{fmtInt(b.ganhos)}</td><td className="num">{fmtInt(b.perdidos)}</td>
                      <td className="num">{closed ? `${Math.round((b.ganhos / closed) * 100)}%` : <span className="faint">sem dados</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 14, margin: '0 0 10px' }}>Pesos dos sinais</h2>
          <div className="weights">
            <div className="w-row w-head"><span>Sinal</span><span style={{ textAlign: 'center' }}>Diminui · aumenta a chance</span><span className="num">Inicial</span><span className="num">Atual</span></div>
            {m.groups.map((g) => (
              <React.Fragment key={g.group}>
                <h3>{g.group}</h3>
                {g.features.map((f) => {
                  const w = (Math.abs(f.weight) / max) * 50;
                  const p = (Math.abs(f.prior) / max) * 50;
                  return (
                    <div className="w-row" key={f.key}>
                      <span>{f.label}</span>
                      <span className="track" aria-hidden="true">
                        <i style={{ [f.weight >= 0 ? 'left' : 'right']: '50%', width: `${w}%`, background: f.weight >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
                        {Math.abs(f.weight - f.prior) > 0.01 && <i className="prior" style={{ [f.prior >= 0 ? 'left' : 'right']: '50%', width: `${p}%` }} />}
                      </span>
                      <span className="num faint">{fmtW(f.prior)}</span>
                      <span className="num">{fmtW(f.weight)}</span>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
