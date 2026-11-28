import { createOrderOnce, OrderIdentityConflict } from './order-identity.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { ORDER_CONFIRMATION_ROLES } from '../_shared/security-v42-mail.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const access = await requireCallerAccess(req, corsHeaders, ORDER_CONFIRMATION_ROLES);
    if ('response' in access) return access.response;
    const { offer_number } = await req.json().catch(() => ({}));
    if (!offer_number || typeof offer_number !== 'string' || offer_number.length > 128 || !/^[A-Za-z0-9-]+$/.test(offer_number)) {
      return new Response(JSON.stringify({ error: 'offer_number required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = access.caller;

    // Nummernkreis-Regel: Auftragsnummern IMMER mit "AB-"-Präfix speichern
    const base = offer_number.replace(/^ANG-/i, '').replace(/^AB-/i, '');
    const order_number = `AB-${base}`;
    const legacy_order_number = base; // Alt-Datensätze ohne Präfix erkennen

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

    let payload: any = sr.offer_payload || {};

    // Fallback: Wenn im Signatur-Snapshot keine Positionen stehen,
    // Positionen/Zahlung aus dem Original-Angebot nachladen.
    if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
      const { data: off } = await supabase
        .from('offers')
        .select('payload')
        .eq('offer_number', offer_number)
        .maybeSingle();
      const offPayload: any = off?.payload || {};
      if (Array.isArray(offPayload.lines) && offPayload.lines.length > 0) {
        payload = { ...offPayload, ...payload, lines: offPayload.lines };
      }
    }

    const totals = payload.totals || {};
    const customer_id = sr.customer_id || payload.customer?.id;

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id missing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get customer source_system for consistency
    const { data: cust, error: customerError } = await supabase
      .from('customers').select('source_system').eq('id', customer_id).maybeSingle();
    if (customerError) throw customerError;
    const source_system = cust?.source_system;
    if (!source_system || !access.tenants.some((tenant: { zoho_source_system: string | null }) => tenant.zoho_source_system === source_system)) return new Response('Forbidden', { status: 403, headers: corsHeaders });

    const payment = payload.payment || {};
    const downPayment = Number(payment.down) || null;
    const termMonths = payment.term != null ? Number(payment.term) : null;
    const purchasePrice = Number(payment.price) || Number(totals.gross) || null;

    // Bestelldatum = Unterzeichnungsdatum des Auftrags (Fallback: jetzt)
    let orderDateIso: string = new Date().toISOString();
    if (sr.signed_at) {
      orderDateIso = sr.signed_at as string;
    }

    let expectedShipmentIso: string | null = null;
    if (typeof payload.deliveryWeek === 'string') {
      const m = payload.deliveryWeek.match(/^(\d{4})-W(\d{2})$/);
      if (m) {
        const year = parseInt(m[1], 10);
        const week = parseInt(m[2], 10);
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const jan4Dow = jan4.getUTCDay() || 7;
        const week1Monday = new Date(jan4);
        week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
        const monday = new Date(week1Monday);
        monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
        expectedShipmentIso = monday.toISOString();
      }
    }

    const { order, already } = await createOrderOnce(supabase, {
        customer_id,
        order_number,
        source_system,
        order_status: 'offen',
        currency: 'EUR',
        total_amount: totals.gross ?? null,
        order_date: orderDateIso,
        expected_shipment_date: expectedShipmentIso,
        deposit_amount: downPayment,
        raw_data: { from_alix_sign: true, offer_payload: payload, offer_date: payload.offerDate || null, delivery_week: payload.deliveryWeek || null },
      }, legacy_order_number);
    if (already) {
      return new Response(JSON.stringify({ ok: true, already: true, order_id: order.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
          tax_amount: qty * rate * ((Number(l.tax_percentage) || 0) / 100),
          // Gerätekonfiguration aus dem unterschriebenen Angebot übernehmen
          ph_product_id: l.ph_product_id || null,
          ph_product_name: l.ph_product_name || null,
          product_image_url: l.product_image_url || l.image_url || null,
          device_color: l.device_color || null,
          ral_color_code: l.ral_color_code || null,
          laser_module_power: l.laser_module_power || null,
          raw_data: (l.device_color || l.laser_module_power) ? {
            device_config: {
              product_id: l.ph_product_id || null,
              product_name: l.ph_product_name || l.name,
              product_image_url: l.product_image_url || l.image_url || null,
              device_color: l.device_color || null,
              ral_color_code: l.ral_color_code || null,
              laser_module_power: l.laser_module_power || null,
            },
          } : null,
        };
      });
      const { error: iErr } = await supabase.from('order_items').insert(items);
      if (iErr) throw iErr;
    }

    // Finanzierung aus Angebot übernehmen (Alix Flex, Mietkauf, Leasing etc.)
    const paymentType = String(payment.type || '').toLowerCase();
    const isFinancing = paymentType.includes('flex') || paymentType.includes('leasing') || paymentType.includes('mietkauf') || paymentType.includes('finanz');
    if (isFinancing && (purchasePrice || termMonths || downPayment)) {
      const { error: bfErr } = await supabase.from('bank_financing_requests').insert({
        order_id: order.id,
        request_date: (sr.signed_at || new Date().toISOString()).slice(0, 10),
        purchase_price: purchasePrice,
        down_payment: downPayment,
        term_months: termMonths,
        status: 'open',
        decision_text: `Aus Angebot übernommen: ${payment.type || 'Finanzierung'}`,
      });
      if (bfErr) console.warn('bank_financing_requests insert failed', bfErr);
    }

    // Erst nach vollständiger Anlage der Positionen und Finanzierung festschreiben und einplanen.
    const { error: scheduleError } = await supabase.rpc('auto_az_enqueue', { p_order_id: order.id });
    if (scheduleError) throw scheduleError;

    return new Response(JSON.stringify({ ok: true, order_id: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: e instanceof OrderIdentityConflict ? 409 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
