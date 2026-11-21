import { supabase } from '@/integrations/supabase/client';

export async function pushGlobalProduct(productId: string, channel: 'com' | 'de' | 'beautyco', dryRun = false) {
  const { data, error } = await supabase.functions.invoke('ph-global-publish-device', { body: { product_id: productId, channel, dry_run: dryRun } });
  if (error) {
    let message = error.message;
    try { const body = await error.context?.json(); message = body?.error || message; } catch { /* preserve original error */ }
    throw new Error(message);
  }
  const ready = channel === 'beautyco' ? data?.state === (dryRun ? 'validated' : 'online') && data?.dry_run === dryRun && data?.channel === channel : data?.status === (dryRun ? 'WRITE_READY' : 'ONLINE');
  if (!data?.ok || data?.error || !ready || (dryRun ? data?.online !== false : data?.online !== true)) {
    throw new Error(data?.error || 'Online-Veröffentlichung nicht nachgewiesen');
  }
  return (channel === 'beautyco' ? { ...data, publish_id: data.publication_id, source_version: data.version } : data) as { ok: true; online: boolean; public_url: string; publish_id: string; source_version: string };
}