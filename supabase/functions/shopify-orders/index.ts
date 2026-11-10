import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAuditUser, createAuditServiceClient } from '../_shared/audit-auth.ts';
import { createShopifyClient, ShopifyError, SHOP } from './client.ts';
import { z } from 'npm:zod@3';
import { ORDER_FIELDS, normalizeOrder } from '../_shared/shopify-order-data.ts';

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
      db.from('user_profiles').select('account_status,invitation_status,password_reset_required').eq('id', auth.user.id).maybeSingle(),
      db.rpc('is_admin'),
      db.from('tenants').select('id').eq('code', 'DE').maybeSingle(),
    ]);
    if (profileError || adminError || tenantError || !admin || !tenant || profile?.account_status !== 'active' || profile.invitation_status !== 'accepted' || profile.password_reset_required !== false) {
      return json({ ok: false, error: 'Aktive Administratorfreigabe für Alix Deutschland erforderlich.' }, 403);
    }
    const { data: tenantAllowed, error: accessError } = await db.rpc('has_tenant_access', { _tenant_id: tenant.id });
    if (accessError || !tenantAllowed) return json({ ok: false, error: 'Keine Freigabe für Alix Deutschland.' }, 403);
    let body: unknown;
    try { body = await req.json(); } catch { return json({ ok: false, error: 'Ungültige Anfrage.' }, 400); }
    const parsed = z.discriminatedUnion('action', [
      z.object({ action: z.literal('check') }).strict(),
      z.object({ action: z.literal('test'), run: z.string().uuid(), cursor: z.string().max(2048).nullable().optional(), cutoff: z.string().datetime() }).strict(),
      z.object({ action: z.literal('approve'), run: z.string().uuid(), confirmed: z.literal(true) }).strict(),
      z.object({ action: z.literal('import'), cursor: z.string().max(2048).nullable().optional() }).strict(),
      z.object({ action: z.literal('logs'), offset: z.number().int().nonnegative().max(100000).default(0) }).strict(),
      z.object({ action: z.literal('webhooks') }).strict(),
    ]).safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, error: 'Ungültige Aktion.' }, 400);
    }
    const id = Deno.env.get('SHOPIFY_CLIENT_ID');
    const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!id || !secret) return json({ ok: false, error: 'Shopify-App-Zugang muss sicher eingerichtet werden.' });
    shopify ??= createShopifyClient(id, secret);
    const action = parsed.data;
    if (action.action !== 'check') {
      const service = createAuditServiceClient();
      if (action.action === 'logs') {
        const { data: rows, error } = await service.from('integration_logs').select('id,created_at,event,external_id,status,message,payload').like('source', 'shopify:%').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).range(action.offset, action.offset + 49);
        if (error) throw new Error('Log read failed');
        return json({ ok: true, rows });
      }
      if (action.action === 'approve') {
        const { data, error } = await service.rpc('shopify_approve_import', { p_run: action.run, p_user: auth.user.id });
        if (error) return json({ ok: false, error: 'Freigabe erfordert einen vollständigen fehlerfreien Testlauf der letzten 30 Minuten.' });
        return json(data);
      }
      const { data: gate, error: gateError } = await service.from('integration_health').select('shop_config').eq('integration', 'shopify-orders').maybeSingle();
      if (gateError) throw new Error('Gate unavailable');
      if (action.action !== 'test' && gate?.shop_config?.production_enabled !== true) return json({ ok: false, error: 'Produktivimport noch nicht freigegeben.' });
      if (action.action === 'webhooks') {
        const uri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-order-webhook`;
        const topics = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED', 'ORDERS_PAID', 'REFUNDS_CREATE'];
        const existing: Array<{ topic: string; uri: string }> = [];
        let after: string | null = null;
        do {
          const page = await shopify.graphql('query($after:String){ webhookSubscriptions(first:100,after:$after){ nodes{topic uri} pageInfo{hasNextPage endCursor} } }', { after });
          existing.push(...page.webhookSubscriptions.nodes);
          after = page.webhookSubscriptions.pageInfo.hasNextPage ? page.webhookSubscriptions.pageInfo.endCursor : null;
        } while (after);
        const results = [];
        for (const topic of topics) {
          if (existing.some(e => e.topic === topic && e.uri === uri)) { results.push({ topic, ok: true, existing: true }); continue; }
          const response = await shopify.graphql('mutation($topic:WebhookSubscriptionTopic!,$input:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$input){webhookSubscription{id topic uri} userErrors{field message}}}', { topic, input: { uri, format: 'JSON' } });
          const r = response.webhookSubscriptionCreate;
          results.push({ topic, ok: Boolean(r.webhookSubscription) && !r.userErrors.length, errors: r.userErrors });
        }
        await service.from('integration_logs').insert({ source: 'shopify:admin', event: 'webhooks', status: results.every(r => r.ok) ? 'ok' : 'error', tenant_id: tenant.id, user_id: auth.user.id, payload: { results } });
        return json({ ok: results.every(r => r.ok), results });
      }
      const dry = action.action === 'test';
      if (dry && (Date.parse(action.cutoff) > Date.now() + 60000 || Date.parse(action.cutoff) < Date.now() - 30 * 60000)) return json({ ok: false, error: 'Testzeitpunkt abgelaufen.' });
      const page = await shopify.graphql(`query($after:String,$query:String){orders(first:10,after:$after,sortKey:ID,query:$query){nodes{${ORDER_FIELDS}} pageInfo{hasNextPage endCursor}}}`, { after: action.cursor ?? null, query: dry ? `created_at:<=${action.cutoff}` : null });
      const results = [];
      for (const raw of page.orders.nodes) {
        let status = 'error'; let message = ''; let orderId = null;
        try {
          // Complete nested pagination prevents silent loss of line items.
          while (raw.lineItems.pageInfo.hasNextPage) {
            const extra = await shopify.graphql('query($id:ID!,$after:String){order(id:$id){lineItems(first:100,after:$after){nodes{id name sku quantity currentQuantity originalUnitPriceSet{shopMoney{amount currencyCode}} discountedTotalSet(withCodeDiscounts:true){shopMoney{amount currencyCode}}} pageInfo{hasNextPage endCursor}}}}', { id: raw.id, after: raw.lineItems.pageInfo.endCursor });
            raw.lineItems.nodes.push(...extra.order.lineItems.nodes); raw.lineItems.pageInfo = extra.order.lineItems.pageInfo;
          }
          const normalized = normalizeOrder(raw);
          const { data, error } = await service.rpc('shopify_apply_order', { p_order: normalized, p_dry: dry, p_update: false });
          if (error) throw new Error('Auftrag konnte nicht sicher verarbeitet werden.');
          status = data.status; orderId = data.order_id; message = dry ? 'Test ohne Auftragserstellung' : 'Produktiver Import';
        } catch (e) { message = e instanceof z.ZodError ? 'Bestelldaten unvollständig oder ungültig.' : e instanceof Error ? e.message : 'Verarbeitung fehlgeschlagen.'; }
        const entry = { source: dry ? 'shopify:test' : 'shopify:import', event: 'order', external_id: raw.id, status, message, user_id: auth.user.id, tenant_id: tenant.id, payload: { run: dry ? action.run : null, name: raw.name, order_id: orderId } };
        const { error: logError } = await service.from('integration_logs').insert(entry);
        if (logError) throw new Error('Protokoll konnte nicht gespeichert werden.');
        results.push({ external_id: raw.id, name: raw.name, status, message, order_id: orderId });
      }
      let summary = null;
      if (dry && !page.orders.pageInfo.hasNextPage) {
        // Count from persisted log pages, not caller-supplied counters.
        const { count, error } = await service.from('integration_logs').select('id', { count: 'exact', head: true }).eq('source','shopify:test').eq('event','order').eq('user_id',auth.user.id).eq('payload->>run',action.run);
        const { count: errors, error: errorCount } = await service.from('integration_logs').select('id', { count: 'exact', head: true }).eq('source','shopify:test').eq('event','order').eq('user_id',auth.user.id).eq('payload->>run',action.run).eq('status','error');
        if (error || errorCount) throw new Error('Testzählung fehlgeschlagen');
        summary = { count: count ?? 0, errors: errors ?? 0, all_orders: shopify.scopes().includes('read_all_orders') };
        await service.from('integration_logs').insert({ source:'shopify:test',event:'complete',external_id:action.run,status:summary.errors ? 'error':'ok',user_id:auth.user.id,tenant_id:tenant.id,payload:summary,message:'Testlauf abgeschlossen' });
      }
      return json({ ok: true, results, summary, next: page.orders.pageInfo.hasNextPage ? page.orders.pageInfo.endCursor : null });
    }
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