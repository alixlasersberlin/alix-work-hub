import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

export type ExperienceMode = 'classic' | 'premium' | 'mega';

const STORAGE_KEY = 'alix-experience';

interface Ctx {
  mode: ExperienceMode;
  setMode: (m: ExperienceMode) => void;
}

const ExperienceCtx = createContext<Ctx>({ mode: 'classic', setMode: () => {} });

function parse(v: string | null): ExperienceMode {
  return 'classic';
}

function apply(mode: ExperienceMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-experience', mode);
}

export function ExperienceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ExperienceMode>(() => {
    try { return parse(localStorage.getItem(STORAGE_KEY)); } catch { return 'classic'; }
  });

  useEffect(() => {
    apply(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  const setMode = useCallback((_m: ExperienceMode) => setModeState('classic'), []);

  return (
    <ExperienceCtx.Provider value={{ mode, setMode }}>
      {children}
    </ExperienceCtx.Provider>
  );
}

export const useExperienceMode = () => useContext(ExperienceCtx);

export function bootExperienceMode() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, 'classic');
    apply('classic');
  } catch { /* ignore */ }
}
