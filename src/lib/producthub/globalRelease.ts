import { supabase } from '@/integrations/supabase/client';

export async function pushGlobalProduct(productId: string, channel: 'com' | 'de' | 'beautyco' | 'dubai', dryRun = false) {
  const send = async (action: 'publish' | 'reactivate') => {
    const { data, error } = await supabase.functions.invoke('ph-global-publish-device', { body: { product_id: productId, channel, dry_run: dryRun, ...(action === 'reactivate' ? { action } : {}) } });
    if (error) {
      let message = error.message;
      try { const body = await error.context?.json(); message = body?.error || message; } catch { /* preserve original error */ }
      throw new Error(message);
    }
    const ready = channel === 'beautyco' ? data?.state === (dryRun ? 'validated' : 'online') && data?.dry_run === dryRun && data?.channel === channel : data?.status === (dryRun ? action === 'reactivate' ? 'REACTIVATE_READY' : 'WRITE_READY' : 'ONLINE');
    if (!data?.ok || data?.error || !ready || (dryRun ? data?.online !== false : data?.online !== true) || (channel === 'dubai' && data?.channel !== 'dubai')) throw new Error(data?.error || 'Online-Veröffentlichung nicht nachgewiesen');
    return data;
  };
  if (channel === 'dubai') {
    const { data: row, error } = await supabase.from('ph_product_channels').select('remote_snapshot').eq('product_id', productId).eq('channel_code', channel).maybeSingle();
    if (error) throw new Error('AE-Kanalstand konnte nicht geprüft werden');
    const snapshot = row?.remote_snapshot as Record<string, any> | undefined;
    if (snapshot?.ae_pending) throw new Error('AE-Vorgang läuft oder ist unklar; kein Neuversand');
    const prior = snapshot?.ae_direct;
    if (prior?.ok === true && prior.offline === true && prior.status === 'OFFLINE' && prior.channel === 'dubai') {
      const reactivated = await send('reactivate');
      if (dryRun) return reactivated;
      // Explicit activation restores visibility first; only its confirmed receipt
      // permits a separate publish of the currently approved English content.
    }
  }
  const data = await send('publish');
  return (channel === 'beautyco' ? { ...data, publish_id: data.publication_id, source_version: data.version } : data) as { ok: true; online: boolean; public_url: string; publish_id: string; source_version: string };
}