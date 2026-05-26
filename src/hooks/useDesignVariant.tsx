import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export type DesignVariant = 'classic' | 'beta3d';

interface DesignVariantContextType {
  variant: DesignVariant;
  setVariant: (v: DesignVariant) => void;
}

const STORAGE_KEY = 'design-variant';

const DesignVariantContext = createContext<DesignVariantContextType>({
  variant: 'classic',
  setVariant: () => {},
});

export function DesignVariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariantState] = useState<DesignVariant>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'beta3d' ? 'beta3d' : 'classic';
    } catch {
      return 'classic';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('design-beta3d', variant === 'beta3d');
    root.classList.toggle('design-classic', variant === 'classic');
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {
      /* ignore */
    }
  }, [variant]);

  const setVariant = useCallback((v: DesignVariant) => setVariantState(v), []);

  return (
    <DesignVariantContext.Provider value={{ variant, setVariant }}>
      {children}
    </DesignVariantContext.Provider>
  );
}

export const useDesignVariant = () => useContext(DesignVariantContext);
