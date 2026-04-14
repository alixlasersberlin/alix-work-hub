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

    let body: { challenge_id: string; otp: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.challenge_id || !body.otp || body.otp.length !== 6) {
      return new Response(JSON.stringify({ error: "Challenge-ID und 6-stelliger OTP-Code erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get the challenge
    const { data: challenge, error: fetchError } = await adminClient
      .from("otp_challenges")
      .select("*")
      .eq("id", body.challenge_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !challenge) {
      return new Response(JSON.stringify({ error: "OTP-Challenge nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already blocked
    if (challenge.challenge_status === "blocked") {
      return new Response(JSON.stringify({
        error: "OTP-Verifikation gesperrt. Bitte wenden Sie sich an Ihren Administrator.",
        blocked: true,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already verified
    if (challenge.challenge_status === "verified") {
      return new Response(JSON.stringify({ error: "OTP wurde bereits verwendet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (new Date(challenge.expires_at) < new Date()) {
      await adminClient
        .from("otp_challenges")
        .update({ challenge_status: "expired" })
        .eq("id", challenge.id);

      return new Response(JSON.stringify({ error: "OTP-Code ist abgelaufen. Bitte fordern Sie einen neuen Code an." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check max attempts
    if (challenge.attempt_count >= challenge.max_attempts) {
      await adminClient
        .from("otp_challenges")
        .update({ challenge_status: "blocked", blocked_at: new Date().toISOString() })
        .eq("id", challenge.id);

      return new Response(JSON.stringify({
        error: "Maximale Versuche überschritten. OTP-Verifikation gesperrt.",
        blocked: true,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash the submitted OTP and compare
    const submittedHash = await hashOtp(body.otp);
    const isValid = submittedHash === challenge.otp_hash;

    if (!isValid) {
      const newAttemptCount = challenge.attempt_count + 1;
      const isNowBlocked = newAttemptCount >= challenge.max_attempts;

      await adminClient
        .from("otp_challenges")
        .update({
          attempt_count: newAttemptCount,
          ...(isNowBlocked
            ? { challenge_status: "blocked", blocked_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", challenge.id);

      const remaining = challenge.max_attempts - newAttemptCount;

      return new Response(JSON.stringify({
        error: isNowBlocked
          ? "Maximale Versuche überschritten. OTP-Verifikation gesperrt."
          : `Ungültiger OTP-Code. ${remaining} Versuch(e) verbleibend.`,
        blocked: isNowBlocked,
        remaining_attempts: remaining,
      }), {
        status: isNowBlocked ? 429 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OTP is valid - mark as verified
    const now = new Date().toISOString();
    await adminClient
      .from("otp_challenges")
      .update({ challenge_status: "verified", verified_at: now })
      .eq("id", challenge.id);

    // Update user profile last_otp_verified_at
    await adminClient
      .from("user_profiles")
      .update({ last_otp_verified_at: now })
      .eq("id", user.id);

    // Update login session if linked
    if (challenge.session_id) {
      await adminClient
        .from("login_sessions")
        .update({ otp_verified_at: now, reauth_required: false })
        .eq("id", challenge.session_id);
    }

    return new Response(JSON.stringify({
      success: true,
      verified_at: now,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("verify-otp-challenge error:", error);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
