import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const rawCode = String(body.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{5}-?[A-Z0-9]{5}$/.test(rawCode)) {
    return json({ error: "Ungültiges Code-Format" }, 400);
  }
  const code = rawCode.includes("-") ? rawCode : `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: pErr } = await admin
    .from("user_profiles")
    .select("mfa_recovery_codes_hash")
    .eq("id", userId)
    .maybeSingle();
  if (pErr || !profile) return json({ error: "Profil nicht gefunden" }, 404);

  const hash = await sha256(code);
  const remaining: string[] = (profile.mfa_recovery_codes_hash ?? []).filter((h: string) => h !== hash);
  if (remaining.length === (profile.mfa_recovery_codes_hash ?? []).length) {
    return json({ error: "Recovery-Code ungültig oder bereits verwendet" }, 401);
  }

  // Delete all MFA factors of this user (force re-enrollment)
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  }

  await admin
    .from("user_profiles")
    .update({
      mfa_recovery_codes_hash: remaining,
      mfa_enrolled_at: null,
    })
    .eq("id", userId);

  return json({ success: true });
});

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
