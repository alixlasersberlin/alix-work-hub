// OAuth callback handler for Google & Microsoft calendar connections.
// POST (signed-in) { action: "issue_state" } -> server-signed, 10-minute state bound to the caller.
// GET /esc-calendar-oauth?provider=google|microsoft&code=...&state=<signed state>
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireCallerAccess } from "../_shared/caller-access.ts";
import { signState, verifyState } from "../_shared/signed-state.ts";
import { escapeHtml } from "../_shared/security-core.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function html(msg: string, ok = true) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Kalender-Verbindung</title>
     <div style="font-family:system-ui;padding:2rem;text-align:center">
       <h1 style="color:${ok ? "#16a34a" : "#dc2626"}">${ok ? "✔ Verbunden" : "✘ Fehler"}</h1>
       <p>${escapeHtml(msg)}</p>
       <p><a href="/esc/einstellungen">Zurück zu den Einstellungen</a></p>
     </div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "POST") {
    const access = await requireCallerAccess(req, corsHeaders, []);
    if ("response" in access) return access.response;
    const state = await signState("esc-calendar-oauth", access.user.id, 600);
    return new Response(JSON.stringify({ state }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const code = url.searchParams.get("code");
  const userId = await verifyState("esc-calendar-oauth", url.searchParams.get("state"));
  const redirectUri = `${url.origin}${url.pathname}?provider=${provider}`;

  if (!provider || !["google", "microsoft"].includes(provider) || !code) return html("Ungültige Anfrage", false);
  if (!userId) return html("Die Verbindungsanfrage ist ungültig oder abgelaufen. Bitte erneut verbinden.", false);

  try {
    let tokenRes: Response;
    if (provider === "google") {
      tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "",
          client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
    } else {
      const tenant = Deno.env.get("MS_OAUTH_TENANT") ?? "common";
      tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get("MS_OAUTH_CLIENT_ID") ?? "",
          client_secret: Deno.env.get("MS_OAUTH_CLIENT_SECRET") ?? "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: "offline_access Calendars.ReadWrite User.Read",
        }),
      });
    }
    const j = await tokenRes.json();
    if (!tokenRes.ok) { console.error("calendar token exchange failed", tokenRes.status); return html("Der Kalenderanbieter hat die Verbindung abgelehnt.", false); }

    const expires = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();

    await admin.from("esc_calendar_connections").upsert({
      user_id: userId,
      provider,
      access_token: j.access_token,
      refresh_token: j.refresh_token ?? null,
      expires_at: expires,
      scope: j.scope ?? null,
      status: "active",
    }, { onConflict: "user_id,provider,account_email" });

    return html(`${provider === "google" ? "Google" : "Microsoft"}-Kalender erfolgreich verbunden.`);
  } catch (e) {
    console.error("esc-calendar-oauth", (e as Error)?.message);
    return html("Interner Fehler bei der Kalenderverbindung.", false);
  }
});
