import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { endpoints, signedHeaders, type Channel } from './contract.ts';
import { confirmedOffline, offlineReason } from './offline-contract.ts';

export async function deactivateGlobal(admin: SupabaseClient, product: Record<string, unknown>, actorId: string, channel: Channel, key: string, dryRun: boolean) {
  const db = admin as any;
  const [{ data: map, error: mapError }, { data: row, error: rowError }] = await Promise.all([
    db.from('ph_lang_sync_map').select('remote_product_id,verified_at').eq('product_id', product.id).eq('site_code', channel).maybeSingle(),
    db.from('ph_product_channels').select('*').eq('product_id', product.id).eq('channel_code', channel).maybeSingle(),
  ]);
  if (mapError || rowError) throw new Error('Abschaltdaten konnten nicht geprüft werden');
  const reason = offlineReason(product, channel, row?.hold === true);
  if (!reason) throw new Error('Artikel ist für diese Webseite nicht deaktiviert oder zurückgehalten');
  if (!map?.verified_at || !z.string().uuid().safeParse(map.remote_product_id).success || !product.alix_product_id) throw new Error('Bestätigte GLOBAL-Gerätezuordnung fehlt');
  const prior = row?.remote_snapshot?.global_offline;
  if (prior && confirmedOffline(prior, { ...prior, channel, hub_id: product.alix_product_id, product_id: map.remote_product_id }, false)) {
    // A second local save must not reopen an already confirmed shutdown.
    if (!dryRun) {
      const { error } = await db.from('ph_product_channels').update({ has_pending_changes: false }).eq('product_id', product.id).eq('channel_code', channel);
      if (error) throw new Error('Bestehender Abschaltnachweis konnte nicht übernommen werden');
    }
    return prior;
  }
  if (row?.remote_snapshot?.global_offline_pending || row?.remote_snapshot?.global_pending) throw new Error('GLOBAL-Vorgang läuft oder ist unklar; Abschaltung ausstehend, kein automatischer Neuversand');
  const operation_id = crypto.randomUUID();
  const source_version = `offline:${operation_id}`;
  const request = { action: 'deactivate', operation_id, hub_id: product.alix_product_id, product_id: map.remote_product_id, channel, source_version,
    expected_version: prior?.source_version ?? row?.remote_snapshot?.global_direct?.source_version ?? null, reason, dry_run: true,
    approval: { actor_id: actorId, role: 'super_admin', active: true, channel, hub_id: product.alix_product_id, source_version } };
  const call = async (dry: boolean) => {
    const raw = JSON.stringify({ ...request, dry_run: dry });
    const response = await fetch(endpoints[channel], { method: 'POST', headers: await signedHeaders(key, raw), body: raw, redirect: 'manual', signal: AbortSignal.timeout(90000) });
    const body = await response.json().catch(() => ({ ok: false, offline: false, error: 'Ungültige Abschaltantwort' }));
    return { response, body };
  };
  const preview = await call(true);
  if (!preview.response.ok || !confirmedOffline(preview.body, request, true)) return { ok: false, offline: false, error: `Abschalt-Probelauf nicht bestätigt: ${preview.body.error || preview.response.status}` };
  if (dryRun) return preview.body;
  const { error: claimError } = await db.rpc('ph_global_claim_offline', { p_product_id: product.id, p_channel: channel, p_request: request });
  if (claimError) throw new Error(claimError.message);
  let result;
  try { result = await call(false); }
  catch { return { ok: false, offline: false, operation_id, error: 'Abschaltstand unklar; Vorgang zur Prüfung gesperrt, kein automatischer Neuversand' }; }
  const offline = result.response.ok && confirmedOffline(result.body, request, false);
  const { error: finishError } = await db.rpc('ph_global_finish_offline', { p_product_id: product.id, p_channel: channel, p_operation_id: operation_id, p_reply: result.body, p_offline: offline });
  if (finishError) return { ok: false, offline: false, operation_id, error: 'Abschaltantwort erhalten, Protokoll nicht bestätigt; kein Neuversand' };
  return offline ? result.body : { ok: false, offline: false, operation_id, error: `Webseitenabschaltung nicht bestätigt: ${result.body.error || result.response.status}` };
}