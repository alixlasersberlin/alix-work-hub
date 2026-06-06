// Alix MailCenter – AI Assistant Edge Function
// Modes: generate, reply, summarize, lead_score, campaign_optimize,
//        followup, template_review
// Never sends mail. Returns suggestions only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

type Body = {
  mode:
    | "generate"
    | "reply"
    | "summarize"
    | "lead_score"
    | "campaign_optimize"
    | "followup"
    | "template_review";
  // generate
  ziel?: string;
  abteilung?: string;
  kunde?: string;
  tonalitaet?: string;
  // reply / summarize
  context?: string;
  history?: string;
  // lead_score
  lead?: Record<string, unknown>;
  // campaign_optimize
  campaign?: Record<string, unknown>;
  // followup
  scenario?: string;
  // template_review
  template?: { subject?: string; html?: string; text?: string };
};

function systemFor(mode: string) {
  switch (mode) {
    case "generate":
      return "Du bist ein professioneller deutscher E-Mail-Texter für ein Medizintechnik-/Vertriebsunternehmen. Antworte STRENG als JSON: {\"subject\":\"...\",\"html\":\"...\",\"text\":\"...\"}. Kein Markdown, kein Kommentar.";
    case "reply":
      return "Du bist ein Kundenservice-Profi. Erstelle einen höflichen, präzisen Antwortentwurf in deutscher Sprache. Antworte als JSON: {\"subject\":\"...\",\"html\":\"...\",\"text\":\"...\"}.";
    case "summarize":
      return "Fasse den E-Mail-Verlauf strukturiert auf Deutsch zusammen. Antworte als JSON: {\"problem\":\"...\",\"verlauf\":\"...\",\"letzte_aktion\":\"...\",\"offene_punkte\":[\"...\"],\"naechste_schritte\":[\"...\"]}.";
    case "lead_score":
      return "Bewerte den Lead. Antworte als JSON: {\"kategorie\":\"Heißer Lead|Mittlerer Lead|Kalter Lead\",\"wahrscheinlichkeit\":0-100,\"begruendung\":\"...\",\"follow_up\":\"...\",\"kontaktweg\":\"E-Mail|Telefon|Termin\"}.";
    case "campaign_optimize":
      return "Analysiere Kampagnen-KPIs und gib konkrete Optimierungen. JSON: {\"bewertung\":\"...\",\"betreff_vorschlaege\":[\"...\"],\"versandzeit\":\"...\",\"zielgruppe\":\"...\",\"inhalt_tipps\":[\"...\"]}.";
    case "followup":
      return "Erstelle einen Follow-Up Vorschlag (deutsch) zum gegebenen Szenario. JSON: {\"subject\":\"...\",\"html\":\"...\",\"text\":\"...\",\"timing\":\"...\"}.";
    case "template_review":
      return "Analysiere die E-Mail-Vorlage. JSON: {\"lesbarkeit\":0-100,\"spam_risiko\":\"niedrig|mittel|hoch\",\"laenge\":\"kurz|optimal|lang\",\"tonalitaet\":\"...\",\"verbesserungen\":[\"...\"]}.";
    default:
      return "Antworte hilfreich auf Deutsch als JSON.";
  }
}

function userFor(body: Body): string {
  switch (body.mode) {
    case "generate":
      return `Ziel: ${body.ziel}\nAbteilung: ${body.abteilung}\nKunde: ${body.kunde ?? "-"}\nTonalität: ${body.tonalitaet}`;
    case "reply":
      return `Eingegangene Nachricht / Kontext:\n${body.context ?? ""}\n\nZusätzliche Infos (Aufträge/Rechnungen/Tickets):\n${body.history ?? ""}`;
    case "summarize":
      return `Verlauf:\n${body.history ?? body.context ?? ""}`;
    case "lead_score":
      return `Lead-Daten:\n${JSON.stringify(body.lead ?? {}, null, 2)}`;
    case "campaign_optimize":
      return `Kampagne:\n${JSON.stringify(body.campaign ?? {}, null, 2)}`;
    case "followup":
      return `Szenario: ${body.scenario}\nKontext:\n${body.context ?? ""}`;
    case "template_review":
      return `Vorlage:\n${JSON.stringify(body.template ?? {}, null, 2)}`;
    default:
      return JSON.stringify(body);
  }
}

function tryParseJson(text: string) {
  try { return JSON.parse(text); } catch { /* try to extract */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return { raw: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json() as Body;
    if (!body?.mode) {
      return new Response(JSON.stringify({ error: "mode required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemFor(body.mode) },
          { role: "user", content: userFor(body) },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit – bitte später versuchen." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "KI-Guthaben aufgebraucht. Bitte Workspace-Credits aufladen." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: "AI gateway error", details: t }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    const result = tryParseJson(text);

    return new Response(JSON.stringify({ ok: true, mode: body.mode, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
