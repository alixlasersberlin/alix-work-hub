import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type ExperienceMode = 'classic' | 'premium' | 'mega';

const STORAGE_KEY = 'alix-experience';

interface Ctx {
  mode: ExperienceMode;
  setMode: (m: ExperienceMode) => void;
}

const ExperienceCtx = createContext<Ctx>({ mode: 'classic', setMode: () => {} });

function parse(v: string | null): ExperienceMode {
  if (v === 'classic' || v === 'premium' || v === 'mega') return v;
  return 'classic';
}

function apply(mode: ExperienceMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-experience', mode);
}

export function ExperienceModeProvider({ children }: { children: ReactNode }) {
  // Premium/Mega-Modi deaktiviert – System läuft ausschließlich im Classic-Design.
  const [mode, setModeState] = useState<ExperienceMode>('classic');

  useEffect(() => {
    apply('classic');
    try { localStorage.setItem(STORAGE_KEY, 'classic'); } catch { /* ignore */ }
  }, [mode]);

  const setMode = useCallback((_m: ExperienceMode) => setModeState('classic'), []);

  return (
    <ExperienceCtx.Provider value={{ mode: 'classic', setMode }}>
      {children}
    </ExperienceCtx.Provider>
  );
}

export const useExperienceMode = () => useContext(ExperienceCtx);

export function bootExperienceMode() {
  try {
    const m = parse(typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null);
    apply(m);
  } catch { /* ignore */ }
}
