import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAGE_TITLES: Record<string, string> = {
  warehouse: "Bereitstellung",
  accounting: "Buchhaltung",
  dispatch: "Tourenplanung",
};
const ORDER = ["warehouse", "accounting", "dispatch"];

function page(title: string, message: string, ok: boolean) {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/><title>${title}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#0b0b0c;color:#f5f5f5;display:grid;place-items:center;height:100vh}
.card{max-width:520px;padding:32px;border:1px solid #2a2a2e;border-radius:16px;background:#141416;text-align:center}
h1{font-size:20px;margin:0 0 12px;color:${ok ? "#d4af37" : "#ef4444"}}p{color:#b8b8bd;line-height:1.5;margin:0}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    if (!token) return page("Ungültiger Link", "Es wurde kein Freigabe-Token übergeben.", false);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: t } = await admin
      .from("delivery_approval_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!t) return page("Ungültiger Link", "Dieser Freigabe-Link ist unbekannt oder wurde widerrufen.", false);
    if (t.used_at) return page("Bereits freigegeben", "Diese Stufe wurde über den Link bereits freigegeben.", true);
    if (new Date(t.expires_at).getTime() < Date.now()) {
      return page("Link abgelaufen", "Bitte geben Sie den Auftrag direkt in AlixWork frei.", false);
    }

    const { data: approval } = await admin
      .from("delivery_approvals")
      .select("*")
      .eq("id", t.approval_id)
      .maybeSingle();
    if (!approval) return page("Auftrag nicht gefunden", "Die Freigabe existiert nicht mehr.", false);

    const stage = String(t.stage);
    if (approval[`${stage}_status`] === "approved") {
      await admin.from("delivery_approval_tokens").update({ used_at: new Date().toISOString() }).eq("id", t.id);
      return page("Bereits freigegeben", `Die Stufe ${STAGE_TITLES[stage] ?? stage} ist bereits freigegeben.`, true);
    }

    // Reihenfolge prüfen – vorherige Stufen müssen freigegeben sein
    const idx = ORDER.indexOf(stage);
    for (let i = 0; i < idx; i++) {
      if (approval[`${ORDER[i]}_status`] !== "approved") {
        return page(
          "Freigabe noch nicht möglich",
          `Die vorherige Stufe (${STAGE_TITLES[ORDER[i]]}) ist noch offen.`,
          false,
        );
      }
    }

    const checks = { ...(approval[`${stage}_checks`] ?? {}) } as Record<string, boolean>;
    for (const k of Object.keys(checks)) checks[k] = true;

    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("delivery_approvals")
      .update({
        [`${stage}_status`]: "approved",
        [`${stage}_by`]: t.user_id ?? null,
        [`${stage}_by_name`]: t.user_name ?? "Ein-Klick-Freigabe",
        [`${stage}_at`]: now,
        [`${stage}_comment`]: approval[`${stage}_comment`] ?? "Ein-Klick-Freigabe per E-Mail",
        [`${stage}_signature`]: `1-Klick-Freigabe (${t.user_name ?? "E-Mail"})`,
        [`${stage}_checks`]: checks,
      })
      .eq("id", approval.id);
    if (upErr) return page("Fehler", upErr.message, false);

    await admin.from("delivery_approval_tokens").update({ used_at: now }).eq("id", t.id);
    await admin.from("delivery_approval_events").insert({
      approval_id: approval.id,
      order_id: approval.order_id,
      stage,
      old_status: approval[`${stage}_status`] ?? "open",
      new_status: "approved",
      user_id: t.user_id ?? null,
      user_name: t.user_name ?? "Ein-Klick-Freigabe",
      comment: "Freigabe per Ein-Klick-Link aus Erinnerungs-Mail",
      ip_address: req.headers.get("x-forwarded-for"),
      signature: "1-click",
    });

    return page(
      "Freigabe erteilt",
      `Die Stufe ${STAGE_TITLES[stage] ?? stage} wurde freigegeben. Vielen Dank!`,
      true,
    );
  } catch (e) {
    return page("Fehler", (e as Error)?.message ?? "Unbekannter Fehler", false);
  }
});
