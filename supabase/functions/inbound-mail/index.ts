// Alix MailCenter – Inbound mail webhook (Resend Inbound or compatible).
// Maps incoming emails to a mailbox based on the recipient address,
// links to a customer by sender email if found, and creates an in-app
// notification for the responsible department.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mailboxFor(addr: string): string {
  const a = addr.toLowerCase();
  if (a.startsWith("news@")) return "marketing";
  if (a.startsWith("finance@")) return "finance";
  if (a.startsWith("vertrieb@")) return "vertrieb";
  if (a.startsWith("service@")) return "service";
  return "personal";
}

const DEPT_TO_ROLES: Record<string, string[]> = {
  finance: ["Finance"],
  vertrieb: ["Vertrieb", "Order"],
  service: ["Technik", "Kundenservice", "Reparaturannahme"],
  marketing: ["Marketing"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing env", { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const payload = await req.json();
    // Accept multiple provider shapes
    const data = payload?.data ?? payload;
    const fromRaw = data.from?.email ?? data.from ?? data.sender ?? "";
    const fromName = data.from?.name ?? null;
    const toRaw = Array.isArray(data.to) ? (data.to[0]?.email ?? data.to[0]) : (data.to?.email ?? data.to ?? "");
    const subject = data.subject ?? "(kein Betreff)";
    const html = data.html ?? data.body_html ?? "";
    const text = data.text ?? data.body_text ?? "";
    const providerId = data.message_id ?? data.id ?? null;
    const inReplyTo = data.in_reply_to ?? data.headers?.["in-reply-to"] ?? null;

    if (!fromRaw || !toRaw) {
      return new Response(JSON.stringify({ error: "missing from/to" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mailbox = mailboxFor(toRaw);

    // Try to match an existing customer by email
    const { data: customer } = await supabase
      .from("customers").select("id, contact_name, company_name")
      .ilike("email", fromRaw).limit(1).maybeSingle();

    const { data: msg, error: insertErr } = await supabase
      .from("mail_messages")
      .insert({
        customer_id: customer?.id ?? null,
        to_email: toRaw,
        to_name: null,
        from_email: fromRaw,
        from_name: fromName,
        subject,
        body_html: html,
        body_text: text,
        status: "received",
        direction: "inbound",
        mailbox,
        is_read: false,
        priority: "Normal",
        provider_message_id: providerId,
        in_reply_to: inReplyTo,
        sent_at: new Date().toISOString(),
      })
      .select().single();

    if (insertErr) {
      console.error("insert inbound failed", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify all users in the responsible department
    const roles = DEPT_TO_ROLES[mailbox] ?? [];
    if (roles.length) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(name)")
        .in("roles.name", roles);
      const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
      if (userIds.length) {
        await supabase.from("mail_notifications").insert(
          userIds.map((uid) => ({
            user_id: uid,
            type: "inbound_mail",
            title: `Neue E-Mail von ${fromName ?? fromRaw}`,
            body: subject,
            link: `/mailcenter/posteingang?id=${msg.id}`,
          })),
        );
      }
    }

    return new Response(JSON.stringify({ success: true, id: msg.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("inbound-mail error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
