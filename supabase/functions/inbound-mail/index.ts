// Alix MailCenter – Inbound mail webhook.
// Eingehende E-Mails landen NICHT mehr im MailCenter-Posteingang, sondern
// werden direkt als Tickets in der CUSTOMER SERVICE / Ticketliste (/tickets)
// angelegt. Das Reply-To-Mapping bleibt für die Weiterleitung an die
// externen Mailboxen erhalten.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Reply-To Mapping (nur Doku – Zustellung übernimmt der Mailprovider)
const FORWARD_MAP: Record<string, string> = {
  "finance@alixwork.de": "k.trinh@alix-operation.de",
  "vertrieb@alixwork.de": "rde@alix-lasers.com",
  "service@alixwork.de": "support@alix-lasers.com",
  "news@alixwork.de": "support@alix-operation.de",
};

const MAILBOX_TO_DEPARTMENT: Record<string, string> = {
  "finance@alixwork.de": "Finance",
  "vertrieb@alixwork.de": "Vertrieb",
  "service@alixwork.de": "Service",
  "news@alixwork.de": "Marketing",
};

function pickEmail(v: any): string {
  if (!v) return "";
  if (Array.isArray(v)) return pickEmail(v[0]);
  if (typeof v === "object") return String(v.email ?? v.address ?? "");
  return String(v);
}

function pickName(v: any): string {
  if (!v) return "";
  if (Array.isArray(v)) return pickName(v[0]);
  if (typeof v === "object") return String(v.name ?? v.full_name ?? "");
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const data = (payload as any)?.data ?? payload;

    const fromEmail = pickEmail(data?.from);
    const fromName = pickName(data?.from);
    const toEmail = pickEmail(data?.to).toLowerCase();
    const subject = String(data?.subject ?? "(ohne Betreff)").slice(0, 500);
    const bodyText: string = data?.text ?? data?.body_text ?? data?.plain ?? "";
    const bodyHtml: string = data?.html ?? data?.body_html ?? "";
    const description = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 4000) : "");

    const department = MAILBOX_TO_DEPARTMENT[toEmail] ?? "Service";
    const forwardTo = FORWARD_MAP[toEmail] ?? null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Kunden-Zuordnung per Absender-Email (best effort)
    let customerId: string | null = null;
    let companyName: string | null = null;
    let customerName: string | null = fromName || null;
    if (fromEmail) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id, company_name, contact_name")
        .ilike("email", fromEmail)
        .maybeSingle();
      if (cust) {
        customerId = cust.id;
        companyName = cust.company_name ?? null;
        customerName = cust.contact_name ?? customerName;
      }
    }

    const externalId =
      String(data?.message_id ?? data?.id ?? data?.headers?.["message-id"] ?? crypto.randomUUID())
        .replace(/[<>]/g, "")
        .slice(0, 255);

    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        source_system: "email_inbound",
        external_ticket_id: externalId,
        department,
        status: "offen",
        priority: "Normal",
        customer_visible_status: "Ticket eingegangen",
        title: subject,
        subject,
        description,
        customer_email: fromEmail || null,
        customer_name: customerName,
        company_name: companyName,
        internal_note: `Eingegangen an ${toEmail}${forwardTo ? ` (Reply-To → ${forwardTo})` : ""}`,
      })
      .select("id, ticket_number")
      .single();

    if (error) {
      console.error("inbound-mail: ticket insert failed", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("inbound-mail: ticket created", { ticket_id: ticket?.id, to: toEmail, from: fromEmail });

    return new Response(
      JSON.stringify({ success: true, ticket_id: ticket?.id, ticket_number: ticket?.ticket_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("inbound-mail error", err);
    return new Response(
      JSON.stringify({ success: false, error: String((err as Error)?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
