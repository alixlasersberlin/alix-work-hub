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

    // Verify the user with their JWT
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

    // Get user profile for OTP channel
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

    // Check for existing active/blocked challenges
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

    // Body may contain session_id and reason
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

    // In production, send OTP via SMS/Email service here.
    // For now, log OTP for testing (remove in production)
    console.log(`[OTP] User ${user.id} | Channel: ${channel} | OTP: ${otp} | Challenge: ${challenge.id}`);

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

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
