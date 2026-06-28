// as-ai-suggest
// KI-Auswertung eines After-Sales-Falls via Lovable AI Gateway.
// Liefert: health_score (0-100), risk, recommended_next_contact, summary,
// upselling-Vorschläge, Email-Draft, SMS-Draft.
// Persistiert health_score auf as_cases, Upsell-Vorschläge in as_upsell_suggestions,
// Timeline-Event mit Zusammenfassung.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3-flash-preview";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `Du bist der After-Sales-KI-Assistent für Alix Lasers (Premium-Lasergeräte für Beauty-Studios).
Du erhältst den vollständigen Kontext eines After-Sales-Falls (Auftrag, Kunde, Gerät, Checkliste, Mediapaket, Rückrufe, Timeline).
Analysiere den Fall und liefere ein STRUKTURIERTES JSON-Objekt zurück mit:
- health_score (0-100, Integer): Gesamtgesundheit der Kundenbeziehung (höher = besser).
- risk_level ("low" | "medium" | "high"): Abwanderungs-/Eskalations-Risiko.
- recommended_next_contact_days (Integer, 0-90): in wie vielen Tagen sollte der nächste proaktive Kontakt erfolgen.
- summary (string, max 400 Zeichen, deutsch): kurze interne Zusammenfassung des aktuellen Standes.
- next_actions (string[], max 5, deutsch): konkrete priorisierte Handlungsempfehlungen für das After-Sales-Team.
- upsell_suggestions (Array max 3): { product_key: string (kebab-case), label: string (deutsch) }.
- email_draft (string, max 1200 Zeichen, deutsch, freundlich-professionell, ohne Signatur).
- sms_draft (string, max 320 Zeichen, deutsch, sehr knapp).

Bewerte streng anhand der Daten. Wenn viele Checklisten-Punkte offen sind, Rückrufe überfällig oder die Ampel rot ist → niedriger Health-Score & hohes Risiko.
Antwort AUSSCHLIESSLICH als JSON, ohne Markdown, ohne Erklärung.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { case_id } = body ?? {};
    if (!case_id) return json({ error: "case_id fehlt" }, 400);

    // Load full context
    const [caseRes, checks, timeline, callbacks, media] = await Promise.all([
      admin.from("as_cases_list_v" as any).select("*").eq("id", case_id).maybeSingle(),
      admin.from("as_checklist_items" as any).select("section, label, checked, note").eq("case_id", case_id),
      admin.from("as_timeline_events" as any).select("event_type, title, body, created_at").eq("case_id", case_id).order("created_at", { ascending: false }).limit(30),
      admin.from("as_callbacks" as any).select("due_at, done_at, reason, priority").eq("case_id", case_id),
      admin.from("as_mediapaket_status" as any).select("stage, updated_at").eq("case_id", case_id).maybeSingle(),
    ]);
    if (caseRes.error || !caseRes.data) return json({ error: "Fall nicht gefunden" }, 404);
    const c: any = caseRes.data;

    const ageDays = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000);
    const checklistOpen = (checks.data ?? []).filter((i: any) => !i.checked).length;
    const checklistTotal = (checks.data ?? []).length;
    const overdueCallbacks = (callbacks.data ?? []).filter((cb: any) => !cb.done_at && new Date(cb.due_at) < new Date()).length;

    const userPrompt = JSON.stringify({
      fall: {
        status: c.status, priority: c.priority, traffic_light: c.traffic_light,
        progress_pct: c.progress_pct, last_contact_at: c.last_contact_at,
        alter_in_tagen: ageDays,
      },
      kunde: {
        firma: c.customer_company, ansprechpartner: c.customer_contact,
        is_vip: c.is_vip, email: c.customer_email ? "vorhanden" : "fehlt",
        telefon: c.customer_phone ? "vorhanden" : "fehlt",
      },
      auftrag: {
        nummer: c.order_number, status: c.order_status,
        datum: c.order_date, betrag: c.total_amount, currency: c.currency,
      },
      geraet: { modell: c.device_model, seriennummer: c.device_serial },
      checkliste: {
        offen: checklistOpen, gesamt: checklistTotal,
        details: (checks.data ?? []).map((i: any) => ({ s: i.section, l: i.label, ok: i.checked })),
      },
      mediapaket: media.data ?? { stage: "not_started" },
      rueckrufe: {
        gesamt: (callbacks.data ?? []).length, überfällig: overdueCallbacks,
        details: (callbacks.data ?? []).map((cb: any) => ({
          due: cb.due_at, done: !!cb.done_at, grund: cb.reason, prio: cb.priority,
        })),
      },
      timeline_letzte_30: (timeline.data ?? []).map((t: any) => ({
        typ: t.event_type, titel: t.title, datum: t.created_at,
      })),
    });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "KI-Limit erreicht. Bitte später erneut versuchen." }, 429);
      if (aiRes.status === 402) return json({ error: "KI-Guthaben aufgebraucht." }, 402);
      return json({ error: `KI-Fehler ${aiRes.status}: ${txt.slice(0, 200)}` }, 502);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const health = Math.max(0, Math.min(100, Math.round(Number(parsed.health_score ?? 50))));
    const nextDays = Math.max(0, Math.min(90, Math.round(Number(parsed.recommended_next_contact_days ?? 7))));
    const nextDate = new Date(Date.now() + nextDays * 86400000).toISOString();

    // Persist insights
    await admin.from("as_cases" as any).update({
      health_score: health,
    }).eq("id", case_id);

    // Upsell suggestions: upsert by product_key
    const upsells: Array<{ product_key: string; label: string }> = Array.isArray(parsed.upsell_suggestions) ? parsed.upsell_suggestions.slice(0, 3) : [];
    for (const u of upsells) {
      if (!u?.product_key) continue;
      const { data: existing } = await admin.from("as_upsell_suggestions" as any)
        .select("id").eq("case_id", case_id).eq("product_key", u.product_key).maybeSingle();
      if (!existing) {
        await admin.from("as_upsell_suggestions" as any).insert({
          case_id, product_key: u.product_key, label: u.label ?? u.product_key,
        });
      }
    }

    await admin.from("as_timeline_events" as any).insert({
      case_id,
      event_type: "ai_analysis",
      title: `KI-Analyse: Health ${health} · Risiko ${parsed.risk_level ?? "?"} · nächster Kontakt in ${nextDays}T`,
      body: (parsed.summary ?? "").slice(0, 1000),
      source: "user",
      created_by: userId,
    });

    return json({
      ok: true,
      health_score: health,
      risk_level: parsed.risk_level ?? "medium",
      recommended_next_contact_at: nextDate,
      recommended_next_contact_days: nextDays,
      summary: parsed.summary ?? "",
      next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 5) : [],
      upsell_suggestions: upsells,
      email_draft: parsed.email_draft ?? "",
      sms_draft: parsed.sms_draft ?? "",
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unbekannter Fehler" }, 500);
  }
});
