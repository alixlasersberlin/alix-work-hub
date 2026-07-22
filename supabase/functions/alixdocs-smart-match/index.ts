// AlixDocs Smart Match – Etappe 1
// Kombiniert Dateiname-Regex + OCR + Gemini-Feldextraktion + gewichteten Score
// über Kandidaten in orders / customers / lager_devices und schreibt das Ergebnis
// zurück auf alixdocs_documents.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ExtractedFields {
  order_no?: string | null;
  invoice_no?: string | null;
  serial_no?: string | null;
  customer_no?: string | null;
  customer_name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: { street?: string; zip?: string; city?: string; country?: string } | null;
  device_name?: string | null;
  sku?: string | null;
  contract_no?: string | null;
  iban?: string | null;
  doc_type?: string | null;
}

const RX = {
  order: /\b(?:AW|AS|SO)-?\d{4}-?\d{3,}\b/gi,
  invoice: /\b(?:RE|INV|R)-?\d{3,}\b/gi,
  serial: /\b[0-9]{7,}[A-Z]{2,4}[0-9A-Z]{2,4}\b/g,
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  phone: /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,}[\s-]?\d{3,}/g,
  zip: /\b\d{4,5}\b/g,
  iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
};

function parseFilename(name: string): ExtractedFields {
  const out: ExtractedFields = {};
  const orders = name.match(RX.order);
  if (orders) out.order_no = orders[0].toUpperCase();
  const inv = name.match(RX.invoice);
  if (inv) out.invoice_no = inv[0].toUpperCase();
  const ser = name.match(RX.serial);
  if (ser) out.serial_no = ser[0].toUpperCase();
  return out;
}

async function extractFieldsAI(ocrText: string, filename: string): Promise<ExtractedFields> {
  if (!LOVABLE_API_KEY) return {};
  const prompt = `Extrahiere Stammdaten aus dem folgenden Dokument. Antworte NUR als JSON.
Felder: order_no, invoice_no, serial_no, customer_no, customer_name, company, email, phone,
address{street,zip,city,country}, device_name, sku, contract_no, iban, doc_type.
Nutze null wenn unbekannt. Deutschsprachig.

Dateiname: ${filename}
Inhalt (max 8000 chars):
${(ocrText || "").slice(0, 8000)}`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du bist ein präziser Feldextraktor. Antworte NUR mit gültigem JSON, keine Erklärung." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.warn("gemini extract failed", res.status, await res.text());
      return {};
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(raw);
  } catch (e) {
    console.warn("extractFieldsAI error", e);
    return {};
  }
}

function merge(a: ExtractedFields, b: ExtractedFields): ExtractedFields {
  const out: any = { ...a };
  for (const k of Object.keys(b)) {
    const v = (b as any)[k];
    if (v != null && v !== "" && (out[k] == null || out[k] === "")) out[k] = v;
  }
  return out;
}

async function loadConfig(supabase: any) {
  const { data } = await supabase.from("alixdocs_smart_config").select("*").eq("id", 1).maybeSingle();
  return data ?? {
    weights: {
      order_number: 100, serial_number: 90, customer_number: 80,
      email: 70, phone: 60, company: 50, name: 40,
      address: 35, device_name: 25, invoice_number: 20,
    },
    auto_assign_threshold: 95,
    suggest_threshold: 60,
    auto_assign_gap: 20,
  };
}

type Candidate = {
  entity_type: "order" | "customer" | "device";
  entity_id: string;
  label: string;
  score: number;
  hits: string[];
};

async function findCandidates(supabase: any, f: ExtractedFields, weights: any): Promise<Candidate[]> {
  const scores = new Map<string, Candidate>();
  const bump = (key: string, cand: Omit<Candidate, "score" | "hits">, points: number, hit: string) => {
    const cur = scores.get(key);
    if (cur) { cur.score += points; cur.hits.push(hit); }
    else scores.set(key, { ...cand, score: points, hits: [hit] });
  };

  // ORDERS
  if (f.order_no) {
    const { data } = await supabase.from("orders")
      .select("id, order_number, customer_id")
      .ilike("order_number", `%${f.order_no.replace(/^AW-?/i, "").replace(/^SO-?/i, "")}%`)
      .limit(10);
    for (const o of data ?? []) bump(`order:${o.id}`, { entity_type: "order", entity_id: o.id, label: o.order_number }, weights.order_number, "order_no");
  }
  if (f.invoice_no) {
    const { data } = await supabase.from("orders")
      .select("id, order_number")
      .or(`raw_data->>invoice_number.ilike.%${f.invoice_no}%,external_order_id.ilike.%${f.invoice_no}%`)
      .limit(5);
    for (const o of data ?? []) bump(`order:${o.id}`, { entity_type: "order", entity_id: o.id, label: o.order_number }, weights.invoice_number, "invoice_no");
  }

  // DEVICES (serial)
  if (f.serial_no) {
    const { data } = await supabase.from("lager_devices")
      .select("id, serial_number, model, order_id")
      .ilike("serial_number", `%${f.serial_no}%`).limit(10);
    for (const d of data ?? []) {
      bump(`device:${d.id}`, { entity_type: "device", entity_id: d.id, label: `${d.model ?? ""} ${d.serial_number ?? ""}`.trim() }, weights.serial_number, "serial_no");
      if (d.order_id) bump(`order:${d.order_id}`, { entity_type: "order", entity_id: d.order_id, label: `Auftrag (Gerät ${d.serial_number})` }, Math.round(weights.serial_number * 0.6), "serial_no→order");
    }
  }

  // CUSTOMERS
  const custOr: string[] = [];
  if (f.email) custOr.push(`email.ilike.%${f.email}%`);
  if (f.phone) custOr.push(`phone.ilike.%${f.phone.replace(/\D/g, "").slice(-8)}%`);
  if (f.company) custOr.push(`company_name.ilike.%${f.company}%`);
  if (f.customer_name) custOr.push(`contact_name.ilike.%${f.customer_name}%`);
  if (custOr.length) {
    const { data } = await supabase.from("customers")
      .select("id, company_name, contact_name, email, phone")
      .or(custOr.join(",")).limit(20);
    for (const c of data ?? []) {
      const label = c.company_name || c.contact_name || c.email || c.id;
      if (f.email && c.email && c.email.toLowerCase() === f.email.toLowerCase()) bump(`customer:${c.id}`, { entity_type: "customer", entity_id: c.id, label }, weights.email, "email");
      if (f.phone && c.phone && c.phone.replace(/\D/g, "").slice(-6) === f.phone.replace(/\D/g, "").slice(-6)) bump(`customer:${c.id}`, { entity_type: "customer", entity_id: c.id, label }, weights.phone, "phone");
      if (f.company && c.company_name && c.company_name.toLowerCase().includes(f.company.toLowerCase())) bump(`customer:${c.id}`, { entity_type: "customer", entity_id: c.id, label }, weights.company, "company");
      if (f.customer_name && c.contact_name && c.contact_name.toLowerCase().includes(f.customer_name.toLowerCase())) bump(`customer:${c.id}`, { entity_type: "customer", entity_id: c.id, label }, weights.name, "name");
    }
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

async function applyRules(supabase: any, filename: string, ocrText: string, extra: ExtractedFields): Promise<{ bonuses: { key: string; points: number; rule_id: string }[] }> {
  const { data: rules } = await supabase.from("alixdocs_matching_rules").select("*").eq("is_active", true).limit(200);
  const bonuses: { key: string; points: number; rule_id: string }[] = [];
  for (const r of rules ?? []) {
    let hay = "";
    if (r.field === "filename") hay = filename;
    else if (r.field === "ocr") hay = (ocrText || "").slice(0, 20000);
    else if (r.field === "email_sender") hay = extra.email ?? "";
    try {
      const rx = new RegExp(r.pattern, "i");
      if (rx.test(hay) && r.target_id) {
        bonuses.push({ key: `${r.target_type}:${r.target_id}`, points: r.weight_bonus, rule_id: r.id });
      }
    } catch { /* invalid regex */ }
  }
  return { bonuses };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const { document_id, dry_run } = body;
  if (!document_id || typeof document_id !== "string") return json(400, { error: "document_id required" });

  const { data: doc, error: docErr } = await supabase
    .from("alixdocs_documents")
    .select("id, original_filename, title, ocr_text, ai_order_numbers, ai_serial_numbers, order_id, customer_id, device_id")
    .eq("id", document_id)
    .maybeSingle();
  if (docErr || !doc) return json(404, { error: "document not found", details: docErr?.message });

  const config = await loadConfig(supabase);
  const fileName = (doc.original_filename ?? doc.title ?? "") as string;
  const fromName = parseFilename(fileName);
  const fromEntities: ExtractedFields = {
    orderNumbers: (doc.ai_order_numbers as string[] | null) ?? [],
    serials: (doc.ai_serial_numbers as string[] | null) ?? [],
  } as any;
  const seed = merge(fromName, fromEntities);
  const fromAI = await extractFieldsAI(doc.ocr_text ?? "", fileName);
  const fields = merge(seed, fromAI);

  const candidates = await findCandidates(supabase, fields, config.weights);
  const rules = await applyRules(supabase, fileName, doc.ocr_text ?? "", fields);
  for (const b of rules.bonuses) {
    const c = candidates.find(c => `${c.entity_type}:${c.entity_id}` === b.key);
    if (c) { c.score += b.points; c.hits.push(`rule:${b.rule_id}`); }
  }
  candidates.sort((a, b) => b.score - a.score);

  const top = candidates[0];
  const second = candidates[1];
  let confidence: "auto" | "suggested" | "unassigned" = "unassigned";
  let method = "filename+ocr+ai";
  let update: any = {
    match_score: top?.score ?? 0,
    match_method: method,
    match_candidates: candidates.slice(0, 5),
  };

  if (top && top.score >= config.auto_assign_threshold && (!second || top.score - second.score >= config.auto_assign_gap)) {
    confidence = "auto";
    if (top.entity_type === "order") update.order_id = top.entity_id;
    if (top.entity_type === "customer") update.customer_id = top.entity_id;
    if (top.entity_type === "device") update.device_id = top.entity_id;
  } else if (top && top.score >= config.suggest_threshold) {
    confidence = "suggested";
  }
  update.match_confidence = confidence;

  if (!dry_run) {
    const { error: upErr } = await supabase.from("alixdocs_documents").update(update).eq("id", document_id);
    if (upErr) return json(500, { error: upErr.message });
  }

  return json(200, {
    document_id,
    extracted: fields,
    confidence,
    top: top ?? null,
    candidates: candidates.slice(0, 5),
    updated: !dry_run,
  });
});
