// ALIXDocs AI 2.0 — Phase 4: Auto-Zuordnung
// Scored ein Dokument gegen customers/orders/lager_devices/zoho_invoices/finance_contracts/repair_orders/tickets
// und liefert Top-Vorschläge (persistiert optional in alixdocs2_relations bei apply=true).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Suggestion = { linked_type: string; linked_id: string; label: string; confidence: number; reason: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, service);

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
  const apply: string[] = Array.isArray(body?.apply) ? body.apply : []; // Array von "type:id"
  if (!document_id) return json(400, { error: "document_id required" });

  const { data: doc } = await admin
    .from("alixdocs2_documents")
    .select("id, title, ocr_text, ai_entities")
    .eq("id", document_id).maybeSingle();
  if (!doc) return json(404, { error: "not_found" });

  const ent = (doc.ai_entities ?? {}) as any;
  const hay = `${doc.title ?? ""} ${doc.ocr_text ?? ""}`.slice(0, 30000);
  const suggestions: Suggestion[] = [];
  const push = (s: Suggestion) => suggestions.push(s);

  // 1) Auftrags-Nr
  const auftragNr = String(ent.auftrag_nr ?? "").trim();
  if (auftragNr) {
    const { data } = await admin.from("orders")
      .select("id, order_number, customer_name").ilike("order_number", `%${auftragNr}%`).limit(3);
    (data ?? []).forEach(o => push({
      linked_type: "auftrag", linked_id: o.id, label: `${o.order_number} — ${o.customer_name ?? ""}`,
      confidence: o.order_number === auftragNr ? 0.98 : 0.85, reason: `Auftrags-Nr ${auftragNr}`,
    }));
  }

  // 2) Serien-Nr
  const seriNr = String(ent.serien_nr ?? "").trim();
  if (seriNr) {
    const { data } = await admin.from("lager_devices")
      .select("id, serial_number, model_name").ilike("serial_number", `%${seriNr}%`).limit(3);
    (data ?? []).forEach(d => push({
      linked_type: "geraet", linked_id: d.id, label: `${d.serial_number} — ${d.model_name ?? ""}`,
      confidence: d.serial_number === seriNr ? 0.97 : 0.8, reason: `Serien-Nr ${seriNr}`,
    }));
  }

  // 3) Rechnungs-Nr
  const rechNr = String(ent.rechnung_nr ?? "").trim();
  if (rechNr) {
    const { data } = await admin.from("zoho_invoices")
      .select("id, invoice_number, customer_name").ilike("invoice_number", `%${rechNr}%`).limit(3);
    (data ?? []).forEach(i => push({
      linked_type: "rechnung", linked_id: i.id, label: `${i.invoice_number} — ${i.customer_name ?? ""}`,
      confidence: i.invoice_number === rechNr ? 0.95 : 0.8, reason: `Rechnungs-Nr ${rechNr}`,
    }));
  }

  // 4) Kunde nach Name / Kunden-Nr / Email
  const kundeName = String(ent.kunde_name ?? "").trim();
  const kundeNr = String(ent.kunde_nr ?? "").trim();
  const email = String(ent.email ?? "").trim();
  if (kundeNr || kundeName || email) {
    let q = admin.from("customers").select("id, customer_name, customer_number, email").limit(5);
    if (kundeNr) q = q.ilike("customer_number", `%${kundeNr}%`);
    else if (email) q = q.ilike("email", `%${email}%`);
    else if (kundeName) {
      const tokens = kundeName.split(/\s+/).filter(t => t.length > 2).slice(0, 3);
      tokens.forEach(t => { q = q.ilike("customer_name", `%${t}%`); });
    }
    const { data } = await q;
    (data ?? []).forEach(c => push({
      linked_type: "kunde", linked_id: c.id, label: `${c.customer_name} ${c.customer_number ? `(${c.customer_number})` : ""}`,
      confidence: kundeNr && c.customer_number === kundeNr ? 0.95 : email && c.email === email ? 0.9 : 0.7,
      reason: kundeNr ? `Kunden-Nr` : email ? `Email` : `Name`,
    }));
  }

  // 5) Reparatur / Service
  if (auftragNr) {
    const { data } = await admin.from("repair_orders")
      .select("id, repair_number, customer_name").ilike("repair_number", `%${auftragNr}%`).limit(2);
    (data ?? []).forEach(r => push({
      linked_type: "service", linked_id: r.id, label: `${r.repair_number} — ${r.customer_name ?? ""}`,
      confidence: 0.75, reason: `Reparatur-Nr`,
    }));
  }

  // Dedupe + sort
  const seen = new Set<string>();
  const unique = suggestions.filter(s => {
    const k = `${s.linked_type}:${s.linked_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 10);

  // Apply
  const applied: string[] = [];
  for (const key of apply) {
    const s = unique.find(x => `${x.linked_type}:${x.linked_id}` === key);
    if (!s) continue;
    const { error } = await admin.from("alixdocs2_relations").insert({
      document_id, linked_type: s.linked_type, linked_id: s.linked_id,
      confidence: s.confidence, source: "ai",
    });
    if (!error) applied.push(key);
  }
  if (applied.length > 0) {
    await admin.from("alixdocs2_documents").update({ status: "zugeordnet" }).eq("id", document_id);
    await admin.from("alixdocs2_audit").insert({ document_id, action: "auto_matched", detail: { applied } });
  }

  return json(200, { ok: true, suggestions: unique, applied });
});
