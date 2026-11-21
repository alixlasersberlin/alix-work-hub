import { supabase } from '@/integrations/supabase/client';
import type { PhProduct } from './config';
import { toast } from 'sonner';
import { deactivatedGlobalChannels, isChannelDeactivation } from './deactivation';

const db = supabase as any;

async function syncDeactivation(productId: string, channel: string) {
  if (channel !== 'com' && channel !== 'de' && channel !== 'beautyco') {
    const result = { offline: false, note: 'In AlixWork deaktiviert – für diese Webseite fehlt der bestätigte Abschaltanschluss.' };
    toast.warning(result.note);
    return result;
  }
  try {
    const { data, error } = await supabase.functions.invoke('ph-global-publish-device', { body: { product_id: productId, channel, action: 'deactivate' } });
    if (error) {
      let message = error.message;
      try { const body = await error.context?.json(); message = body?.error || message; } catch { /* preserve original error */ }
      throw new Error(message);
    }
    if (!data?.ok || data.offline !== true || (channel === 'beautyco' ? data.state !== 'OFFLINE' : data.status !== 'OFFLINE')) throw new Error(data?.error || 'OFFLINE-Nachweis fehlt');
    toast.success(`${channel.toUpperCase()}: Abschaltung auf der Webseite bestätigt`);
    return { offline: true, note: 'Abschaltung auf der Webseite bestätigt' };
  } catch (error) {
    const note = `In AlixWork deaktiviert – Webseitenabschaltung ausstehend: ${error instanceof Error ? error.message : 'Keine Bestätigung'}`;
    toast.warning(note);
    return { offline: false, note };
  }
}

export async function phListProducts(): Promise<PhProduct[]> {
  const { data, error } = await db.from('ph_products').select('*')
    .order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as PhProduct[];
}

export async function phGetProduct(id: string): Promise<PhProduct> {
  const { data, error } = await db.from('ph_products').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as PhProduct;
}

export async function phUpdateProduct(id: string, patch: Record<string, any>) {
  const needsBefore = patch.active_com === false || patch.active_de === false;
  const before = needsBefore ? await phGetProduct(id) : null;
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db.from('ph_products')
    .update({ ...patch, updated_by: user?.id ?? null }).eq('id', id);
  if (error) throw error;
  for (const channel of deactivatedGlobalChannels(before ? { ...before } : {}, patch)) await syncDeactivation(id, channel);
}

export async function phCreateProduct(row: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await db.from('ph_products')
    .insert({ ...row, created_by: user?.id ?? null, updated_by: user?.id ?? null })
    .select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function phCounts(table: string, field = 'product_id') {
  const { data, error } = await db.from(table).select(`id, ${field}`);
  if (error) return {} as Record<string, number>;
  const map: Record<string, number> = {};
  for (const r of data || []) map[(r as any)[field]] = (map[(r as any)[field]] || 0) + 1;
  return map;
}

export async function phChannelRows(productId?: string) {
  let q = db.from('ph_product_channels').select('*');
  if (productId) q = q.eq('product_id', productId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function phUpsertChannel(productId: string, channel: string, patch: Record<string, any>) {
  const { error } = await db.from('ph_product_channels')
    .upsert({ product_id: productId, channel_code: channel, ...patch }, { onConflict: 'product_id,channel_code' });
  if (error) throw error;
  if (isChannelDeactivation(patch)) return syncDeactivation(productId, channel);
  return undefined;
}

export async function phLogSync(row: Record<string, any>) {
  await db.from('ph_sync_log').insert(row);
}

export async function phSetting(key: string) {
  const { data } = await db.from('ph_settings').select('*').eq('key', key).maybeSingle();
  return data;
}

export async function phSaveSetting(key: string, value: any) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db.from('ph_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: 'key' });
  if (error) throw error;
}
