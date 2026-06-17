import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

function parse(_v: string | null): Theme {
  return 'dark';
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove(theme === 'dark' ? 'light' : 'dark');
  root.classList.add(theme);
  root.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return parse(localStorage.getItem('app-theme')); } catch { return 'dark'; }
  });

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem('app-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((_t: Theme) => setThemeState('dark'), []);
  const toggleTheme = useCallback(() => setThemeState('dark'), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function bootTheme() {
  try {
    const t = parse(typeof localStorage !== 'undefined' ? localStorage.getItem('app-theme') : null);
    apply(t);
  } catch { /* ignore */ }
}
