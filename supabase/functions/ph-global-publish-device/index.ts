import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { buildContent, confirmedReply, endpoints, signedHeaders, versionFor } from './contract.ts';
import { deactivateGlobal } from './offline.ts';
import { deactivateBeauty } from './beauty.ts';
import { publishBeauty } from './beauty-release.ts';
import { blockedOperation, operationStatus } from './operation-response.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status: operationStatus(status), headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const Body = z.object({ product_id: z.string().uuid(), channel: z.enum(['com', 'de', 'beautyco']), action: z.enum(['publish', 'deactivate']).default('publish'), dry_run: z.boolean().default(false) }).strict();

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Nur POST erlaubt' });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return json(401, { ok: false, error: 'Nicht angemeldet' });
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const key = Deno.env.get('GLOBAL_PRODUCT_HUB_DIRECT_RELEASE_KEY');
    if (!url || !anon || !service) return json(503, { ok: false, error: 'Versandzugang nicht vollständig eingerichtet' });
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: session, error: authError } = await caller.auth.getUser();
    if (authError || !session.user) return json(401, { ok: false, error: 'Nicht angemeldet' });
    const [{ data: role, error: roleError }, { data: profile, error: profileError }] = await Promise.all([
      caller.rpc('has_role', { check_role: 'Super Admin' }),
      caller.from('user_profiles').select('is_active,account_status').eq('id', session.user.id).maybeSingle(),
    ]);
    if (roleError || profileError || !role || !profile?.is_active || profile.account_status !== 'active') return json(403, { ok: false, error: 'Nur aktive Super Admins dürfen Webseiten freigeben' });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json(400, { ok: false, error: 'Ungültige Anfrage', details: parsed.error.flatten().fieldErrors });
    const { product_id, channel, dry_run, action } = parsed.data;
    // Protected caller reads precede service access and signing: no cross-scope product lookup.
    const { data: product, error: productError } = await caller.from('ph_products').select('*').eq('id', product_id).maybeSingle();
    if (productError || !product) return json(403, { ok: false, error: 'Gerät nicht zugänglich' });
    const tenantId = (product as Record<string, unknown>).tenant_id;
    const { data: tenantAllowed, error: tenantError } = await (caller as any).rpc('tenant_scope_id_ok', { _tenant_id: typeof tenantId === 'string' ? tenantId : null });
    if (tenantError || !tenantAllowed) return json(403, { ok: false, error: 'Keine Mandantenberechtigung' });
    const admin = createClient(url, service);
    if (channel === 'beautyco') {
      const beautyKey = Deno.env.get('BEAUTY_PRODUCT_HUB_WRITE_KEY');
      if (!beautyKey) return json(503, { ok: false, error: 'Sicherer Beauty-Zugang fehlt' });
      return json(200, action === 'deactivate'
        ? await deactivateBeauty(admin, product, session.user.id, beautyKey, dry_run)
        : await publishBeauty(admin, caller, product, session.user.id, beautyKey, dry_run));
    }
    if (!key) return json(503, { ok: false, error: 'Sicherer GLOBAL-Zugang fehlt' });
    if (action === 'deactivate') return json(200, await deactivateGlobal(admin, product, session.user.id, channel, key, dry_run));
    const field = channel === 'com' ? 'active_com' : 'active_de';
    if (!product[field] || !['approved', 'published'].includes(product.status)) return json(409, { ok: false, error: 'Gerät für diesen Kanal nicht freigegeben' });
    const db = admin as any;
    const [{ data: map, error: mapError }, { data: site, error: siteError }, { data: channelRow, error: channelError }, { data: translation, error: translationError }, { data: media, error: mediaError }] = await Promise.all([
      db.from('ph_lang_sync_map').select('remote_product_id,verified_at').eq('product_id', product_id).eq('site_code', channel).maybeSingle(),
      db.from('ph_channels').select('is_active').eq('code', channel).maybeSingle(),
      db.from('ph_product_channels').select('*').eq('product_id', product_id).eq('channel_code', channel).maybeSingle(),
      db.from('ph_product_translations').select('*').eq('product_id', product_id).eq('locale', 'en').maybeSingle(),
      db.from('ph_media').select('url,kind,media_type,sort_order').eq('product_id', product_id).order('sort_order'),
    ]);
    if (mapError || siteError || channelError || translationError || mediaError) return json(503, { ok: false, error: 'Freigabedaten konnten nicht vollständig geprüft werden' });
    if (!site?.is_active || channelRow?.hold) return json(409, { ok: false, error: 'Webseite deaktiviert oder Kanal zurückgehalten' });
    if (channelRow?.remote_snapshot?.global_offline || channelRow?.remote_snapshot?.global_offline_pending) return json(409, { ok: false, error: 'Webseite durch Abschaltung gesperrt; Reaktivierung benötigt einen eigenen bestätigten Vertrag' });
    if (!map?.verified_at || !z.string().uuid().safeParse(map.remote_product_id).success || !product.alix_product_id) return json(409, { ok: false, error: 'Bestätigte GLOBAL-Gerätezuordnung fehlt' });
    const content = buildContent(product, translation, channel, (media ?? []).filter((row: { media_type?: string; kind?: string }) => (row.media_type ?? row.kind) === 'image'));
    const source_version = await versionFor(content);
    const publish_id = crypto.randomUUID();
    const release = { publish_id, hub_id: product.alix_product_id, product_id: map.remote_product_id, channel, source_version,
      expected_version: channelRow?.remote_snapshot?.global_direct?.source_version ?? null, dry_run: true,
      approval: { actor_id: session.user.id, role: 'super_admin', active: true, channel, hub_id: product.alix_product_id, source_version }, content };
    if (new TextEncoder().encode(JSON.stringify(release)).length > 256 * 1024) return json(400, { ok: false, error: 'Freigabe überschreitet 256 KiB' });
    const call = async (dry: boolean) => {
      const raw = JSON.stringify({ ...release, dry_run: dry });
      const response = await fetch(endpoints[channel], { method: 'POST', headers: await signedHeaders(key, raw), body: raw,
        redirect: 'manual', signal: AbortSignal.timeout(90000) });
      const body = await response.json().catch(() => ({ ok: false, error: 'Ungültige GLOBAL-Antwort' }));
      return { response, body };
    };
    const preview = await call(true);
    if (!preview.response.ok || !confirmedReply(preview.body, release, true)) return json(200, { ok: false, online: false, error: `GLOBAL-Probelauf abgelehnt: ${preview.body.error || preview.response.status}`, details: preview.body });
    if (dry_run) return json(200, { ...preview.body, dry_run: true });
    // Atomic reservation in existing channel state prevents overlapping/uncertain writes.
    const { error: claimError } = await admin.rpc('ph_global_claim_release', { p_product_id: product_id, p_channel: channel, p_release: release });
    if (claimError) return json(409, { ok: false, error: claimError.message });
    const [{ data: currentProduct, error: currentProductError }, { data: currentChannel, error: currentChannelError }] = await Promise.all([
      caller.from('ph_products').select('active_com,active_de,status').eq('id', product_id).maybeSingle(),
      db.from('ph_product_channels').select('hold,remote_snapshot').eq('product_id', product_id).eq('channel_code', channel).maybeSingle(),
    ]);
    if (currentProductError || currentChannelError || !currentProduct?.[field] || !['approved', 'published'].includes(currentProduct.status) || currentChannel?.hold || currentChannel?.remote_snapshot?.global_offline_pending || currentChannel?.remote_snapshot?.global_offline) return json(409, { ok: false, online: false, error: 'Freigabe vor Versand zurückgezogen; reservierter Vorgang bleibt zur Prüfung gesperrt' });
    let result;
    try { result = await call(false); }
    catch { return json(200, { ok: false, online: false, publish_id, error: 'Übertragungsstand unklar; nicht erneut senden. Vorgang ist zur Prüfung gesperrt.' }); }
    const online = result.response.ok && confirmedReply(result.body, release, false);
    // Only an ONLINE proof completes the reservation; failures remain blocked for review.
    const { error: finishError } = await admin.rpc('ph_global_finish_release', { p_product_id: product_id, p_channel: channel, p_publish_id: publish_id, p_reply: result.body, p_online: online });
    if (finishError) return json(200, { ok: false, online: false, publish_id, error: 'GLOBAL-Antwort erhalten, lokales Freigabeprotokoll nicht bestätigt; nicht erneut senden' });
    return json(200, online ? result.body : { ok: false, online: false, publish_id, error: `GLOBAL-Veröffentlichung nicht nachgewiesen: ${result.body.error || result.response.status}`, details: result.body });
  } catch (error) { return json(200, blockedOperation(error)); }
});