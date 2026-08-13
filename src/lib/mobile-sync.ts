import { supabase } from '@/integrations/supabase/client';

export const CARDDAV_SERVER_HOST = new URL(import.meta.env.VITE_SUPABASE_URL as string).host;
export const CARDDAV_PATH = '/functions/v1/carddav';
export const CARDDAV_URL = `https://${CARDDAV_SERVER_HOST}${CARDDAV_PATH}`;
// Eingabe im iOS-Feld „Server“: vollständige HTTPS-URL inkl. Pfad.
// Ohne Schema interpretiert iOS den Pfad teilweise als Teil des Hostnamens
// und meldet fälschlich, dass SSL auf Port 443 nicht erreichbar sei.
export const CARDDAV_SERVER_FIELD = CARDDAV_URL;

export type SyncScope = 'none' | 'own' | 'region' | 'branch' | 'tenant' | 'sales' | 'service' | 'all';

export const SCOPE_LABELS: Record<SyncScope, string> = {
  none: 'Keine Kontakte',
  own: 'Eigene Kunden',
  region: 'Eigene Region',
  branch: 'Eigene Niederlassung',
  tenant: 'Eigener Mandant',
  sales: 'Vertriebskunden',
  service: 'Servicekunden',
  all: 'Alle Kunden',
};

export const DEVICE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  blocked: 'Gesperrt',
  revoked: 'Widerrufen',
};

export type MobileDevice = {
  id: string;
  user_id: string;
  device_name: string;
  status: string;
  last_sync_at: string | null;
  contact_count: number;
  created_at: string;
  token_prefix: string | null;
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mobile-sync-admin', { body });
  if (error) {
    const details = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
    let msg = details;
    try { msg = JSON.parse(details)?.error ?? details; } catch { /* plain text */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export const createDeviceToken = (device_name: string, user_id?: string) =>
  call<{ token: string; device: MobileDevice }>({ action: 'create_token', device_name, user_id });

export const rotateDeviceToken = (device_id: string) =>
  call<{ token: string }>({ action: 'rotate_token', device_id });

export const setDeviceStatus = (device_id: string, status: 'active' | 'blocked' | 'revoked') =>
  call<{ ok: true }>({ action: 'set_status', device_id, status });

export const setUserScope = (user_id: string, scope: SyncScope, scope_value?: string | null) =>
  call<{ ok: true }>({ action: 'set_scope', user_id, scope, scope_value: scope_value ?? null });

export const previewContacts = (user_id?: string) =>
  call<{ count: number; contacts: Array<{ id: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null; customer_no: string | null }> }>({ action: 'preview', user_id });
