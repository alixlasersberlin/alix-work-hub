import { supabase } from '@/integrations/supabase/client';

export async function pushGlobalProduct(productId: string, channel: 'com' | 'de', dryRun = false) {
  const { data, error } = await supabase.functions.invoke('ph-global-publish-device', { body: { product_id: productId, channel, dry_run: dryRun } });
  if (error) {
    let message = error.message;
    try { const body = await error.context?.json(); message = body?.error || message; } catch { /* preserve original error */ }
    throw new Error(message);
  }
  if (!data?.ok || data?.error || (dryRun ? data?.status !== 'WRITE_READY' : data?.online !== true || data?.status !== 'ONLINE')) {
    throw new Error(data?.error || 'Online-Veröffentlichung nicht nachgewiesen');
  }
  return data as { ok: true; online: boolean; public_url: string; publish_id: string; source_version: string };
}