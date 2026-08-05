import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lädt den Mandanten „Alix Medical" (Code MED) und die Schreibberechtigung.
 * Rein additiv — bestehende Mandanten und Prozesse bleiben unberührt.
 */
export function useMedTenant() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('code', 'MED')
      .maybeSingle();
    setTenantId((tenant as any)?.id ?? null);
    const { data: w } = await supabase.rpc('med_can_write' as any);
    setCanWrite(!!w);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  return { tenantId, canWrite, loading, reload };
}

export const MED_DOC_TYPES: { value: string; label: string }[] = [
  { value: 'angebot', label: 'Angebot' },
  { value: 'auftragsbestaetigung', label: 'Auftragsbestätigung' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'gutschrift', label: 'Gutschrift' },
  { value: 'lieferschein', label: 'Lieferschein' },
  { value: 'serviceauftrag', label: 'Serviceauftrag' },
  { value: 'wartung', label: 'Wartungsvertrag' },
];

export const MED_DOC_STATUS = [
  'entwurf', 'versendet', 'angenommen', 'abgelehnt', 'bezahlt', 'abgeschlossen', 'storniert',
];

export const MED_COMPLIANCE_KINDS = [
  { value: 'mdr', label: 'MDR-Dokumentation' },
  { value: 'ce', label: 'CE-Konformität' },
  { value: 'iso13485', label: 'ISO 13485' },
  { value: 'technische_doku', label: 'Technische Dokumentation' },
  { value: 'vigilanz', label: 'Vigilanz / Meldung' },
];

export function medMoney(n: number | null | undefined, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(n || 0));
}

export function medDocLabel(v: string) {
  return MED_DOC_TYPES.find(t => t.value === v)?.label ?? v;
}
