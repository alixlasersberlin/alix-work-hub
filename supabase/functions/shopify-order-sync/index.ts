import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createAuditServiceClient } from '../_shared/audit-auth.ts';
import { createShopifyClient, SHOP } from '../_shared/shopify-client.ts';
import { normalizeOrder, ORDER_FIELDS } from '../_shared/shopify-order-data.ts';

// Safety net for missed Shopify webhooks: Shopify does not guarantee delivery, so a
// scheduled server-only reconciliation re-reads recently changed orders and applies
// them through the same duplicate-safe RPC. It also re-registers missing webhooks.
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders });
const TOPICS = ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED', 'ORDERS_PAID', 'REFUNDS_CREATE'];
const OVERLAP_MS = 15 * 60_000;
const MAX_PAGES = 8;
let client: ReturnType<typeof createShopifyClient> | undefined;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const supplied = req.headers.get('x-cron-secret');
  if (!supplied) return json({ error: 'Unauthorized' }, 401);
  const db = createAuditServiceClient();
  const env = Deno.env.get('CRON_SECRET');
  if (!env || supplied !== env) {
    const check = await db.rpc('auto_az_secret_ok', { p_secret: supplied });
    if (check.error || check.data !== true) return json({ error: 'Unauthorized' }, 401);
  }
  const { data: gate, error: gateError } = await db.from('integration_health').select('shop_config,tenant_id').eq('integration', 'shopify-orders').maybeSingle();
  if (gateError) return json({ error: 'Gate unavailable' }, 503);
  if (gate?.shop_config?.production_enabled !== true) return json({ ok: true, skipped: 'not approved' });
  const tenant = gate.tenant_id ?? null;
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  if (!clientId || !secret) return json({ error: 'Client unavailable' }, 503);
  client ??= createShopifyClient(clientId, secret);
  const started = new Date().toISOString();
  try {
    // 1) Webhook self-healing: keep exactly the expected subscriptions present.
    const uri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/shopify-order-webhook`;
    const existing: Array<{ topic: string; uri: string }> = [];
    let after: string | null = null;
    do {
      const page = await client.graphql('query($after:String){webhookSubscriptions(first:100,after:$after){nodes{topic uri} pageInfo{hasNextPage endCursor}}}', { after });
      existing.push(...page.webhookSubscriptions.nodes);
      after = page.webhookSubscriptions.pageInfo.hasNextPage ? page.webhookSubscriptions.pageInfo.endCursor : null;
    } while (after);
    const repaired: string[] = [];
    for (const topic of TOPICS) {
      if (existing.some(e => e.topic === topic && e.uri === uri)) continue;
      const r = await client.graphql('mutation($topic:WebhookSubscriptionTopic!,$input:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$input){webhookSubscription{id} userErrors{message}}}', { topic, input: { uri, format: 'JSON' } });
      repaired.push(`${topic}:${r.webhookSubscriptionCreate.webhookSubscription ? 'ok' : 'error'}`);
    }

    // 2) Reconcile recently changed orders since the last successful cursor.
    // Reuse the existing reconciliation, never add a permanent invoice sweeper.
    const pending = await db.from('orders').select('id').eq('source_system', `shopify:${SHOP}`).eq('shopify_invoice_state->>status', 'pending').limit(10);
    for (const order of pending.data ?? []) await db.rpc('shopify_invoice_retry', { p_order: order.id });
    const { data: last } = await db.from('integration_logs').select('payload').eq('source', 'shopify:sync').eq('event', 'run').eq('status', 'ok').order('created_at', { ascending: false }).limit(1).maybeSingle();
    const approvedAt = Date.parse(gate.shop_config?.approved_at ?? '') || Date.now() - 86_400_000;
    const base = Date.parse(last?.payload?.cursor ?? '') || approvedAt - 3_600_000;
    const since = new Date(base - OVERLAP_MS).toISOString();
    let cursor = new Date(base).toISOString();
    let page = 0; let next: string | null = null; let more = false;
    const counts = { seen: 0, imported: 0, updated: 0, skipped: 0, error: 0 };
    do {
      const data = await client.graphql(`query($after:String,$query:String){orders(first:25,after:$after,sortKey:UPDATED_AT,query:$query){nodes{${ORDER_FIELDS}} pageInfo{hasNextPage endCursor}}}`, { after: next, query: `updated_at:>='${since}'` });
      for (const raw of data.orders.nodes) {
        counts.seen++;
        let status = 'error'; let message = ''; let orderId = null;
        try {
          while (raw.lineItems.pageInfo.hasNextPage) {
            const extra = await client.graphql('query($id:ID!,$after:String){order(id:$id){lineItems(first:100,after:$after){nodes{id name sku quantity currentQuantity originalUnitPriceSet{shopMoney{amount currencyCode}} discountedTotalSet(withCodeDiscounts:true){shopMoney{amount currencyCode}}} pageInfo{hasNextPage endCursor}}}}', { id: raw.id, after: raw.lineItems.pageInfo.endCursor });
            raw.lineItems.nodes.push(...extra.order.lineItems.nodes); raw.lineItems.pageInfo = extra.order.lineItems.pageInfo;
          }
          const { data: res, error } = await db.rpc('shopify_apply_order', { p_order: normalizeOrder(raw), p_dry: false, p_update: true });
          if (error) throw new Error(error.message.includes('manual review') ? 'Lokale Änderungen – manuelle Prüfung nötig' : 'Auftrag konnte nicht sicher verarbeitet werden.');
          status = res.status; orderId = res.order_id;
        } catch (e) { message = e instanceof Error ? e.message.slice(0, 200) : 'Verarbeitung fehlgeschlagen.'; }
        if (status in counts) counts[status as keyof typeof counts]++; else counts.error++;
        if (status !== 'skipped') {
          await db.from('integration_logs').insert({ source: 'shopify:sync', event: 'order', external_id: raw.id, status, tenant_id: tenant,
            message: status === 'imported' ? 'Automatisch nachgeholt (Webhook nicht eingegangen)' : status === 'updated' ? 'Automatisch abgeglichen' : message,
            payload: { name: raw.name, order_id: orderId, updated_at: raw.updatedAt } });
        }
        if (raw.updatedAt > cursor) cursor = raw.updatedAt;
      }
      more = data.orders.pageInfo.hasNextPage;
      next = more ? data.orders.pageInfo.endCursor : null;
    } while (more && ++page < MAX_PAGES);
    await db.from('integration_logs').insert({ source: 'shopify:sync', event: 'run', status: 'ok', tenant_id: tenant, message: 'Automatischer Abgleich',
      payload: { cursor, since, started, counts, more, shop: SHOP, webhooks: { expected: TOPICS.length, found: existing.filter(e => e.uri === uri).length, repaired } } });
    return json({ ok: true, counts, more, repaired });
  } catch {
    await db.from('integration_logs').insert({ source: 'shopify:sync', event: 'run', status: 'error', tenant_id: tenant, message: 'Abgleich fehlgeschlagen; nächster Lauf versucht es erneut.', payload: { started } });
    return json({ error: 'Sync failed' }, 503);
  }
});
