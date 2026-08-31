// compliance-ai-assist
// KI-Unterstützung für Eingabefelder im Software-&-Compliance-Workspace (IEC 62304 / ISO 13485 / MDR).
// Modi: draft (Vorschlag erzeugen), improve (Text verbessern), shorten (kürzen), expand (ausführlicher), check (Prüfhinweise).
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

const MODE_INSTRUCTION: Record<string, string> = {
  draft: "Erstelle einen vollständigen, prüffähigen Formulierungsvorschlag für dieses Eingabefeld.",
  improve: "Überarbeite den vorhandenen Text sprachlich und fachlich, ohne Inhalte zu erfinden.",
  shorten: "Kürze den vorhandenen Text auf das Wesentliche, ohne normrelevante Aussagen zu verlieren.",
  expand: "Ergänze den vorhandenen Text um fehlende, normrelevante Aspekte.",
  check: "Prüfe den vorhandenen Text kritisch und liste knapp die Lücken bzw. Risiken für ein Audit auf.",
};

const SYSTEM = `Du bist QM-Assistent für Medizinsoftware (IEC 62304, ISO 13485, ISO 14971, MDR) bei Alix Lasers.
Du hilfst beim Ausfüllen von Compliance-Aufgaben. Regeln:
- Antworte immer auf Deutsch, sachlich, auditfähig, ohne Marketing.
- Erfinde keine Messwerte, Versionen, Namen oder Testergebnisse. Wenn Angaben fehlen, schreibe Platzhalter in eckigen Klammern, z. B. [Version eintragen].
- Gib NUR den Feldinhalt zurück, ohne Einleitung, ohne Markdown-Überschriften, ohne Anführungszeichen.`;

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
    const mode: string = body?.mode ?? "draft";
    const taskId: string | undefined = body?.task_id;
    const stepId: string | undefined = body?.step_id;
    const currentText: string = (body?.text ?? "").toString().slice(0, 8000);
    const extraHint: string = (body?.hint ?? "").toString().slice(0, 2000);

    if (!MODE_INSTRUCTION[mode]) return json({ error: "Unbekannter Modus" }, 400);
    if (mode !== "draft" && !currentText.trim()) {
      return json({ error: "Es ist noch kein Text vorhanden, den die KI bearbeiten könnte." }, 400);
    }

    let context = "";
    if (taskId) {
      const { data: task } = await admin.from("compliance_tasks" as any)
        .select("title, purpose, category, ref_codes, project_id").eq("id", taskId).maybeSingle();
      if (task) {
        const { data: project } = await admin.from("compliance_projects" as any)
          .select("code, name, description, safety_class").eq("id", (task as any).project_id).maybeSingle();
        const { data: steps } = await admin.from("compliance_task_steps" as any)
          .select("step_no, label, hint, value").eq("task_id", taskId).order("step_no");
        context = [
          project ? `Projekt: ${(project as any).code} – ${(project as any).name} (Safety Class ${(project as any).safety_class ?? "—"})` : "",
          `Aufgabe: ${(task as any).title}`,
          (task as any).purpose ? `Zweck: ${(task as any).purpose}` : "",
          (task as any).category ? `Kategorie: ${(task as any).category}` : "",
          ((task as any).ref_codes || []).length ? `Normreferenzen: ${((task as any).ref_codes || []).join(", ")}` : "",
          "Alle Schritte dieser Aufgabe:",
          ...((steps || []) as any[]).map((s) =>
            `  ${s.step_no}. ${s.label}${s.hint ? ` (${s.hint})` : ""}${s.id === stepId ? "  <== aktuelles Feld" : ""}${s.value ? `\n     bisher: ${String(s.value).slice(0, 600)}` : ""}`),
        ].filter(Boolean).join("\n");
      }
    }

    const prompt = [
      context,
      extraHint ? `Feldhinweis: ${extraHint}` : "",
      currentText ? `Bisheriger Feldinhalt:\n${currentText}` : "Das Feld ist noch leer.",
      MODE_INSTRUCTION[mode],
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
      }),
    });

    if (res.status === 429) return json({ error: "KI ist gerade ausgelastet. Bitte kurz warten." }, 429);
    if (res.status === 402) return json({ error: "KI-Guthaben aufgebraucht. Bitte Credits aufladen." }, 402);
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `KI-Fehler (${res.status})`, detail: detail.slice(0, 500) }, 502);
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return json({ error: "Die KI hat keinen Text geliefert." }, 502);

    return json({ text, mode });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
