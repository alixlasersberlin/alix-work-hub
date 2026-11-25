import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { COM_CATALOG, DE_CATALOG, type CardChannel, confirmedCardPaths, readComCard, type CardCheck } from './com-card-contract.ts';

export async function verifyComCard(admin: SupabaseClient, product: Record<string, unknown>, receipt: Record<string, unknown> | null, trigger: 'deactivate' | 'manual', channel: CardChannel = 'com') {
  const catalog = channel === 'de' ? DE_CATALOG : COM_CATALOG;
  const db = admin as any;
  const [{ data: map, error: mapError }, { data: row, error: rowError }] = await Promise.all([
    db.from('ph_lang_sync_map').select('remote_product_id,verified_at').eq('product_id', product.id).eq('site_code', channel).maybeSingle(),
    db.from('ph_product_channels').select('remote_snapshot').eq('product_id', product.id).eq('channel_code', channel).maybeSingle(),
  ]);
  const proof = receipt?.ok === true ? receipt : row?.remote_snapshot?.global_offline ?? row?.remote_snapshot?.global_direct ?? null;
  const paths = mapError || rowError || !map?.verified_at ? [] : confirmedCardPaths(proof, product.alix_product_id, map?.remote_product_id, channel);
  const inspection = await readComCard(paths, async () => {
    const target = new URL(catalog);
    target.searchParams.set('_alixwork_check', crypto.randomUUID());
    const response = await fetch(target, {
      headers: { Accept: 'text/html', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
      redirect: 'manual', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Seitenabruf fehlgeschlagen');
    const html = await response.text();
    if (new TextEncoder().encode(html).length > 2 * 1024 * 1024) throw new Error('Seitenantwort zu groß');
    return html;
  }, ms => new Promise(resolve => setTimeout(resolve, ms)), channel);
  const check: CardCheck = {
    ...inspection, product_id: String(product.id), remote_product_id: map?.remote_product_id ?? null,
    operation_id: typeof proof?.operation_id === 'string' ? proof.operation_id : null,
    checked_at: new Date().toISOString(), catalog_url: catalog,
  };
  // Append evidence separately; never replace OFFLINE receipts or alter channel state.
  const { error: logError } = await db.from('ph_sync_log').insert({
    product_id: product.id, channel_code: channel, direction: 'inbound', operation: `${channel}_card_check`,
    status: check.state === 'removed' ? 'success' : check.state === 'visible' ? 'warning' : 'error',
    message: check.message, payload: { ...check, trigger },
  });
  return { ...check, recorded: !logError, ...(logError ? { record_error: 'Prüfergebnis konnte nicht gespeichert werden.' } : {}) };
}