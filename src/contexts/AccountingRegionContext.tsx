import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AccountingRegion = 'EU' | 'CH';

interface Ctx {
  region: AccountingRegion;
  setRegion: (r: AccountingRegion) => void;
}

const STORAGE_KEY = 'alix.accounting.region';
const AccountingRegionContext = createContext<Ctx | null>(null);

export function AccountingRegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<AccountingRegion>(() => {
    if (typeof window === 'undefined') return 'EU';
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'CH' ? 'CH' : 'EU';
  });

  const setRegion = (r: AccountingRegion) => {
    setRegionState(r);
    try { window.localStorage.setItem(STORAGE_KEY, r); } catch {}
    // Signal for pages that don't subscribe to context via events
    try { window.dispatchEvent(new CustomEvent('alix:region-changed', { detail: r })); } catch {}
  };

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'EU' || e.newValue === 'CH')) {
        setRegionState(e.newValue as AccountingRegion);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ region, setRegion }), [region]);
  return <AccountingRegionContext.Provider value={value}>{children}</AccountingRegionContext.Provider>;
}

export function useAccountingRegion(): Ctx {
  const c = useContext(AccountingRegionContext);
  if (!c) return { region: 'EU', setRegion: () => {} };
  return c;
}

/** Utility for supabase query builders: chain `.in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region])`. */
export function withRegion<T extends { eq: (col: string, val: any) => T }>(q: T, region: AccountingRegion): T {
  return q.in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]);
}
