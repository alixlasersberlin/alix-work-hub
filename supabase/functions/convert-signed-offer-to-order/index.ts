import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { offer_number } = await req.json().catch(() => ({}));
    if (!offer_number || typeof offer_number !== 'string') {
      return new Response(JSON.stringify({ error: 'offer_number required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const order_number = offer_number.replace(/^ANG-/i, '');

    // Already converted?
    const { data: existing } = await supabase
      .from('orders').select('id, order_number').eq('order_number', order_number).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, already: true, order_id: existing.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Latest signed sign-request
    const { data: sr, error: srErr } = await supabase
      .from('alix_sign_requests')
      .select('offer_number, customer_id, offer_payload, signed_at')
      .eq('offer_number', offer_number)
      .eq('status', 'unterschrieben')
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (srErr) throw srErr;
    if (!sr) {
      return new Response(JSON.stringify({ error: 'no signed request found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: any = sr.offer_payload || {};
    const totals = payload.totals || {};
    const customer_id = sr.customer_id || payload.customer?.id;
    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id missing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get customer source_system for consistency
    const { data: cust } = await supabase
      .from('customers').select('source_system').eq('id', customer_id).maybeSingle();
    const source_system = cust?.source_system || 'zoho_eu_1';

    const { data: order, error: oErr } = await supabase
      .from('orders')
      .insert({
        customer_id,
        order_number: offer_number,
        source_system,
        order_status: 'offen',
        currency: 'EUR',
        total_amount: totals.gross ?? null,
        order_date: sr.signed_at || new Date().toISOString(),
        raw_data: { from_alix_sign: true, offer_payload: payload },
      })
      .select('id')
      .single();
    if (oErr) throw oErr;

    const lines: any[] = Array.isArray(payload.lines) ? payload.lines : [];
    if (lines.length > 0) {
      const items = lines.map((l, idx) => {
        const qty = Number(l.quantity) || 0;
        const rate = Number(l.rate) || 0;
        return {
          order_id: order.id,
          item_name: l.name || null,
          description: l.description || null,
          sku: l.sku || null,
          quantity: qty,
          rate,
          amount: qty * rate,
          item_order: idx + 1,
        };
      });
      const { error: iErr } = await supabase.from('order_items').insert(items);
      if (iErr) throw iErr;
    }

    return new Response(JSON.stringify({ ok: true, order_id: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
