// OAuth callback handler for Google & Microsoft calendar connections.
// GET /esc-calendar-oauth?provider=google&code=...&state=<user_id>
// GET /esc-calendar-oauth?provider=microsoft&code=...&state=<user_id>
import { createClient } from "npm:@supabase/supabase-js@2";

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
       <p>${msg}</p>
       <p><a href="/esc/einstellungen">Zurück zu den Einstellungen</a></p>
     </div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // user_id
  const redirectUri = `${url.origin}${url.pathname}?provider=${provider}`;

  if (!provider || !code || !state) return html("Ungültige Anfrage", false);

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
    if (!tokenRes.ok) return html(`Token-Fehler: ${JSON.stringify(j)}`, false);

    const expires = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();

    await admin.from("esc_calendar_connections").upsert({
      user_id: state,
      provider,
      access_token: j.access_token,
      refresh_token: j.refresh_token ?? null,
      expires_at: expires,
      scope: j.scope ?? null,
      status: "active",
    }, { onConflict: "user_id,provider,account_email" });

    return html(`${provider === "google" ? "Google" : "Microsoft"}-Kalender erfolgreich verbunden.`);
  } catch (e) {
    return html(String((e as Error).message ?? e), false);
  }
});
