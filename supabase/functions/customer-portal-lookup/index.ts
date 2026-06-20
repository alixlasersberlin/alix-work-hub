// Public edge function: customer portal status lookup.
// Validates order_number + zip + email against existing records and
// returns a SAFE, derived status payload. No auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  order_number: z.string().trim().min(1).max(64),
  zip: z.string().trim().min(2).max(16),
  email: z.string().trim().email().max(255),
});

const STATUS_TEXTS: Record<string, { code: number; label: string; text: string }> = {
  awaiting_deposit: {
    code: 1, label: "Warten auf Anzahlung",
    text: "Wir warten aktuell noch auf den Eingang Ihrer Anzahlung. Sobald die Zahlung verbucht wurde, wird Ihre Bestellung weiterbearbeitet.",
  },
  received: {
    code: 2, label: "Bestellung eingegangen",
    text: "Ihre Bestellung wurde erfolgreich erfasst und befindet sich aktuell in Bearbeitung.",
  },
  financing_check: {
    code: 3, label: "Prüfung Finanzierung / Vertrag",
    text: "Ihre Finanzierung bzw. Ihre Vertragsunterlagen werden derzeit geprüft.",
  },
  confirmed: {
    code: 4, label: "Bestellung bestätigt",
    text: "Ihre Bestellung wurde bestätigt und für die weitere Bearbeitung freigegeben.",
  },
  in_production: {
    code: 5, label: "In Produktion",
    text: "Ihr Gerät befindet sich aktuell in Produktion.",
  },
  qc: {
    code: 6, label: "Qualitätskontrolle",
    text: "Ihr Gerät befindet sich derzeit in der Qualitätskontrolle.",
  },
  shipping_prep: {
    code: 7, label: "Versandvorbereitung",
    text: "Ihr Gerät wird aktuell für den Versand vorbereitet.",
  },
  shipping_planned: {
    code: 8, label: "Versand / Lieferung geplant",
    text: "Ihre Lieferung befindet sich in Planung. Sie erhalten in Kürze weitere Informationen zum Liefertermin.",
  },
  delivered: {
    code: 9, label: "Ausgeliefert",
    text: "Ihre Bestellung wurde ausgeliefert. Vielen Dank für Ihr Vertrauen in Alix Lasers.",
  },
  needs_info: {
    code: 10, label: "Rückfrage erforderlich",
    text: "Für die weitere Bearbeitung Ihrer Bestellung benötigen wir noch zusätzliche Informationen. Bitte kontaktieren Sie unseren Support.",
  },
};

function normZip(v: any): string {
  return String(v ?? "").replace(/\s+/g, "").trim();
}
function normEmail(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}
function normOrderNumber(v: any): string {
  // Strip Austria UI suffix "-AT" if user typed it; DB stores raw Zoho number.
  return String(v ?? "").trim().replace(/-AT$/i, "");
}

// Rate-Limit für öffentlichen Portal-Lookup
const PORTAL_MAX = 15;
const PORTAL_WINDOW_SEC = 300; // 5 min

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orderNumber = normOrderNumber(parsed.data.order_number);
    const zip = normZip(parsed.data.zip);
    const email = normEmail(parsed.data.email);

    if (!orderNumber || !zip || !email) {
      return new Response(JSON.stringify({ ok: false, error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const ua = req.headers.get('user-agent') ?? '';

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate-Limit gegen Brute-Force auf Bestellnummern
    try {
      const bucket = `portal-lookup:${ip || email || 'anon'}`;
      const { data: limited } = await supabase.rpc('check_rate_limit', {
        _bucket: bucket,
        _max: PORTAL_MAX,
        _window_seconds: PORTAL_WINDOW_SEC,
      });
      if (limited === true) {
        try {
          await supabase.rpc('log_audit_event', {
            _action: 'rate_limit_hit',
            _module: 'customer_portal',
            _record_id: null,
            _details: { endpoint: 'customer-portal-lookup', ip, email } as any,
            _ip_address: ip || null,
            _user_agent: ua || null,
          });
        } catch { /* ignore */ }
        return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(PORTAL_WINDOW_SEC) },
        });
      }
    } catch { /* never block on limiter errors */ }

    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, order_status, deposit_ok, expected_shipment_date, billing_address, shipping_address, customer_id, source_system")
      .eq("order_number", orderNumber)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("email, company_name, contact_name")
      .eq("id", order.customer_id)
      .maybeSingle();

    const billZip = normZip((order.billing_address as any)?.zip);
    const shipZip = normZip((order.shipping_address as any)?.zip);
    const custEmail = normEmail(customer?.email);

    const zipOk = zip && (zip === billZip || zip === shipZip);
    const emailOk = email && email === custEmail;

    if (!zipOk || !emailOk) {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive portal status
    const os = String(order.order_status || "").toLowerCase();
    let key = "received";

    if (os === "storniert") {
      key = "needs_info";
    } else if (os === "hold" || os === "anwalt") {
      key = "needs_info";
    } else if (os === "geliefert" || os === "abgeschlossen") {
      key = "delivered";
    } else if (os === "teilgeliefert") {
      key = "shipping_planned";
    } else {
      // Production state
      const { data: po } = await supabase
        .from("production_orders")
        .select("status, approval_status, sent_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const hasApprovedPO = po && po.approval_status === "approved" && po.status === "gesendet";

      // Financing check
      const { data: bf } = await supabase
        .from("bank_financing_requests")
        .select("status")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hasApprovedPO) {
        if (order.expected_shipment_date) key = "shipping_prep";
        else key = "in_production";
      } else if (bf && bf.status === "pending") {
        key = "financing_check";
      } else if (!order.deposit_ok) {
        key = "awaiting_deposit";
      } else {
        key = "confirmed";
      }
    }

    // Optional tracking note (stored in order_notes with note_type='portal_tracking')
    const { data: trackNote } = await supabase
      .from("order_notes")
      .select("note_text")
      .eq("order_id", order.id)
      .eq("note_type", "portal_tracking")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const status = STATUS_TEXTS[key];
    const payload = {
      ok: true,
      order_number: order.order_number,
      status_code: status.code,
      status_label: status.label,
      status_text: status.text,
      expected_delivery: order.expected_shipment_date,
      tracking_number: trackNote?.note_text || null,
      customer_name: customer?.contact_name || customer?.company_name || null,
    };

    return new Response(JSON.stringify(payload), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[customer-portal-lookup]", e);
    return new Response(JSON.stringify({ ok: false, error: "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
