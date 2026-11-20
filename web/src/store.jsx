import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getSeller } from './api.js';

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [seller, setSellerState] = useState(getSeller());
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  const refreshMeta = useCallback(async () => {
    try { setMeta(await api.get('/api/meta')); } catch (e) { setMeta((m) => m || { error: e.message, niches: [], statuses: [], sellers: [] }); }
  }, []);

  useEffect(() => { refreshMeta(); }, [refreshMeta]);

  // Estado do WhatsApp/IA ao vivo: um único canal SSE para o app inteiro.
  const [wa, setWa] = useState(null);
  useEffect(() => {
    let es;
    let retry;
    let lastBeat = Date.now();
    const beat = () => { lastBeat = Date.now(); };
    const open = () => {
      es?.close();
      beat();
      es = new EventSource('/api/wa/events');
      es.addEventListener('status', (e) => { beat(); setWa(JSON.parse(e.data)); });
      es.addEventListener('message', (e) => { beat(); window.dispatchEvent(new CustomEvent('synch:wa-message', { detail: JSON.parse(e.data) })); });
      es.addEventListener('lead', (e) => { beat(); window.dispatchEvent(new CustomEvent('synch:wa-lead', { detail: JSON.parse(e.data) })); });
      es.addEventListener('ping', beat);
      es.onerror = () => { es.close(); clearTimeout(retry); retry = setTimeout(open, 3000); };
    };
    open();
    // Vigia: se o canal ficar mudo (ex.: servidor reiniciou atrás do proxy), reabre e busca o estado atual.
    const watch = setInterval(() => {
      if (Date.now() - lastBeat > 35000) open();
      api.get('/api/wa').then(setWa).catch(() => {});
    }, 10000);
    return () => { clearTimeout(retry); clearInterval(watch); es?.close(); };
  }, []);
  useEffect(() => {
    const on = () => setSellerState(getSeller());
    window.addEventListener('synch:seller', on);
    return () => window.removeEventListener('synch:seller', on);
  }, []);

  const toast = useCallback((text, opts = {}) => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.ms || 3600);
  }, []);

  const value = useMemo(() => ({ meta, refreshMeta, seller, toast, wa, setWa }), [meta, refreshMeta, seller, toast, wa]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);

export function useHashRoute() {
  const read = () => {
    const h = window.location.hash;
    if (h.startsWith('#/')) return h.slice(2).split('?')[0] || 'prospectar';
    return new URLSearchParams(window.location.search).get('page') || 'prospectar';
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Fecha popovers ao clicar fora ou apertar Esc. */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, onClose]);
  return ref;
}
