// Public edge function for the AlixWork AI Sales Wizard.
// Validates input, verifies Turnstile, deduplicates against customers,
// runs Lovable AI lead-scoring, inserts sales_leads + follow-ups, notifies sales.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const Body = z.object({
  interests: z.array(z.string()).default([]),
  additional_interests: z.array(z.string()).default([]),
  delivery_preference: z.string().max(80).optional().nullable(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  company: z.string().trim().max(160).optional().nullable(),
  country_code: z.string().trim().max(8).optional().nullable(),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(160),
  consultation_type: z.string().max(80).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  consent_data: z.literal(true),
  consent_contact: z.literal(true),
  service_rating: z.number().int().min(0).max(5).optional().nullable(),
  source: z.string().max(80).default("alixwork_wizard"),
  turnstile_token: z.string().min(1).optional().nullable(),
});

type WizardInput = z.infer<typeof Body>;

async function verifyTurnstile(token: string | null | undefined, ip: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // not configured -> allow
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);
  const r = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  const j = await r.json().catch(() => ({ success: false }));
  return !!j.success;
}

async function scoreLead(input: WizardInput): Promise<{
  score: number;
  category: string;
  priority: string;
  summary: string;
}> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  // Rule-based fallback
  const ruleScore = (() => {
    let s = 30;
    s += Math.min(40, input.interests.length * 12);
    s += Math.min(20, input.additional_interests.length * 6);
    if (input.delivery_preference === "schnellstmöglich") s += 20;
    else if (input.delivery_preference === "2–4 Wochen") s += 12;
    else if (input.delivery_preference === "4–8 Wochen") s += 6;
    if (input.consultation_type === "Studio Beratung" ||
        input.consultation_type === "Alix Showroom") s += 10;
    if (input.consultation_type === "Videoberatung") s += 6;
    if (input.company) s += 5;
    return Math.max(0, Math.min(100, s));
  })();
  const cat = (s: number) =>
    s >= 85 ? "Sofortkontakt" : s >= 70 ? "Heiß" : s >= 45 ? "Warm" : "Kalt";

  if (!key) {
    return {
      score: ruleScore,
      category: cat(ruleScore),
      priority: ruleScore >= 80 ? "Hoch" : ruleScore >= 50 ? "Mittel" : "Niedrig",
      summary: "Regelbasierter Score (keine AI verfügbar).",
    };
  }
  try {
    const r = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Du bist Vertriebs-KI für Alix Lasers. Antworte AUSSCHLIESSLICH mit kompaktem JSON: {score:0-100, category:'Kalt'|'Warm'|'Heiß'|'Sofortkontakt', priority:'Niedrig'|'Mittel'|'Hoch', summary:string (max 280 Zeichen, Deutsch)}. Score basiert auf Kaufabsicht, Interessenbreite, Lieferzeitraum (schneller = höher), Beratungsart (Studio/Showroom = höher), Vollständigkeit. Keine Markdown-Codefences.",
            },
            {
              role: "user",
              content: JSON.stringify({
                interests: input.interests,
                additional_interests: input.additional_interests,
                delivery_preference: input.delivery_preference,
                consultation_type: input.consultation_type,
                company: input.company,
                notes: input.notes,
                rule_score_hint: ruleScore,
              }),
            },
          ],
        }),
      },
    );
    if (!r.ok) throw new Error(`AI ${r.status}`);
    const j = await r.json();
    const txt: string = j?.choices?.[0]?.message?.content ?? "";
    const cleaned = txt.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Math.max(0, Math.min(100, Number(parsed.score) || ruleScore));
    return {
      score,
      category: String(parsed.category || cat(score)),
      priority: String(parsed.priority || (score >= 80 ? "Hoch" : "Mittel")),
      summary: String(parsed.summary || "").slice(0, 400),
    };
  } catch (e) {
    console.error("AI scoring failed", e);
    return {
      score: ruleScore,
      category: cat(ruleScore),
      priority: ruleScore >= 80 ? "Hoch" : ruleScore >= 50 ? "Mittel" : "Niedrig",
      summary: "Regelbasierter Score (AI-Fallback).",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", details: parsed.error.flatten().fieldErrors },
      { status: 400, headers: corsHeaders },
    );
  }
  const input = parsed.data;

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
  const isInternal = input.source === "alixwork_wizard_internal";
  if (!isInternal) {
    const ok = await verifyTurnstile(input.turnstile_token, ip);
    if (!ok) {
      return Response.json({ error: "captcha_failed" }, { status: 403, headers: corsHeaders });
    }
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, srv, { auth: { persistSession: false } });

  // Duplicate check (email → phone → company)
  let matched_customer_id: string | null = null;
  try {
    const e = input.email.toLowerCase();
    const { data: byEmail } = await supabase
      .from("customers").select("id").ilike("email", e).maybeSingle();
    if (byEmail?.id) matched_customer_id = byEmail.id;
    if (!matched_customer_id) {
      const { data: byPhone } = await supabase
        .from("customers").select("id").eq("phone", input.phone).maybeSingle();
      if (byPhone?.id) matched_customer_id = byPhone.id;
    }
    if (!matched_customer_id && input.company) {
      const { data: byCo } = await supabase
        .from("customers").select("id").ilike("company_name", input.company).maybeSingle();
      if (byCo?.id) matched_customer_id = byCo.id;
    }
  } catch (e) {
    console.warn("dupe check failed", e);
  }

  const ai = await scoreLead(input);

  const requestedProducts = [...input.interests, ...input.additional_interests]
    .filter(Boolean).join(", ") || null;

  const insertPayload = {
    source: input.source,
    form_name: "Alix AI Sales Wizard",
    external_id: `wizard-${crypto.randomUUID()}`,
    first_name: input.first_name,
    last_name: input.last_name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    country: null,
    country_code: input.country_code,
    requested_products: requestedProducts,
    message: input.notes,
    notes: input.notes,
    interests: input.interests,
    additional_interests: input.additional_interests,
    delivery_preference: input.delivery_preference,
    consultation_type: input.consultation_type,
    service_rating: input.service_rating ?? null,
    consent_data: input.consent_data,
    consent_contact: input.consent_contact,
    lead_score: ai.score,
    score_category: ai.category,
    ai_priority: ai.priority,
    ai_summary: ai.summary,
    lead_status: "Importiert - Angebot offen",
    converted_customer_id: matched_customer_id,
    metadata: { ip, user_agent: req.headers.get("user-agent") || null },
  };

  const { data: lead, error } = await supabase
    .from("sales_leads").insert(insertPayload).select("id").single();

  if (error || !lead) {
    console.error("insert lead failed", error);
    return Response.json({ error: "insert_failed", message: error?.message }, { status: 500, headers: corsHeaders });
  }

  // Auto follow-ups
  try {
    const tasks: Array<Record<string, unknown>> = [];
    if (ai.score >= 80) {
      tasks.push({
        lead_id: lead.id,
        type: "Rückruf",
        title: "Sofort kontaktieren (Lead-Score hoch)",
        due_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        status: "Offen",
      });
    }
    if (input.consultation_type === "Videoberatung") {
      tasks.push({
        lead_id: lead.id,
        type: "Termin",
        title: "Videoberatung planen",
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "Offen",
      });
    }
    if (input.additional_interests?.includes("Finanzierungsmöglichkeiten") ||
        input.additional_interests?.includes("Mietkauf / Miete / Smart Impulse")) {
      tasks.push({
        lead_id: lead.id,
        type: "Wiedervorlage",
        title: "Finance Team informieren",
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "Offen",
      });
    }
    if (input.additional_interests?.includes("NiSV Ausbildung") ||
        input.additional_interests?.includes("Laserschulung") ||
        input.interests?.includes("Alix Academy") ||
        input.interests?.includes("Professional Kurs")) {
      tasks.push({
        lead_id: lead.id,
        type: "Wiedervorlage",
        title: "Academy informieren",
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "Offen",
      });
    }
    if (tasks.length) await supabase.from("sales_followups").insert(tasks);
  } catch (e) {
    console.warn("followups failed", e);
  }

  // Notify sales roles via mail_notifications
  try {
    const { data: salesUsers } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["Vertrieb", "Vertriebsleitung", "Admin", "Super Admin"]);
    const ids = Array.from(new Set((salesUsers || []).map((r) => r.user_id)));
    if (ids.length) {
      const rows = ids.map((uid) => ({
        user_id: uid,
        title: `Neue Anfrage (Score ${ai.score} – ${ai.category})`,
        body: `${input.first_name} ${input.last_name}${input.company ? " · " + input.company : ""} – ${requestedProducts ?? "ohne Produktwunsch"}`,
        link: `/verkauf/anfragen/${lead.id}`,
        kind: "sales_lead",
        read: false,
      }));
      await supabase.from("mail_notifications").insert(rows);
    }
  } catch (e) {
    console.warn("notify failed", e);
  }

  // Integration log (best effort)
  try {
    await supabase.from("integration_logs").insert({
      source: input.source,
      kind: "sales_wizard_submit",
      status: "ok",
      payload: { lead_id: lead.id, score: ai.score, category: ai.category },
    });
  } catch { /* ignore */ }

  return Response.json(
    { ok: true, lead_id: lead.id, score: ai.score, category: ai.category },
    { headers: corsHeaders },
  );
});
