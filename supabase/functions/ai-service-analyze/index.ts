import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const MODEL = "google/gemini-2.5-flash";

type Body = {
  ticket_id?: string | null;
  repair_id?: string | null;
  serial_number?: string | null;
  device_name?: string | null;
  error_description?: string | null;
  attachments?: unknown[];
};

async function log(admin: any, action: string, status: string, payload: any, result: any, error?: string, userId?: string) {
  try {
    await admin.from("ai_service_logs").insert({
      action, status, error_message: error ?? null,
      payload, result, user_id: userId ?? null,
    });
  } catch (_) { /* noop */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Authenticate
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  if (!LOVABLE_API_KEY) {
    await log(admin, "ai-service-analyze", "error", {}, null, "LOVABLE_API_KEY missing", userId);
    return new Response(JSON.stringify({ error: "AI Gateway nicht konfiguriert" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { ticket_id, repair_id, attachments } = body;
  let { serial_number, device_name, error_description } = body;

  try {
    // Enrich from ticket / repair
    if (ticket_id) {
      const { data: t } = await admin.from("tickets").select("*").eq("id", ticket_id).maybeSingle();
      if (t) {
        serial_number ||= (t as any).serial_number;
        device_name   ||= (t as any).device_name;
        error_description ||= [(t as any).title, (t as any).description].filter(Boolean).join(" – ");
      }
    }
    if (repair_id) {
      const { data: r } = await admin.from("repair_orders").select("*").eq("id", repair_id).maybeSingle();
      if (r) {
        serial_number ||= (r as any).device_serial_number;
        device_name   ||= [(r as any).device_brand, (r as any).device_model].filter(Boolean).join(" ");
        error_description ||= (r as any).issue_description;
      }
    }

    // Pull historical context by serial
    let historyTickets: any[] = [];
    let historyRepairs: any[] = [];
    let kbHits: any[] = [];
    if (serial_number) {
      const [tk, rp, kb] = await Promise.all([
        admin.from("tickets").select("title,description,status,created_at").eq("serial_number", serial_number).order("created_at", { ascending: false }).limit(10),
        admin.from("repair_orders").select("issue_description,diagnosis,repair_status,created_at").eq("device_serial_number", serial_number).order("created_at", { ascending: false }).limit(10),
        admin.from("service_knowledge_base").select("*").or(`device_name.ilike.%${device_name ?? ""}%,geraetetyp.ilike.%${device_name ?? ""}%`).limit(8),
      ]);
      historyTickets = tk.data ?? [];
      historyRepairs = rp.data ?? [];
      kbHits = kb.data ?? [];
    }

    const system = `Du bist ein Service-Techniker-Assistent für Medizin- und Laborgeräte.
Antworte ausschließlich als strikt valides JSON ohne Erklärtext, Schema:
{
  "probable_cause": string,
  "confidence_score": number (0-100),
  "recommended_steps": string[],
  "recommended_repair": string,
  "recommended_parts": [{"name": string, "probability": number, "reason": string}],
  "estimated_diagnosis_time_minutes": number,
  "estimated_repair_time_minutes": number,
  "estimated_total_time_minutes": number,
  "recommended_technician": string
}`;

    const user = JSON.stringify({
      device_name, serial_number, error_description,
      attachments_count: attachments?.length ?? 0,
      history_tickets: historyTickets,
      history_repairs: historyRepairs,
      knowledge_base: kbHits,
    });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (aiRes.status === 429) {
      await log(admin, "ai-service-analyze", "rate_limited", body, null, "429", userId);
      return new Response(JSON.stringify({ error: "Rate limit überschritten, bitte erneut versuchen." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      await log(admin, "ai-service-analyze", "credits_exhausted", body, null, "402", userId);
      return new Response(JSON.stringify({ error: "AI-Kontingent erschöpft. Bitte Credits im Workspace aufladen." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      await log(admin, "ai-service-analyze", "error", body, null, errText, userId);
      return new Response(JSON.stringify({ error: "AI-Aufruf fehlgeschlagen", detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = await aiRes.json();
    const content: string = ai.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    if (!parsed) {
      await log(admin, "ai-service-analyze", "parse_error", body, { content }, "AI lieferte kein gültiges JSON", userId);
      return new Response(JSON.stringify({ error: "Antwort konnte nicht ausgewertet werden." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insert = {
      ticket_id: ticket_id ?? null,
      repair_id: repair_id ?? null,
      serial_number: serial_number ?? null,
      device_name: device_name ?? null,
      error_description: error_description ?? null,
      probable_cause: parsed.probable_cause ?? null,
      confidence_score: Number(parsed.confidence_score ?? 0),
      recommended_steps: parsed.recommended_steps ?? [],
      recommended_repair: parsed.recommended_repair ?? null,
      recommended_parts: parsed.recommended_parts ?? [],
      estimated_diagnosis_time_minutes: Number(parsed.estimated_diagnosis_time_minutes ?? 0) || null,
      estimated_repair_time_minutes: Number(parsed.estimated_repair_time_minutes ?? 0) || null,
      estimated_total_time_minutes: Number(parsed.estimated_total_time_minutes ?? 0) || null,
      recommended_technician: parsed.recommended_technician ?? null,
      ai_model: MODEL,
      status: "completed",
      created_by: userId,
    };

    const { data: row, error: insErr } = await admin
      .from("ai_service_analyses")
      .insert(insert)
      .select("*")
      .single();

    if (insErr) {
      await log(admin, "ai-service-analyze", "error", body, parsed, insErr.message, userId);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await log(admin, "ai-service-analyze", "success", body, { analysis_id: row.id }, undefined, userId);

    return new Response(JSON.stringify({ analysis: row }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await log(admin, "ai-service-analyze", "error", body, null, e?.message ?? String(e), userId);
    return new Response(JSON.stringify({ error: e?.message ?? "Unerwarteter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
