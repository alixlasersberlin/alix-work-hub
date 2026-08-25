// Prüft einen SMS-Code für die Zwei-Faktor-Verifizierung (Super Admin).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code" }, 400);

    const { data: row } = await admin
      .from("mfa_sms_codes")
      .select("id, purpose, phone, code_hash, attempts, expires_at")
      .eq("user_id", user.id)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return json({ error: "no_pending_code" }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 400);
    if (row.attempts >= 5) return json({ error: "too_many_attempts" }, 429);

    const expected = await sha256(`${user.id}:${code}`);
    if (expected !== row.code_hash) {
      await admin.from("mfa_sms_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return json({ error: "wrong_code" }, 400);
    }

    await admin
      .from("mfa_sms_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    if (row.purpose === "enroll") {
      await admin.from("mfa_sms_factors").upsert(
        {
          user_id: user.id,
          phone: row.phone,
          enabled: true,
          verified_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }

    return json({ ok: true, purpose: row.purpose });
  } catch (e) {
    console.error("mfa-sms-verify error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
