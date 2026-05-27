// One-off test: triggers full Alix Austria (zoho_eu_2) import via service-role,
// then returns counts written to Supabase.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function invoke(fn: string, body: Record<string, unknown>) {
  const t0 = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { fn, status: res.status, ms: Date.now() - t0, body: json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const beforeC = await admin.from('customers').select('id', { count: 'exact', head: true }).eq('source_system', 'zoho_eu_2');
  const beforeO = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', 'zoho_eu_2');

  // 1) Customers (limit 1)
  const r1 = await invoke('scheduled-customer-sync', { source_system: 'zoho_eu_2', days_back: 3650, max_contacts: 1 });
  // 2) Items (limit 1)
  const r2 = await invoke('sync-zoho-items', { source_system: 'zoho_eu_2', per_page: 1, max_pages: 1 });
  // 3) Orders (limit 1)
  const r3 = await invoke('scheduled-order-sync', { source_system: 'zoho_eu_2', days_back: 365, max_orders: 1 });

  const afterC = await admin.from('customers').select('id', { count: 'exact', head: true }).eq('source_system', 'zoho_eu_2');
  const afterO = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', 'zoho_eu_2');
  const afterI = await admin.from('invoice_workflow_states').select('id', { count: 'exact', head: true }).eq('source', 'zoho_eu_2');

  const sampleCustomers = await admin
    .from('customers')
    .select('external_customer_id, company_name, contact_name, email')
    .eq('source_system', 'zoho_eu_2')
    .limit(5);

  const sampleOrders = await admin
    .from('orders')
    .select('order_number, order_status, total_amount, currency, order_date')
    .eq('source_system', 'zoho_eu_2')
    .order('order_date', { ascending: false })
    .limit(5);

  return new Response(JSON.stringify({
    counts: {
      customers: { before: beforeC.count ?? 0, after: afterC.count ?? 0 },
      orders:    { before: beforeO.count ?? 0, after: afterO.count ?? 0 },
      invoices:  { after: afterI.count ?? 0 },
    },
    runs: [r1, r2, r3],
    sample_customers: sampleCustomers.data ?? [],
    sample_orders: sampleOrders.data ?? [],
  }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
