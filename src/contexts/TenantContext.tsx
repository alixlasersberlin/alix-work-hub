import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAtOnly } from '@/hooks/useAtOnly';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  country: string | null;
  currency: string | null;
  flag_emoji: string | null;
  zoho_source_system: string | null;
  is_active: boolean;
}

interface TenantContextType {
  tenants: Tenant[];                 // alle aktiven Mandanten
  allowedTenants: Tenant[];          // gefilterte nach Berechtigung
  current: Tenant | null;            // aktuell ausgewählter Mandant (null = Konzern/alle)
  setCurrent: (t: Tenant | null) => void;
  sourceFilter: string[] | null;     // zoho source_system Werte für DB-Filter (null = alle)
  loading: boolean;
}

const STORAGE_KEY = 'alixwork.currentTenantCode';
const Ctx = createContext<TenantContextType>({
  tenants: [], allowedTenants: [], current: null, setCurrent: () => {},
  sourceFilter: null, loading: true,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const atOnly = useAtOnly();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [accessIds, setAccessIds] = useState<string[] | null>(null);
  const [current, setCurrentState] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('*').eq('is_active', true).order('sort_order');
      setTenants(((data as any) || []) as Tenant[]);
      if (user) {
        const { data: uta } = await supabase.from('user_tenant_access').select('tenant_id').eq('user_id', user.id);
        setAccessIds(((uta as any) || []).map((r: any) => r.tenant_id));
      } else {
        setAccessIds([]);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const allowedTenants = useMemo(() => {
    if (atOnly) return tenants.filter(t => t.code === 'AT');
    if (isAdmin) return tenants;
    if (!accessIds || accessIds.length === 0) return tenants; // fallback: keine Beschränkung
    return tenants.filter(t => accessIds.includes(t.id));
  }, [tenants, accessIds, isAdmin, atOnly]);

  useEffect(() => {
    if (loading) return;
    if (atOnly) { setCurrentState(allowedTenants[0] || null); return; }
    const code = localStorage.getItem(STORAGE_KEY);
    if (code) {
      const found = allowedTenants.find(t => t.code === code);
      if (found) { setCurrentState(found); return; }
    }
    setCurrentState(null); // Konzern-Sicht default
  }, [loading, allowedTenants, atOnly]);

  const setCurrent = (t: Tenant | null) => {
    setCurrentState(t);
    if (t) localStorage.setItem(STORAGE_KEY, t.code);
    else localStorage.removeItem(STORAGE_KEY);
  };

  const sourceFilter = useMemo(() => {
    if (current) return current.zoho_source_system ? [current.zoho_source_system] : [];
    // Konzernsicht: nur erlaubte Mandanten
    const sources = allowedTenants.map(t => t.zoho_source_system).filter(Boolean) as string[];
    return sources.length === tenants.length ? null : sources;
  }, [current, allowedTenants, tenants]);

  return (
    <Ctx.Provider value={{ tenants, allowedTenants, current, setCurrent, sourceFilter, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTenant() {
  return useContext(Ctx);
}
