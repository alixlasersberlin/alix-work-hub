// ALIXDocs AI 2.0 — Phase 3: OCR + KI-Analyse
// Lädt Datei aus Nextcloud (WebDAV), extrahiert Text (PDF), fallback OCR via Gemini Vision,
// klassifiziert Doku-Typ + extrahiert Entitäten via Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import pdfParse from "npm:pdf-parse@1.1.1";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "google/gemini-3-flash-preview";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB Text-Pfad; darüber nur Metadaten
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(key: string, messages: any[], jsonMode = false) {
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  if (!lovable) return json(500, { error: "LOVABLE_API_KEY missing" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const isService = authHeader === `Bearer ${service}`;
  if (!isService) {
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
    const uc = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: a } = await uc.rpc("has_role", { check_role: "Admin" });
    const { data: s } = await uc.rpc("has_role", { check_role: "Super Admin" });
    if (!a && !s) return json(403, { error: "forbidden" });
  }

  const body = await req.json().catch(() => ({}));
  const document_id = String(body?.document_id ?? "");
  if (!document_id) return json(400, { error: "document_id required" });

  const admin = createClient(url, service);
  const { data: doc, error: dErr } = await admin
    .from("alixdocs2_documents")
    .select("id, nc_server_id, nc_path, size_bytes, mime, title, status")
    .eq("id", document_id).maybeSingle();
  if (dErr || !doc) return json(404, { error: "document_not_found" });

  const { data: srv } = await admin
    .from("alixdocs2_nc_servers")
    .select("id, base_url, username, app_password_secret_name")
    .eq("id", doc.nc_server_id).maybeSingle();
  if (!srv) return json(500, { error: "nc_server_missing" });
  const password = Deno.env.get(srv.app_password_secret_name);
  if (!password) return json(500, { error: `secret_missing:${srv.app_password_secret_name}` });

  try {
    const davUrl = `${srv.base_url.replace(/\/$/, "")}/remote.php/dav/files/${srv.username}/${doc.nc_path}`;
    const basic = btoa(`${srv.username}:${password}`);
    const fr = await fetch(davUrl, { headers: { Authorization: `Basic ${basic}` } });
    if (!fr.ok) throw new Error(`download ${fr.status}`);
    const buf = new Uint8Array(await fr.arrayBuffer());

    let text = "";
    const mime = doc.mime ?? "";
    if (buf.byteLength > MAX_BYTES) {
      text = `[Datei zu groß für Volltext-Analyse: ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB]`;
    } else if (mime.includes("pdf") || doc.nc_path.toLowerCase().endsWith(".pdf")) {
      try {
        const parsed = await pdfParse(buf as any);
        text = (parsed?.text ?? "").trim();
      } catch { text = ""; }

      if (!text) {
        // OCR fallback via Gemini Vision (Base64)
        const b64 = btoa(String.fromCharCode(...buf.slice(0, Math.min(buf.byteLength, 4 * 1024 * 1024))));
        const ocr = await callAI(lovable, [
          { role: "system", content: "Du bist ein OCR-Assistent. Gib nur den erkannten Text zurück, in Originalsprache." },
          { role: "user", content: [
            { type: "text", text: `Bitte extrahiere allen sichtbaren Text aus dem PDF ${doc.title || doc.nc_path}.` },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
          ] },
        ]);
        text = (ocr || "").trim();
      }
    } else if (mime.startsWith("image/")) {
      const b64 = btoa(String.fromCharCode(...buf));
      const ocr = await callAI(lovable, [
        { role: "system", content: "OCR-Assistent, gib nur den Text zurück." },
        { role: "user", content: [
          { type: "text", text: "Extrahiere allen Text aus diesem Bild." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ] },
      ]);
      text = (ocr || "").trim();
    } else {
      text = new TextDecoder().decode(buf.slice(0, 200_000));
    }

    // Klassifikation + Entity-Extraktion
    const excerpt = (text || "").slice(0, 12000);
    const sys = `Du klassifizierst interne Firmendokumente (Alix Lasers). Antworte AUSSCHLIESSLICH als kompaktes JSON-Objekt mit folgenden Feldern:
{
 "doc_type": "rechnung|angebot|auftragsbestaetigung|lieferschein|garantie|wartung|vertrag|service|reklamation|technisch|sonstiges",
 "language": "de|en|tr|ru|ar|vi|other",
 "confidence": 0..1,
 "tags": ["kurze","stichworte"],
 "entities": {
   "kunde_name": null|"...",
   "kunde_nr": null|"...",
   "auftrag_nr": null|"...",
   "rechnung_nr": null|"...",
   "angebot_nr": null|"...",
   "serien_nr": null|"...",
   "betrag_netto": null|number,
   "betrag_brutto": null|number,
   "waehrung": null|"EUR|USD|...",
   "mwst_prozent": null|number,
   "datum": null|"YYYY-MM-DD",
   "garantie_bis": null|"YYYY-MM-DD",
   "vertrag_bis": null|"YYYY-MM-DD",
   "email": null|"...",
   "telefon": null|"...",
   "adresse": null|"...",
   "positionen": [{"beschreibung":"...","menge":number,"einzelpreis":number}]
 }
}`;
    const aiRaw = await callAI(lovable, [
      { role: "system", content: sys },
      { role: "user", content: `Dateiname: ${doc.title || doc.nc_path}\nMIME: ${mime}\n\nInhalt:\n${excerpt}` },
    ], true);

    let parsed: any = {};
    try { parsed = JSON.parse(aiRaw); } catch { parsed = {}; }

    await admin.from("alixdocs2_documents").update({
      ocr_text: text.slice(0, 500_000),
      doc_type: parsed.doc_type ?? null,
      language: parsed.language ?? null,
      ai_confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      ai_tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 20) : [],
      ai_entities: parsed.entities ?? {},
      ai_processed_at: new Date().toISOString(),
      status: "analysiert",
    }).eq("id", document_id);

    await admin.from("alixdocs2_audit").insert({
      document_id, action: "analyzed", detail: { doc_type: parsed.doc_type, confidence: parsed.confidence },
    }).select("id").maybeSingle();

    return json(200, { ok: true, doc_type: parsed.doc_type, confidence: parsed.confidence });
  } catch (e) {
    await admin.from("alixdocs2_documents").update({ status: "ocr_fehler" }).eq("id", document_id);
    return json(500, { error: (e as Error).message });
  }
});
