import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { beautyEndpoint, confirmedBeautyOffline } from './beauty-contract.ts';
import { signedHeaders } from './contract.ts';

export async function deactivateBeauty(admin: SupabaseClient, product: Record<string, unknown>, actorId: string, key: string, dryRun: boolean) {
  const db = admin as any;
  const { data: row, error } = await db.from('ph_product_channels').select('*').eq('product_id', product.id).eq('channel_code', 'beautyco').maybeSingle();
  if (error || !row || !row.hold || !product.alix_product_id) throw new Error('Beauty-Kanal nicht zugänglich oder nicht deaktiviert');
  const prior = row.remote_snapshot?.beauty_offline;
  if (prior && confirmedBeautyOffline(prior, { ...prior, channel: 'beautyco', hub_id: product.alix_product_id }, false)) return prior;
  if (row.remote_snapshot?.beauty_offline_pending) throw new Error('Beauty-Abschaltung läuft oder ist unklar; kein automatischer Neuversand');
  const proof = row.remote_snapshot?.beauty_online;
  if (proof?.ok !== true || proof.online !== true || proof.state !== 'online' || proof.hub_id !== product.alix_product_id || proof.channel !== 'beautyco' || typeof proof.version !== 'string') throw new Error('Letzte bestätigte Beauty-ONLINE-Version fehlt; Bestandsversion wird nicht geraten');
  const request = { schema_version: 1, action: 'deactivate', operation_id: crypto.randomUUID(), hub_id: product.alix_product_id, channel: 'beautyco', country: 'DE', target_origin: 'https://alix-beauty.com', version: row.updated_at, expected_version: proof.version,
    reason: row.status === 'inactive' ? 'deactivated' : 'withheld', dry_run: true,
    approval: { source: 'alixwork', role: 'Super Admin', actor_id: actorId, approved_at: new Date().toISOString() } };
  if (new TextEncoder().encode(JSON.stringify(request)).length > 16384) throw new Error('Beauty-Auftrag überschreitet 16 KiB');
  const call = async (dry: boolean) => {
    const { data: role, error: roleError } = await db.from('user_roles').select('roles!inner(name)').eq('user_id', actorId).eq('roles.name', 'Super Admin').limit(1);
    const { data: profile, error: profileError } = await db.from('user_profiles').select('is_active,account_status').eq('id', actorId).maybeSingle();
    if (roleError || profileError || !role?.length || !profile?.is_active || profile.account_status !== 'active') throw new Error('Aktiver Super Admin erforderlich');
    const raw = JSON.stringify({ ...request, dry_run: dry });
    const signature = await signedHeaders(key, raw);
    const response = await fetch(beautyEndpoint, { method: 'PATCH', body: raw, redirect: 'manual', signal: AbortSignal.timeout(90000), headers: {
      'Content-Type': 'application/json', 'x-api-key': key, 'x-alix-timestamp': signature['x-alixwork-timestamp'], 'x-alix-signature': signature['x-alixwork-signature'],
    } });
    const body = await response.json().catch(() => ({ ok: false, offline: false, error: 'Ungültige Beauty-Antwort' }));
    return { response, body };
  };
  const preview = await call(true);
  if (!preview.response.ok || !confirmedBeautyOffline(preview.body, request, true)) return { ok: false, offline: false, error: `Beauty-Probelauf nicht bestätigt: ${preview.body.error || preview.response.status}` };
  if (dryRun) return preview.body;
  const { error: claimError } = await db.rpc('ph_beauty_claim_offline', { p_product_id: product.id, p_request: request });
  if (claimError) throw new Error(claimError.message);
  let result;
  try { result = await call(false); }
  catch { return { ok: false, offline: false, error: 'Beauty-Abschaltstand unklar; reserviert zur Prüfung, kein automatischer Neuversand' }; }
  const offline = result.response.ok && confirmedBeautyOffline(result.body, request, false);
  const { error: finishError } = await db.rpc('ph_beauty_finish_offline', { p_product_id: product.id, p_operation_id: request.operation_id, p_reply: result.body, p_offline: offline });
  if (finishError) return { ok: false, offline: false, error: 'Beauty-Nachweis konnte nicht abschließend gespeichert werden; kein Neuversand' };
  return offline ? result.body : { ok: false, offline: false, error: `Beauty-Abschaltung nicht bestätigt: ${result.body.error || result.response.status}` };
}