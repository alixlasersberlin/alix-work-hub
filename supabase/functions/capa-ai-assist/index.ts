// capa-ai-assist – MAGIC CAPA
// KI-Unterstützung für den 12-Schritte-CAPA-Prozess (ISO 13485 / MDR / ISO 14971).
// Die KI schlägt ausschließlich vor. Regulatorische Entscheidungen (Vigilanz, FSCA,
// Risikofreigabe, CAPA-Abschluss, QMB-Freigabe) trifft sie NICHT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3.7-flash";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODES: Record<string, string> = {
  summary: "Fasse die Reklamation und den bisherigen CAPA-Stand knapp und auditfähig zusammen.",
  missing: "Liste konkret auf, welche Informationen und Nachweise für einen auditfähigen CAPA-Fall noch fehlen.",
  similar: "Bewerte die mitgelieferten ähnlichen Fälle und beschreibe mögliche Zusammenhänge und Trends.",
  root_cause: "Schlage plausible mögliche Ursachen (Produkt- und QMS-/Prozessursachen) vor und begründe sie kurz.",
  five_why: "Bereite eine 5-Why-Analyse vor: fünf aufeinander aufbauende Warum-Fragen mit Antwortvorschlägen.",
  ishikawa: "Bereite eine Ishikawa-Analyse vor (Mensch, Maschine, Material, Methode, Messung, Umgebung, Lieferant, Software).",
  actions: "Schlage konkrete CAPA-Maßnahmen mit Kategorie, erwartetem Ergebnis und Wirksamkeitskriterium vor.",
  report: "Erstelle eine strukturierte CAPA-Zusammenfassung für den Abschlussbericht.",
};

const SYSTEM = `Du bist QM-Assistent für Medizinprodukte (ISO 13485, ISO 14971, MDR, Vigilanz, PMS) bei Alix Lasers.
Regeln:
- Antworte immer auf Deutsch, sachlich, auditfähig, ohne Marketing.
- Erfinde keine Messwerte, Seriennummern, Chargen, Namen oder Testergebnisse. Fehlende Angaben als [Platzhalter] kennzeichnen.
- Triff KEINE regulatorische Entscheidung: keine abschließende Vigilanzentscheidung, keine FSCA-Freigabe, kein CAPA-Abschluss, keine Risikofreigabe, keine QMB-Freigabe.
- Formuliere Vorschläge stets als Vorschlag zur Prüfung durch den Verantwortlichen.
- Keine Markdown-Überschriften, kurze Absätze oder Aufzählungen mit "-".`;

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

    const body = await req.json().catch(() => ({}));
    const mode: string = body?.mode ?? "summary";
    const capaId: string | undefined = body?.capa_id;
    if (!MODES[mode]) return json({ error: "Unbekannter Modus" }, 400);
    if (!capaId) return json({ error: "capa_id fehlt" }, 400);

    // RLS-konform lesen: nur wenn der aufrufende Benutzer die CAPA sehen darf.
    const { data: capa, error: capaErr } = await userClient.from("capas").select("*").eq("id", capaId).maybeSingle();
    if (capaErr || !capa) return json({ error: "Kein Zugriff auf diese CAPA" }, 403);

    const { data: actions } = await userClient.from("capa_actions").select("action_text, category, status, due_date, evidence_text").eq("capa_id", capaId);

    // Kontext bewusst minimal halten
    const ctx = {
      capa_number: capa.capa_number, titel: capa.title, produkt: capa.product_name,
      beschreibung: capa.description, gesundheitliche_folgen: capa.health_consequences,
      sofortmassnahmen: capa.containment_actions, correction: capa.correction_text,
      vigilanz: { antworten: capa.vigilance_answers, ergebnis: capa.vigilance_result },
      untersuchung: capa.investigation, umfang: { antworten: capa.scope_answers, ergebnis: capa.scope_result },
      pms: { bewertung: capa.pms_assessment, kennzahlen: capa.pms_stats },
      entscheidung: { capa_erforderlich: capa.capa_required, no_capa_begruendung: capa.no_capa_reason },
      rca: { methode: capa.rca_method, fehlerbild: capa.failure_mode, direkte_ursache: capa.direct_cause, root_cause: capa.root_cause, daten: capa.rca_data },
      risiko: { antworten: capa.risk_answers, entscheidung: capa.risk_decision },
      massnahmen: actions ?? [],
      wirksamkeit: { kriterium: capa.eff_criterion, ergebnis: capa.eff_result },
    };

    let similar: unknown[] = [];
    if (mode === "similar" && capa.product_name) {
      const { data } = await userClient.from("capas")
        .select("capa_number, title, root_cause, created_at")
        .eq("product_name", capa.product_name).neq("id", capaId).limit(15);
      similar = data ?? [];
    }

    const userPrompt = [
      MODES[mode],
      `CAPA-Kontext (JSON):\n${JSON.stringify(ctx).slice(0, 12000)}`,
      similar.length ? `Ähnliche CAPAs:\n${JSON.stringify(similar).slice(0, 4000)}` : "",
      body?.hint ? `Zusatzhinweis: ${String(body.hint).slice(0, 1000)}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
      }),
    });

    if (res.status === 429) return json({ error: "KI-Limit erreicht, bitte später erneut versuchen." }, 429);
    if (res.status === 402) return json({ error: "KI-Guthaben aufgebraucht." }, 402);
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      return json({ error: "KI-Dienst nicht erreichbar" }, 502);
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";

    await admin.from("capa_timeline").insert({
      capa_id: capaId, event_type: "ki_vorschlag", note: `MAGIC CAPA (${mode}) – KI-VORSCHLAG, Prüfung erforderlich`,
      actor_name: "MAGIC CAPA (KI)",
    });

    return json({ text, mode, disclaimer: "KI-VORSCHLAG – PRÜFUNG ERFORDERLICH" });
  } catch (e) {
    console.error("capa-ai-assist error", e);
    return json({ error: "Interner Fehler" }, 500);
  }
});
