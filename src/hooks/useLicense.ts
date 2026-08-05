import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const LICENSE_ROLES = ['Super Admin', 'Admin', 'License Manager'];

export interface LicTenant {
  id: string;
  code: string;
  name: string;
  zoho_source_system: string | null;
  currency: string | null;
}

export interface LicenseSettings {
  id?: string;
  tenant_id: string | null;
  billing_mode: 'single' | 'monthly';
  auto_generate: boolean;
  default_rate_percent: number;
  payment_terms_days: number;
  currency: string;
}

/** Zentrale Daten der Lizenzgesellschaft (Mandant LIC). */
export function useLicense() {
  const { hasRole } = useAuth() as any;
  const [tenants, setTenants] = useState<LicTenant[]>([]);
  const [settings, setSettings] = useState<LicenseSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const canWrite = useMemo(
    () => LICENSE_ROLES.some((r) => (hasRole ? hasRole(r) : false)),
    [hasRole],
  );

  const load = async () => {
    setLoading(true);
    const { data: t } = await supabase
      .from('tenants')
      .select('id,code,name,zoho_source_system,currency')
      .eq('is_active', true)
      .order('sort_order');
    const list = ((t as any[]) || []) as LicTenant[];
    setTenants(list);

    const lic = list.find((x) => x.code === 'LIC');
    if (lic) {
      const { data: s } = await supabase
        .from('license_settings' as any)
        .select('*')
        .eq('tenant_id', lic.id)
        .maybeSingle();
      setSettings(
        (s as any) || {
          tenant_id: lic.id,
          billing_mode: 'monthly',
          auto_generate: true,
          default_rate_percent: 5,
          payment_terms_days: 14,
          currency: 'EUR',
        },
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const licensor = tenants.find((t) => t.code === 'LIC') || null;
  const licensees = tenants.filter((t) => t.code !== 'LIC');

  return { tenants, licensor, licensees, settings, setSettings, canWrite, loading, reload: load };
}

export const licMoney = (v: number | null | undefined, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(Number(v || 0));
