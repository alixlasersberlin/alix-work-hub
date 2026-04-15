import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Ungültige Sitzung" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("otp_channel, phone_number, email")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Benutzerprofil nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channel = profile.otp_channel || "email";
    const destination = channel === "sms" ? profile.phone_number : profile.email;

    if (!destination) {
      return new Response(JSON.stringify({ error: `Kein ${channel === "sms" ? "Telefonnummer" : "E-Mail"} hinterlegt` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing blocked challenges
    const { data: existingBlocked } = await adminClient
      .from("otp_challenges")
      .select("id, blocked_at")
      .eq("user_id", user.id)
      .eq("challenge_status", "blocked")
      .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(1);

    if (existingBlocked && existingBlocked.length > 0) {
      return new Response(JSON.stringify({
        error: "OTP-Verifikation vorübergehend gesperrt. Bitte versuchen Sie es später erneut.",
        blocked: true,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    let sessionId: string | null = null;
    let challengeReason = "login";
    try {
      const body = await req.json();
      sessionId = body.session_id || null;
      challengeReason = body.reason || "login";
    } catch {
      // no body is fine
    }

    // Create OTP challenge record
    const { data: challenge, error: insertError } = await adminClient
      .from("otp_challenges")
      .insert({
        user_id: user.id,
        channel,
        otp_hash: otpHash,
        expires_at: expiresAt,
        challenge_status: "pending",
        challenge_reason: challengeReason,
        session_id: sessionId,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create OTP challenge:", insertError);
      return new Response(JSON.stringify({ error: "OTP konnte nicht erstellt werden" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send OTP via appropriate channel
    if (channel === "sms") {
      await sendSmsTwilio(destination, otp);
    } else {
      // Send OTP via transactional email
      await sendOtpEmail(adminClient, destination, otp);
    }

    console.log(`[OTP] User ${user.id} | Channel: ${channel} | Challenge: ${challenge.id} | Sent to: ${channel === "sms" ? "***" + destination.slice(-4) : destination.slice(0, 3) + "***@" + destination.split("@")[1]}`);

    return new Response(JSON.stringify({
      success: true,
      challenge_id: challenge.id,
      channel,
      destination_hint: channel === "sms"
        ? `***${destination.slice(-4)}`
        : `${destination.slice(0, 3)}***@${destination.split("@")[1]}`,
      expires_at: expiresAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-otp-challenge error:", error);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendOtpEmail(adminClient: any, to: string, otp: string): Promise<void> {
  const { error } = await adminClient.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'otp-code',
      recipientEmail: to,
      idempotencyKey: `otp-${to}-${Date.now()}`,
      templateData: { otp },
    },
  });

  if (error) {
    console.error("Failed to send OTP email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`[OTP-EMAIL] Email OTP sent to ${to.slice(0, 3)}***@${to.split("@")[1]}`);
}

async function sendSmsTwilio(to: string, otp: string): Promise<void> {
  const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
  const TWILIO_FROM_NUMBER = "+19542313571";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

  const response = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: TWILIO_FROM_NUMBER,
      Body: `Ihr Alix Work Sicherheitscode: ${otp}\n\nDieser Code ist 5 Minuten gültig. Teilen Sie ihn niemals mit anderen.`,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Twilio SMS error:", JSON.stringify(data));
    throw new Error(`Twilio API error [${response.status}]: ${data.message || JSON.stringify(data)}`);
  }

  console.log(`[TWILIO] SMS sent successfully. SID: ${data.sid}`);
}

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
