import { useEffect, useState } from 'react';

export type ViewMode = 'rows' | 'cards';

const KEY = 'orders_view_mode';

/**
 * Globally persisted view mode for order/list pages.
 * Default: 'rows' (Zeilen).
 */
export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'rows';
    const v = localStorage.getItem(KEY);
    return v === 'cards' ? 'cards' : 'rows';
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'rows' || e.newValue === 'cards')) {
        setMode(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = (m: ViewMode) => {
    setMode(m);
    try { localStorage.setItem(KEY, m); } catch {}
  };

  return [mode, update];
}
