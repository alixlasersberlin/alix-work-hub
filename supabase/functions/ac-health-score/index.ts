// ALIX CONNECT — Phase 27 Customer Health Scoring & Lifecycle
// Berechnet Health (0-100) aus Nutzung/Zahlung/Support/Sentiment und mappt Lifecycle-Stage.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit ?? 500), 5000);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: customers } = await sb.from('customers').select('id, created_at').limit(limit);
    if (!customers?.length) return json({ ok: true, processed: 0 });

    const ids = customers.map((c: any) => c.id);

    // Bulk fetch signals
    const [{ data: orders }, { data: unpaid }, { data: msgs }, { data: contacts }] = await Promise.all([
      sb.from('orders').select('customer_id, created_at, order_total').in('customer_id', ids).limit(10000),
      sb.from('zoho_unpaid_invoices').select('customer_id, balance').in('customer_id', ids).limit(5000),
      sb.from('ac_messages').select('customer_id, created_at').in('customer_id', ids).limit(10000),
      sb.from('ac_contacts').select('customer_id, sentiment_score').in('customer_id', ids).limit(5000),
    ]);

    const upserts: any[] = [];
    for (const c of customers) {
      const cid = c.id as string;
      const cOrders = (orders ?? []).filter((o: any) => o.customer_id === cid);
      const lastOrder = cOrders.map((o: any) => o.created_at).sort().at(-1) ?? null;
      const orderCount = cOrders.length;
      const totalRevenue = cOrders.reduce((s: number, o: any) => s + Number(o.order_total ?? 0), 0);

      const cUnpaid = (unpaid ?? []).filter((u: any) => u.customer_id === cid);
      const unpaidBalance = cUnpaid.reduce((s: number, u: any) => s + Number(u.balance ?? 0), 0);

      const cMsgs = (msgs ?? []).filter((m: any) => m.customer_id === cid);
      const lastMsg = cMsgs.map((m: any) => m.created_at).sort().at(-1) ?? null;
      const msgCount = cMsgs.length;

      const cContacts = (contacts ?? []).filter((k: any) => k.customer_id === cid);
      const sentAvg = cContacts.length ? cContacts.reduce((s: number, k: any) => s + Number(k.sentiment_score ?? 0), 0) / cContacts.length : 0;

      // Sub-scores (0-100)
      const usage = clamp(Math.min(100, orderCount * 10 + Math.max(0, 60 - daysSince(lastOrder))));
      const payment = clamp(unpaidBalance <= 0 ? 100 : unpaidBalance < 500 ? 80 : unpaidBalance < 2000 ? 60 : 30);
      const support = clamp(Math.min(100, 60 + Math.max(0, 40 - daysSince(lastMsg) / 2) - Math.max(0, msgCount - 20) * 2));
      const sentiment = clamp(50 + sentAvg * 50);

      const score = clamp(usage * 0.35 + payment * 0.25 + support * 0.2 + sentiment * 0.2);

      const ageDays = daysSince(c.created_at);
      let stage: string;
      if (score < 30) stage = 'risk';
      else if (score < 15) stage = 'churned';
      else if (ageDays < 30) stage = 'onboarding';
      else if (ageDays < 180 && orderCount < 3) stage = 'adopt';
      else if (score >= 75 && orderCount >= 3) stage = 'expand';
      else stage = 'renew';
      if (score < 15 || daysSince(lastOrder) > 365) stage = 'churned';

      upserts.push({
        customer_id: cid, score,
        usage_score: usage, payment_score: payment, support_score: support, sentiment_score: sentiment,
        lifecycle_stage: stage,
        factors: { orderCount, totalRevenue, unpaidBalance, msgCount, lastOrder, lastMsg, ageDays },
        computed_at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await sb.from('ac_customer_health').upsert(upserts.slice(i, i + 200), { onConflict: 'customer_id' });
      if (error) throw error;
    }

    return json({ ok: true, processed: upserts.length });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
