import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { buildContent, signedHeaders, versionFor } from './contract.ts';
import { aeEndpoint, aeRequest, aeStateAllowed, confirmedAE, type AEAction } from './ae-contract.ts';

export async function sendAE(admin: SupabaseClient, caller: SupabaseClient, product: Record<string, any>, actorId: string, key: string, action: AEAction, dryRun: boolean) {
  const db = admin as any;
  const read = async () => {
    const [{ data: map, error: mapError }, { data: row, error: rowError }, { data: site, error: siteError }, { data: translation, error: translationError }, { data: media, error: mediaError }] = await Promise.all([
      db.from('ph_lang_sync_map').select('remote_product_id,verified_at').eq('product_id', product.id).eq('site_code', 'dubai').maybeSingle(),
      db.from('ph_product_channels').select('*').eq('product_id', product.id).eq('channel_code', 'dubai').maybeSingle(),
      db.from('ph_channels').select('is_active').eq('code', 'dubai').maybeSingle(),
      db.from('ph_product_translations').select('*').eq('product_id', product.id).eq('locale', 'en').maybeSingle(),
      db.from('ph_media').select('url,kind,media_type,sort_order').eq('product_id', product.id).order('sort_order'),
    ]);
    if (mapError || rowError || siteError || translationError || mediaError || !row || !site?.is_active) throw new Error('AE-Kanal oder Freigabedaten nicht zugänglich');
    if (!map?.verified_at || !z.string().uuid().safeParse(map.remote_product_id).success || !product.alix_product_id) throw new Error('Bestätigte eigene AE-Gerätezuordnung fehlt');
    return { map, row, translation, media: (media ?? []).filter((m: any) => (m.media_type ?? m.kind) === 'image') };
  };
  const initial = await read();
  aeStateAllowed(product, initial.row, action);
  const prior = initial.row.remote_snapshot?.ae_direct;
  const operationId = crypto.randomUUID();
  const content = action === 'publish' ? buildContent(product, initial.translation, 'com', initial.media) : undefined;
  const request = aeRequest(action, operationId, product.alix_product_id, initial.map.remote_product_id, prior?.source_version ?? null, actorId, content, initial.row.hold === true);
  const envelope = { request, product_updated_at: product.updated_at, translation_updated_at: action === 'publish' ? initial.translation?.updated_at : null };
  const check = async (reserved: boolean) => {
    const [{ data: auth, error: authError }, { data: role, error: roleError }, { data: profile, error: profileError }, { data: current, error: productError }] = await Promise.all([
      caller.auth.getUser(), caller.rpc('has_role', { check_role: 'Super Admin' }),
      caller.from('user_profiles').select('is_active,account_status').eq('id', actorId).maybeSingle(),
      caller.from('ph_products').select('*').eq('id', product.id).maybeSingle(),
    ]);
    if (authError || roleError || profileError || auth?.user?.id !== actorId || !role || !profile?.is_active || profile.account_status !== 'active') throw new Error('Aktive Super-Admin-Anmeldung erforderlich');
    if (productError || !current || current.updated_at !== product.updated_at || current.alix_product_id !== request.hub_id) throw new Error('AE-Gerät vor Versand geändert');
    const { data: tenantAllowed, error: tenantError } = await (caller as any).rpc('tenant_scope_id_ok', { _tenant_id: typeof current.tenant_id === 'string' ? current.tenant_id : null });
    if (tenantError || !tenantAllowed) throw new Error('Keine Mandantenberechtigung');
    const fresh = await read();
    if (fresh.map.remote_product_id !== request.product_id || (fresh.row.remote_snapshot?.ae_direct?.source_version ?? null) !== request.expected_version) throw new Error('AE-Zuordnung oder Versionsfolge geändert');
    const pending = fresh.row.remote_snapshot?.ae_pending;
    if (reserved && (pending?.request?.source_version !== request.source_version)) throw new Error('AE-Reservierung geändert');
    aeStateAllowed(current, { ...fresh.row, remote_snapshot: { ...fresh.row.remote_snapshot, ...(reserved ? { ae_pending: undefined } : {}) } }, action);
    if (action === 'publish' && (fresh.translation?.updated_at !== envelope.translation_updated_at || await versionFor(buildContent(current, fresh.translation, 'com', fresh.media)) !== await versionFor(content))) throw new Error('AE-Inhalte oder Übersetzung vor Versand geändert');
  };
  await check(false);
  // Confirmed shutdown is reused, never resent with a new operation identity.
  if (action === 'deactivate' && prior && confirmedAE(prior, { ...prior, action: 'deactivate', hub_id: product.alix_product_id, product_id: initial.map.remote_product_id, channel: 'dubai' }, false)) return prior;
  const call = async (dry: boolean) => {
    await check(!dry);
    const raw = JSON.stringify({ ...request, dry_run: dry });
    if (new TextEncoder().encode(raw).length > 256 * 1024) throw new Error('AE-Auftrag überschreitet 256 KiB');
    const response = await fetch(aeEndpoint, { method: 'POST', body: raw, headers: await signedHeaders(key, raw), redirect: 'manual', signal: AbortSignal.timeout(90000) });
    const body = await response.json().catch(() => ({ ok: false, error: 'Ungültige AE-Antwort' }));
    return { response, body };
  };
  const preview = await call(true);
  if (!preview.response.ok || !confirmedAE(preview.body, request, true)) return { ok: false, online: false, offline: false, error: `AE-Probelauf nicht bestätigt: ${preview.body.error || preview.response.status}`, details: preview.body };
  if (dryRun) return preview.body;
  const { error: claimError } = await db.rpc('ph_ae_claim_operation', { p_product_id: product.id, p_envelope: envelope });
  if (claimError) throw new Error(claimError.message);
  let result;
  try { result = await call(false); }
  catch { return { ok: false, online: false, offline: false, operation_id: operationId, error: 'AE-Versandstand unklar; reserviert zur Prüfung, kein automatischer Neuversand' }; }
  const confirmed = result.response.ok && confirmedAE(result.body, request, false);
  const { error: finishError } = await db.rpc('ph_ae_finish_operation', { p_product_id: product.id, p_operation_id: operationId, p_reply: result.body, p_confirmed: confirmed });
  if (finishError) return { ok: false, online: false, offline: false, error: 'AE-Antwort erhalten, lokales Protokoll nicht bestätigt; kein Neuversand' };
  return confirmed ? result.body : { ok: false, online: false, offline: false, error: `AE-Webseitenänderung nicht nachgewiesen: ${result.body.error || result.response.status}`, details: result.body };
}