import { supabase } from '@/integrations/supabase/client';
import type { PhProduct } from './config';

const db = supabase as any;

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
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db.from('ph_products')
    .update({ ...patch, updated_by: user?.id ?? null }).eq('id', id);
  if (error) throw error;
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
