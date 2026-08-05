import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * CMR Kundenportal: liefert zu einem gültigen Zugangstoken die Belege,
 * offenen Posten und Zahlungen des Kunden. Kein Login, kein Datenbank-Direktzugriff –
 * gelesen wird ausschließlich hier serverseitig und streng auf den Kunden gefiltert.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string" || token.length < 16) {
      return Response.json({ error: "Ungültiger Zugangslink" }, { status: 400, headers: corsHeaders });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: access } = await sb
      .from("cmr_portal_tokens").select("*").eq("token", token).maybeSingle();

    if (!access || !access.is_active) {
      return Response.json({ error: "Zugang nicht gefunden oder deaktiviert" }, { status: 404, headers: corsHeaders });
    }
    if (access.expires_at && new Date(access.expires_at).getTime() < Date.now()) {
      return Response.json({ error: "Zugangslink abgelaufen" }, { status: 410, headers: corsHeaders });
    }

    const { data: settings } = await sb
      .from("cmr_settings").select("company_name,logo_url,email,phone,website,default_currency,portal_payment_url")
      .eq("tenant_id", access.tenant_id).maybeSingle();

    let dq = sb.from("cmr_documents")
      .select("id,doc_number,doc_type,status,doc_date,due_date,currency,net_total,tax_total,gross_total,paid_total,reference")
      .eq("tenant_id", access.tenant_id)
      .neq("status", "entwurf")
      .order("doc_date", { ascending: false })
      .limit(300);
    dq = access.customer_id
      ? dq.eq("customer_id", access.customer_id)
      : dq.eq("customer_email", access.customer_email ?? "___");
    const { data: documents } = await dq;

    const docIds = (documents ?? []).map((d: any) => d.id);
    const { data: payments } = docIds.length
      ? await sb.from("cmr_payments").select("id,document_id,paid_on,amount,currency,method")
        .in("document_id", docIds).order("paid_on", { ascending: false }).limit(500)
      : { data: [] as any[] };

    await sb.from("cmr_portal_tokens").update({
      last_access_at: new Date().toISOString(),
      access_count: Number(access.access_count || 0) + 1,
    }).eq("id", access.id);

    const open = (documents ?? []).filter(
      (d: any) => d.doc_type !== "gutschrift" && Number(d.gross_total || 0) - Number(d.paid_total || 0) > 0.01,
    );

    return Response.json({
      ok: true,
      customer: { name: access.customer_name, email: access.customer_email },
      company: settings ?? null,
      currency: settings?.default_currency ?? "AED",
      payment_url: settings?.portal_payment_url ?? null,
      documents: documents ?? [],
      payments: payments ?? [],
      summary: {
        documents: documents?.length ?? 0,
        open_count: open.length,
        open_amount: open.reduce((s: number, d: any) => s + (Number(d.gross_total) - Number(d.paid_total)), 0),
      },
    }, { headers: corsHeaders });
  } catch (e) {
    console.error("cmr-portal-lookup failed:", e);
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
