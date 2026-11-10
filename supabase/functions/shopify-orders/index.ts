import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAuditUser } from '../_shared/audit-auth.ts';
import { createShopifyClient, ShopifyError, SHOP } from './client.ts';

const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
let shopify: ReturnType<typeof createShopifyClient> | undefined;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ ok: false, error: 'Nur POST erlaubt.' }, 405);
  try {
    const auth = await requireAuditUser(req);
    if ('response' in auth) return json({ ok: false, error: 'Anmeldung erforderlich.' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const [{ data: profile, error: profileError }, { data: admin, error: adminError }, { data: tenant, error: tenantError }] = await Promise.all([
      db.from('user_profiles').select('account_status,invitation_status,password_reset_required').eq('user_id', auth.user.id).maybeSingle(),
      db.rpc('is_admin'),
      db.rpc('has_tenant_access', { _tenant_code: 'DE' }),
    ]);
    if (profileError || adminError || tenantError || !admin || !tenant || profile?.account_status !== 'active' || profile.invitation_status !== 'accepted' || profile.password_reset_required !== false) {
      return json({ ok: false, error: 'Aktive Administratorfreigabe für Alix Deutschland erforderlich.' }, 403);
    }
    let body: unknown;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'Ungültige Anfrage.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => k !== 'action') || (body as { action?: unknown }).action !== 'check') {
      return json({ ok: false, error: 'Ungültige Aktion.' }, 400);
    }
    const id = Deno.env.get('SHOPIFY_CLIENT_ID');
    const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!id || !secret) return json({ ok: false, error: 'Shopify-App-Zugang muss sicher eingerichtet werden.' });
    shopify ??= createShopifyClient(id, secret);
    const data = await shopify.graphql('query { shop { name myshopifyDomain } }');
    if (data.shop?.myshopifyDomain !== SHOP) return json({ ok: false, error: 'Shopify hat einen anderen Shop zurückgegeben.' });
    const scopes = shopify.scopes();
    const canReadOrders = scopes.includes('read_orders') || scopes.includes('write_orders');
    const allOrders = canReadOrders && scopes.includes('read_all_orders');
    if (canReadOrders) await shopify.graphql('query { orders(first: 1) { nodes { id } } }');
    return json({ ok: true, message: 'Shopify erfolgreich verbunden', shop: data.shop, permissions: { orders: canReadOrders, all_orders: allOrders }, import_ready: allOrders });
  } catch (e) {
    if (e instanceof ShopifyError) return json({ ok: false, code: e.code, error: e.message, provider_status: e.status });
    // Never stringify exceptions: provider/SDK errors can contain credentials.
    return json({ ok: false, error: 'Shopify-Verbindungsprüfung fehlgeschlagen.' }, 500);
  }
});