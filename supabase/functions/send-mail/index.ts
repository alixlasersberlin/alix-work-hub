import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Missing environment secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require logged-in user with MailCenter access
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: canMail } = await authClient.rpc("can_access_mail");
    if (!canMail) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      template_id,
      customer_id,
      order_id,
      invoice_id,
      ticket_id,
      repair_id,
      to_email,
      to_name,
      from_email,
      from_name,
      subject_variables = {},
      body_variables = {},
    } = await req.json();

    if (!template_id || !to_email || !from_email) {
      return new Response(
        JSON.stringify({ error: "template_id, to_email and from_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: template, error: templateError } = await supabase
      .from("mail_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const variables: Record<string, string> = {
      ...subject_variables,
      ...body_variables,
      kunde: to_name || "",
      email: to_email,
    };

    const replaceVariables = (text: string | null) => {
      if (!text) return "";
      return text.replace(/\{\{(.*?)\}\}/g, (_, key) => {
        const cleanKey = key.trim();
        return variables[cleanKey] ?? "";
      });
    };

    const finalSubject = replaceVariables(template.subject);
    const finalHtml = replaceVariables(template.body_html);
    const finalText = replaceVariables(template.body_text);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${from_name || "Alix MailCenter"} <${from_email}>`,
        to: [to_name ? `${to_name} <${to_email}>` : to_email],
        subject: finalSubject,
        html: finalHtml,
        text: finalText || undefined,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      await supabase.from("mail_messages").insert({
        customer_id,
        order_id,
        invoice_id,
        ticket_id,
        repair_id,
        template_id,
        to_email,
        to_name,
        from_email,
        from_name,
        subject: finalSubject,
        body_html: finalHtml,
        body_text: finalText,
        status: "failed",
        error_message: JSON.stringify(resendData),
      });

      return new Response(JSON.stringify({ error: resendData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: insertError } = await supabase
      .from("mail_messages")
      .insert({
        customer_id,
        order_id,
        invoice_id,
        ticket_id,
        repair_id,
        template_id,
        to_email,
        to_name,
        from_email,
        from_name,
        subject: finalSubject,
        body_html: finalHtml,
        body_text: finalText,
        status: "sent",
        provider_message_id: resendData.id,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("mail_events").insert({
      message_id: message.id,
      event_type: "sent",
      event_data: resendData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        resend_id: resendData.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
