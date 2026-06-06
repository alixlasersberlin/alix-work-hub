import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('app-theme');
    return (stored === 'light' || stored === 'dark') ? stored : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const isNeo = root.classList.contains('theme-neo');
    const effective: Theme = isNeo ? 'light' : theme;
    root.classList.remove('light', 'dark');
    root.classList.add(effective);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Re-apply when NEO template toggles
  useEffect(() => {
    const handler = () => {
      const root = document.documentElement;
      const isNeo = root.classList.contains('theme-neo');
      root.classList.remove('light', 'dark');
      root.classList.add(isNeo ? 'light' : theme);
    };
    window.addEventListener('alixwork:ui-template', handler);
    return () => window.removeEventListener('alixwork:ui-template', handler);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
