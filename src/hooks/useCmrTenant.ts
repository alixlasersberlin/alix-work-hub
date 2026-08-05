import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CmrSettings = {
  id: string;
  tenant_id: string;
  company_name: string;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  email: string | null;
  logo_url: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  bank_account: string | null;
  tax_rate: number;
  tax_note: string | null;
  payment_terms: string | null;
  default_currency: string;
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  email_signature: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_secure: boolean | null;
  footer_html: string | null;
  dunning_auto_send?: boolean | null;
};

/**
 * Lädt den Mandanten „CMR" (Cloud Marketing Research) samt Einstellungen.
 * `canWrite` zeigt, ob der angemeldete Nutzer in CMR buchen/ändern darf
 * (Rolle „CMR Viewer" darf ausschließlich lesen).
 * Rein additiv: bestehende Mandanten/Prozesse bleiben unberührt.
 */
export function useCmrTenant() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CmrSettings | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('code', 'CMR')
      .maybeSingle();
    const tid = (tenant as any)?.id ?? null;
    setTenantId(tid);
    if (tid) {
      const { data } = await supabase
        .from('cmr_settings' as any)
        .select('*')
        .eq('tenant_id', tid)
        .maybeSingle();
      setSettings((data as any) ?? null);
    }
    const { data: w } = await supabase.rpc('cmr_can_write' as any);
    setCanWrite(!!w);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  return { tenantId, settings, loading, reload, canWrite };
}


export const CMR_DOC_TYPES: { value: string; label: string }[] = [
  { value: 'angebot', label: 'Angebot' },
  { value: 'auftragsbestaetigung', label: 'Auftragsbestätigung' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'gutschrift', label: 'Gutschrift' },
  { value: 'lieferschein', label: 'Lieferschein' },
  { value: 'vertrag', label: 'Vertrag' },
  { value: 'mahnung', label: 'Mahnung' },
  { value: 'zahlungserinnerung', label: 'Zahlungserinnerung' },
  { value: 'proforma', label: 'Proformarechnung' },
  { value: 'serviceauftrag', label: 'Serviceauftrag' },
];

export const CMR_DOC_STATUS = [
  'entwurf', 'versendet', 'angenommen', 'abgelehnt', 'bezahlt', 'abgeschlossen', 'storniert',
];

export function cmrMoney(n: number | null | undefined, currency = 'AED') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(n || 0));
}
