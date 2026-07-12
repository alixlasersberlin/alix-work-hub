// Public endpoint: Ticket-Anfrage aus dem Buchungsportal (/book).
// Legt ein Ticket in `public.tickets` an (Service Role) und setzt eine
// 2-Tage-Wiedervorlage via `follow_up_at`.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      firstName = "",
      lastName = "",
      email = "",
      phone = "",
      company = "",
      website = "",
      service = "",
      department = "",
      message = "",
      consentMarketing = false,
      bookingNumber = "",
    } = body || {};

    if (!email || !firstName) {
      return new Response(JSON.stringify({ error: "Vor- und Nachname sowie E-Mail sind erforderlich." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Kunden-Zuordnung best effort
    let companyName: string | null = company || null;
    const { data: cust } = await supabase
      .from("customers")
      .select("id, company_name, contact_name")
      .ilike("email", email)
      .maybeSingle();
    if (cust?.company_name) companyName = cust.company_name;

    const followUpAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const title = `${service || "Ticket-Anfrage"} · ${firstName} ${lastName}`.trim();

    const note = [
      `Eingegangen über Buchungsportal (/book)`,
      bookingNumber ? `Buchungsnummer: ${bookingNumber}` : null,
      website ? `Webseite: ${website}` : null,
      phone ? `Telefon: ${phone}` : null,
      company ? `Firma: ${company}` : null,
      consentMarketing ? `Marketing-Einwilligung: ja` : null,
      `Wiedervorlage: ${new Date(followUpAt).toLocaleString("de-DE")}`,
    ].filter(Boolean).join("\n");

    // Ticket-Abteilung auflösen (falls Name mitgegeben)
    let ticketDepartmentId: string | null = null;
    if (department) {
      const { data: dept } = await supabase
        .from("ticket_departments")
        .select("id")
        .ilike("name", department)
        .maybeSingle();
      ticketDepartmentId = (dept as any)?.id ?? null;
    }

    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        source_system: "booking_portal",
        source: "kundenportal",
        external_ticket_id: bookingNumber || null,
        department: department || "Service",
        ticket_department_id: ticketDepartmentId,
        category: service || null,
        status: "Neu",
        priority: "Normal",
        customer_visible_status: "Ticket eingegangen",
        title,
        description: message || null,
        customer_email: email,
        customer_name: `${firstName} ${lastName}`.trim(),
        company_name: companyName,
        customer_phone: phone || null,
        internal_note: note,
        follow_up_at: followUpAt,
      })
      .select("id, ticket_number, follow_up_at")
      .single();

    if (error) {
      console.error("public-book-ticket insert failed", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket_id: ticket?.id,
        ticket_number: ticket?.ticket_number,
        follow_up_at: ticket?.follow_up_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("public-book-ticket error", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
