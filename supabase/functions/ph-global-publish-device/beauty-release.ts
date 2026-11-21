import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { beautyReleaseEndpoint, buildBeautyRelease, confirmedBeautyRelease } from './beauty-release-contract.ts';
import { signedHeaders } from './contract.ts';

export async function publishBeauty(admin: SupabaseClient, caller: SupabaseClient, product: Record<string, unknown>, actorId: string, key: string, dryRun: boolean) {
  const db = admin as any;
  const request = buildBeautyRelease(product, actorId, crypto.randomUUID(), new Date().toISOString());
  const check = async (reserved: boolean) => {
    const [{ data: auth, error: authError }, { data: role, error: roleError }, { data: profile, error: profileError }, { data: current, error: productError }, { data: row, error: channelError }, { data: site, error: siteError }] = await Promise.all([
      caller.auth.getUser(), caller.rpc('has_role', { check_role: 'Super Admin' }),
      caller.from('user_profiles').select('is_active,account_status').eq('id', actorId).maybeSingle(),
      caller.from('ph_products').select('*').eq('id', product.id).maybeSingle(),
      db.from('ph_product_channels').select('*').eq('product_id', product.id).eq('channel_code', 'beautyco').maybeSingle(),
      db.from('ph_channels').select('is_active').eq('code', 'beautyco').maybeSingle(),
    ]);
    if (authError || roleError || profileError || auth?.user?.id !== actorId || !role || !profile?.is_active || profile.account_status !== 'active') throw new Error('Aktive Super-Admin-Anmeldung erforderlich');
    if (productError || channelError || siteError || !current || !row || !site?.is_active) throw new Error('Beauty-Freigabedaten nicht zugänglich');
    const { data: tenantAllowed, error: tenantError } = await (caller as any).rpc('tenant_scope_id_ok', { _tenant_id: typeof current.tenant_id === 'string' ? current.tenant_id : null });
    if (tenantError || !tenantAllowed) throw new Error('Keine Mandantenberechtigung');
    if (current.alix_product_id !== request.hub_id || current.updated_at !== request.version || current.status !== 'published' || current.active_de !== true || row.hold || row.status !== 'published') throw new Error('Beauty-Gerät oder freigegebene Quellversion geändert; Deutschland-Freigabe ist Voraussetzung des Beauty-Empfangs');
    const snapshot = row.remote_snapshot;
    if (snapshot?.beauty_offline || snapshot?.beauty_offline_pending || (reserved ? snapshot?.beauty_pending?.publication_id !== request.publication_id : !!snapshot?.beauty_pending)) throw new Error('Beauty-Vorgang gesperrt; keine Wiederholung oder ungeprüfte Reaktivierung');
  };
  const call = async (dry: boolean) => {
    await check(!dry);
    const raw = JSON.stringify({ ...request, dry_run: dry });
    if (new TextEncoder().encode(raw).length > 16384) throw new Error('Beauty-Auftrag überschreitet 16 KiB');
    const signature = await signedHeaders(key, raw);
    const response = await fetch(beautyReleaseEndpoint, { method: 'PATCH', body: raw, redirect: 'manual', signal: AbortSignal.timeout(90000), headers: {
      'Content-Type': 'application/json', 'x-api-key': key, 'x-alix-timestamp': signature['x-alixwork-timestamp'], 'x-alix-signature': signature['x-alixwork-signature'],
    } });
    const body = await response.json().catch(() => ({ ok: false, online: false, error: 'Ungültige Beauty-Antwort' }));
    return { response, body };
  };
  const preview = await call(true);
  if (!preview.response.ok || !confirmedBeautyRelease(preview.body, request, true)) return { ok: false, online: false, error: `Beauty-Probelauf nicht bestätigt: ${preview.body.error || preview.response.status}`, details: preview.body };
  if (dryRun) return preview.body;
  const { error: claimError } = await db.rpc('ph_beauty_claim_release', { p_product_id: product.id, p_request: request });
  if (claimError) throw new Error(claimError.message);
  let result;
  try { result = await call(false); }
  catch { return { ok: false, online: false, publication_id: request.publication_id, error: 'Beauty-Freigabe nicht bestätigt; reserviert zur Prüfung, kein automatischer Neuversand' }; }
  const online = result.response.ok && confirmedBeautyRelease(result.body, request, false);
  const { error: finishError } = await db.rpc('ph_beauty_finish_release', { p_product_id: product.id, p_publication_id: request.publication_id, p_reply: result.body, p_online: online });
  if (finishError) return { ok: false, online: false, error: 'Beauty-Antwort erhalten, lokaler Abschluss nicht bestätigt; kein Neuversand' };
  return online ? result.body : { ok: false, online: false, error: `Beauty-Veröffentlichung nicht nachgewiesen: ${result.body.error || result.response.status}`, details: result.body };
}