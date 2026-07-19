// AlixDocs Link-Suggest (Etappe 6, Cross-Doc-Verknüpfung)
// - Findet potenzielle Verknüpfungen zwischen Dokumenten anhand
//   gemeinsamer Auftragsnummern (ai_order_numbers) oder Seriennummern (ai_serial_numbers / serial_number).
// - Legt Vorschläge in alixdocs_document_links (source='ai') an – idempotent per UNIQUE.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: Service-Role (Cron) ODER Admin/Super Admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (jwt && jwt !== serviceKey) {
    const { data: userRes } = await supa.auth.getUser(jwt);
    const uid = userRes?.user?.id;
    if (!uid) return json(401, { error: "unauthorized" });
    const { data: roles } = await supa.from("user_roles").select("role").eq("user_id", uid);
    const allowed = (roles ?? []).some((r) => ["Super Admin", "Admin"].includes(String(r.role)));
    if (!allowed) return json(403, { error: "forbidden" });
  }

  const body = await req.json().catch(() => ({}));
  const singleDocId: string | undefined = body?.document_id;
  const limit = Number(body?.limit ?? 500);

  const base = supa
    .from("alixdocs_documents")
    .select("id, order_id, serial_number, ai_order_numbers, ai_serial_numbers, ai_processed_at")
    .is("deleted_at", null);

  const { data: docs, error } = singleDocId
    ? await base.eq("id", singleDocId).limit(1)
    : await base.not("ai_processed_at", "is", null).order("ai_processed_at", { ascending: false }).limit(limit);

  if (error) return json(500, { error: error.message });
  if (!docs || docs.length === 0) return json(200, { ok: true, created: 0, scanned: 0 });

  // Index bauen: normalisierte Order-/Seriennummern → docIds
  const byOrder = new Map<string, Set<string>>();
  const bySerial = new Map<string, Set<string>>();
  const norm = (s: unknown) => String(s ?? "").trim().toUpperCase();

  // Kandidatenpool: bei Einzeldoc auch den Rest laden
  let pool = docs;
  if (singleDocId) {
    const { data: rest } = await supa
      .from("alixdocs_documents")
      .select("id, order_id, serial_number, ai_order_numbers, ai_serial_numbers")
      .is("deleted_at", null)
      .neq("id", singleDocId)
      .limit(2000);
    pool = [...docs, ...(rest ?? [])];
  }

  for (const d of pool) {
    const orders = new Set<string>();
    (d.ai_order_numbers ?? []).forEach((o: string) => o && orders.add(norm(o)));
    const serials = new Set<string>();
    if (d.serial_number) serials.add(norm(d.serial_number));
    (d.ai_serial_numbers ?? []).forEach((s: string) => s && serials.add(norm(s)));

    for (const o of orders) {
      if (!byOrder.has(o)) byOrder.set(o, new Set());
      byOrder.get(o)!.add(d.id);
    }
    for (const s of serials) {
      if (!bySerial.has(s)) bySerial.set(s, new Set());
      bySerial.get(s)!.add(d.id);
    }
  }

  // Vorschläge sammeln
  type Link = { from_doc_id: string; to_doc_id: string; link_type: string; confidence: number; source: string; note: string };
  const links = new Map<string, Link>();
  const addLink = (a: string, b: string, type: string, conf: number, note: string) => {
    if (a === b) return;
    const [x, y] = [a, b].sort();
    const key = `${x}|${y}|${type}`;
    if (!links.has(key)) links.set(key, { from_doc_id: x, to_doc_id: y, link_type: type, confidence: conf, source: "ai", note });
  };

  const sourceDocIds = new Set(docs.map((d) => d.id));

  for (const [orderKey, ids] of byOrder) {
    if (ids.size < 2) continue;
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!sourceDocIds.has(arr[i]) && !sourceDocIds.has(arr[j])) continue;
        addLink(arr[i], arr[j], "related_order", 90, `Auftrag ${orderKey}`);
      }
    }
  }
  for (const [serialKey, ids] of bySerial) {
    if (ids.size < 2) continue;
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (!sourceDocIds.has(arr[i]) && !sourceDocIds.has(arr[j])) continue;
        addLink(arr[i], arr[j], "references", 80, `Seriennr. ${serialKey}`);
      }
    }
  }

  const rows = [...links.values()];
  if (rows.length === 0) return json(200, { ok: true, created: 0, scanned: docs.length });

  // Idempotent per UNIQUE (from,to,type) – Konflikte einfach ignorieren
  const { error: insErr, data: ins } = await supa
    .from("alixdocs_document_links")
    .upsert(rows, { onConflict: "from_doc_id,to_doc_id,link_type", ignoreDuplicates: true })
    .select("id");

  if (insErr) return json(500, { error: insErr.message });

  return json(200, { ok: true, created: ins?.length ?? 0, candidates: rows.length, scanned: docs.length });
});
