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

  const value = useMemo(() => ({ meta, refreshMeta, seller, toast }), [meta, refreshMeta, seller, toast]);
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
