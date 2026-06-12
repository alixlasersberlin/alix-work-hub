import { useCallback, useEffect, useState } from 'react';

export type FontScale = 'sm' | 'md' | 'lg' | 'xl' | 'a11y';

const SCALE_MAP: Record<FontScale, number> = {
  sm: 0.9,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
  a11y: 1.5,
};

const STORAGE_KEY = 'alix-font-scale';

function parse(v: string | null): FontScale {
  if (v === 'sm' || v === 'md' || v === 'lg' || v === 'xl' || v === 'a11y') return v;
  return 'md';
}

function applyScale(scale: FontScale) {
  if (typeof document === 'undefined') return;
  const value = SCALE_MAP[scale];
  document.documentElement.style.setProperty('--font-scale', String(value));
  document.documentElement.setAttribute('data-font-scale', scale);
}

export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>(() => {
    try { return parse(localStorage.getItem(STORAGE_KEY)); } catch { return 'md'; }
  });

  useEffect(() => {
    applyScale(scale);
    try { localStorage.setItem(STORAGE_KEY, scale); } catch { /* ignore */ }
  }, [scale]);

  const setScale = useCallback((s: FontScale) => setScaleState(s), []);

  return { scale, setScale, scaleValue: SCALE_MAP[scale] };
}

// Eager boot before React mounts to avoid font flicker.
export function bootFontScale() {
  try {
    const s = parse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
    applyScale(s);
  } catch { /* ignore */ }
}
