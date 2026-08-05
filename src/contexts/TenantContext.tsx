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
  legal_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country_name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  email?: string | null;
  logo_url?: string | null;
  vat_id?: string | null;
  tax_number?: string | null;
  bank_details?: any;
  accent_color?: string | null;
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
  const { user, isAdmin, roles } = useAuth() as any;
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

  // Mandanten-Konfiguration (Akzentfarbe, Kennzeichnung) live anwenden — ohne Seitenreload
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-tenant', current?.code ?? 'ALL');
    const hex = (current?.accent_color || '').trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) { root.style.removeProperty('--primary'); root.style.removeProperty('--ring'); return; }
    const int = parseInt(m[1], 16);
    const r = ((int >> 16) & 255) / 255, g = ((int >> 8) & 255) / 255, b = (int & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const hsl = `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--ring', hsl);
  }, [current?.code, current?.accent_color]);



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
