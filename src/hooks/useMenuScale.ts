import { useCallback, useEffect, useState } from 'react';

export const MENU_SCALE_KEY = 'alixwork.menuScale';
export const MENU_SCALE_EVENT = 'alixwork:menu-scale';
export const MENU_SCALE_MIN = 0.8;
export const MENU_SCALE_MAX = 1.4;
export const MENU_SCALE_STEP = 0.05;

function read(): number {
  if (typeof window === 'undefined') return 1;
  const v = Number(localStorage.getItem(MENU_SCALE_KEY));
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(MENU_SCALE_MAX, Math.max(MENU_SCALE_MIN, v));
}

/** Menü-/Schriftgröße der Sidebar (persistiert pro Browser). */
export function useMenuScale() {
  const [scale, setScaleState] = useState<number>(read);

  useEffect(() => {
    const sync = () => setScaleState(read());
    window.addEventListener(MENU_SCALE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(MENU_SCALE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setScale = useCallback((value: number) => {
    const next = Math.min(MENU_SCALE_MAX, Math.max(MENU_SCALE_MIN, Number(value.toFixed(2))));
    try { localStorage.setItem(MENU_SCALE_KEY, String(next)); } catch { /* ignore */ }
    setScaleState(next);
    window.dispatchEvent(new CustomEvent(MENU_SCALE_EVENT));
  }, []);

  return { scale, setScale };
}
