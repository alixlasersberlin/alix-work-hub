// Sync open deposits from existing data sources into finance_deposits.
// Does NOT modify any existing tables. Only upserts into finance_deposits.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let upserted = 0;
    const errors: string[] = [];

    // ---- 1) Zoho invoices that look like deposit invoices (AZ-...) ----
    const { data: zohoInv } = await supabase
      .from('zoho_invoices')
      .select('id, invoice_number, reference_number, customer_name, billing_address, due_date, total, balance, currency, status')
      .or('invoice_number.ilike.AZ%,invoice_number.ilike.anzahlung%')
      .gt('balance', 0)
      .limit(5000);

    for (const inv of zohoInv ?? []) {
      const gross = Number((inv as any).total) || 0;
      const balance = Number((inv as any).balance) || 0;
      const paid = Math.max(gross - balance, 0);
      const net = gross / 1.19;
      const vat = gross - net;
      const row = {
        source: 'zoho',
        source_ref: String((inv as any).id),
        deposit_number: (inv as any).invoice_number,
        invoice_number: (inv as any).invoice_number,
        order_number: (inv as any).reference_number,
        customer_name: (inv as any).customer_name,
        company_name: (inv as any).customer_name,
        gross_amount: gross,
        paid_amount: paid,
        net_amount: Math.round(net * 100) / 100,
        vat_amount: Math.round(vat * 100) / 100,
        due_date: (inv as any).due_date,
        currency: (inv as any).currency || 'EUR',
      };
      const { data: up, error } = await supabase
        .from('finance_deposits')
        .upsert(row, { onConflict: 'source,source_ref', ignoreDuplicates: false })
        .select('id').maybeSingle();
      if (error) { errors.push(`zoho ${row.source_ref}: ${error.message}`); console.error('zoho upsert', error); }
      else {
        upserted++;
        if (up?.id) await supabase.rpc('finance_deposit_recalc', { _deposit_id: up.id });
      }
    }

    // ---- 2) AlixWork orders with deposit_amount > 0 ----
    const EXCLUDED = new Set(['storniert','abgesagt','geliefert']);
    const { data: ordersAll, error: ordErr } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, customer_name, deposit_amount, order_status, created_at')
      .gt('deposit_amount', 0)
      .limit(5000);
    if (ordErr) errors.push(`orders query: ${ordErr.message}`);
    const orders = (ordersAll ?? []).filter((o: any) => !EXCLUDED.has(o.order_status));

    for (const o of orders) {
      const gross = Number((o as any).deposit_amount) || 0;
      const net = gross / 1.19;
      const vat = gross - net;
      const row = {
        source: 'alixwork',
        source_ref: `order:${(o as any).id}`,
        deposit_number: `AZ-${(o as any).order_number ?? ''}`,
        order_id: (o as any).id,
        order_number: (o as any).order_number,
        customer_id: (o as any).customer_id,
        customer_name: (o as any).customer_name,
        company_name: (o as any).customer_name,
        gross_amount: gross,
        net_amount: Math.round(net * 100) / 100,
        vat_amount: Math.round(vat * 100) / 100,
        currency: 'EUR',
      };
      const { data: up, error } = await supabase
        .from('finance_deposits')
        .upsert(row, { onConflict: 'source,source_ref', ignoreDuplicates: false })
        .select('id').maybeSingle();
      if (error) { errors.push(`order ${row.source_ref}: ${error.message}`); console.error('order upsert', error); }
      else {
        upserted++;
        if (up?.id) await supabase.rpc('finance_deposit_recalc', { _deposit_id: up.id });
      }
    }

    // ---- 3) order_additional_deposits ----
    const { data: addl } = await supabase
      .from('order_additional_deposits')
      .select('id, order_id, amount, note, created_at')
      .gt('amount', 0)
      .limit(5000);
    if (addl?.length) {
      const orderIds = [...new Set(addl.map((a: any) => a.order_id))];
      const { data: ordsMap } = await supabase
        .from('orders').select('id, order_number, customer_id, customer_name, order_status').in('id', orderIds);
      const omap = new Map((ordsMap ?? []).map((o: any) => [o.id, o]));

      for (const a of addl) {
        const o: any = omap.get((a as any).order_id);
        if (!o || ['storniert','abgesagt','geliefert'].includes(o.order_status)) continue;
        const gross = Number((a as any).amount) || 0;
        const net = gross / 1.19;
        const row = {
          source: 'alixwork',
          source_ref: `addl:${(a as any).id}`,
          deposit_number: `AZ+-${o.order_number ?? ''}`,
          order_id: o.id,
          order_number: o.order_number,
          customer_id: o.customer_id,
          customer_name: o.customer_name,
          company_name: o.customer_name,
          gross_amount: gross,
          net_amount: Math.round(net * 100) / 100,
          vat_amount: Math.round((gross - net) * 100) / 100,
          note: (a as any).note,
          currency: 'EUR',
        };
        const { data: up, error } = await supabase
          .from('finance_deposits')
          .upsert(row, { onConflict: 'source,source_ref', ignoreDuplicates: false })
          .select('id').maybeSingle();
        if (error) { errors.push(`addl ${row.source_ref}: ${error.message}`); console.error('addl upsert', error); }
        else {
          upserted++;
          if (up?.id) await supabase.rpc('finance_deposit_recalc', { _deposit_id: up.id });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, upserted, errors: errors.slice(0, 10) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
