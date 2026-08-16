// ALIXWORK PRODUCT HUB – BlueIce DE Canary Safety Layer (Phase B)
// Serverseitig, kein Secret im Frontend. Aktionen:
//   selftest  – ausschliesslich Dry-Run-Tests gegen den DE-Write-Endpoint
//   snapshot  – liest DE-Live unmittelbar ueber den Export, friert Snapshot ein,
//               setzt previous_value/expected_previous_value in der Publish-Queue,
//               erzeugt das Rollback-Paket
//   dryrun    – Dry-Run aller Felder des eingefrorenen Batches
//   status    – Dashboard-Status
// Es wird in KEINER Aktion ein Live-Wert geschrieben (dry_run immer true).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DE_EXPORT = "https://alix-legacy-reborn.lovable.app/api/public/product-hub/export";
const DE_WRITE = "https://alix-legacy-reborn.lovable.app/api/public/product-hub/update";
const BLUEICE_ID = "ba67ae10-0100-899a-bb67-278abb6837aa";

// Master-Spalte -> Feldname am DE-Endpoint
const FIELD_MAP: Record<string, string> = {
  name: "name",
  model: "model",
  wavelengths: "wavelengths",
  power: "power",
  cooling: "cooling",
  fluence: "fluence",
  pulse_duration: "pulse_duration",
  frequency: "frequency",
  spot_sizes: "spot_sizes",
  laser_class: "laser_class",
  intended_use: "intended_use",
};

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const asText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.trim() === "" ? null : s;
};

function liveValue(raw: any, field: string): string | null {
  if (!raw) return null;
  const direct: Record<string, string[]> = {
    name: ["name", "product_name", "title"],
    model: ["model", "modell"],
    wavelengths: ["wavelengths", "wavelengths_nm"],
    power: ["power", "leistung"],
    cooling: ["cooling", "kuehlung"],
    fluence: ["fluence"],
    pulse_duration: ["pulse_duration", "pulsdauer"],
    frequency: ["frequency", "frequenz"],
    spot_sizes: ["spot_sizes", "spot_size"],
    laser_class: ["laser_class", "laserklasse"],
    intended_use: ["intended_use", "zweckbestimmung"],
  };
  for (const k of direct[field] || [field]) {
    const v = asText(raw[k]);
    if (v) return v;
  }
  const specs = raw.specs || raw.tech_specs || {};
  if (specs && typeof specs === "object") {
    for (const k of direct[field] || [field]) {
      const v = asText((specs as any)[k]);
      if (v) return v;
    }
  }
  return null;
}

async function fetchDeProduct(alixId: string) {
  const key = Deno.env.get("DE_EXPORT_API_KEY") || "";
  const res = await fetch(DE_EXPORT, { headers: { "x-api-key": key } });
  const text = await res.text();
  if (!res.ok) throw new Error(`DE Export ${res.status}: ${text.slice(0, 200)}`);
  const body = JSON.parse(text);
  const list: any[] = body.products || body.data || body.items || [];
  const hit = list.find(
    (p) => String(p.alix_product_id || p.alixProductId || p.id || "") === alixId,
  );
  if (!hit) throw new Error("BlueIce im DE-Export nicht gefunden");
  return { product: hit, payloadHash: await sha256(JSON.stringify(hit)) };
}

async function writeCall(body: Record<string, unknown>) {
  const key = Deno.env.get("DE_PRODUCT_HUB_WRITE_KEY") || "";
  if (!key) return { status: 0, body: { error: "DE_PRODUCT_HUB_WRITE_KEY fehlt" } as any, ok: false };
  const res = await fetch(DE_WRITE, {
    method: "PATCH",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, dry_run: true }),
  });
  const raw = await res.text();
  let parsed: any = raw;
  try { parsed = JSON.parse(raw); } catch { /* text */ }
  return { status: res.status, body: parsed, ok: res.ok };
}

const codeOf = (b: any) => String(b?.code || b?.error_code || b?.error || "").toUpperCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth: nur angemeldete Admin/Super Admin
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  const { data: userRes } = await admin.auth.getUser(jwt);
  const user = userRes?.user;
  if (!user) return json(401, { error: "unauthorized" });
  const { data: roleRows } = await admin.from("user_roles").select("roles(name)").eq("user_id", user.id);
  const roles = (roleRows || []).map((r: any) => String(r.roles?.name || ""));
  if (!roles.some((r) => ["Super Admin", "Admin"].includes(r))) {
    return json(403, { error: "forbidden", detail: "Nur Admin / Super Admin" });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { /* empty */ }
  const action = payload.action || "status";
  const productId: string | undefined = payload.product_id;

  try {
    if (action === "selftest") {
      const tests: any[] = [];
      const before = await fetchDeProduct(BLUEICE_ID);
      const liveName = liveValue(before.product, "name");

      const t1 = await writeCall({ alix_product_id: BLUEICE_ID, field: "name", value: liveName, expected_previous_value: liveName });
      tests.push({ name: "Auth funktioniert", pass: t1.status !== 401 && t1.status !== 403 && t1.status !== 0, status: t1.status, detail: t1.status === 0 ? "Write-Key fehlt" : "" });
      tests.push({ name: "BlueIce-ID wird akzeptiert", pass: t1.ok || codeOf(t1.body) !== "CANARY_SCOPE", status: t1.status, detail: codeOf(t1.body) });
      tests.push({ name: "Erlaubtes Feld akzeptiert", pass: t1.ok, status: t1.status, detail: typeof t1.body === "object" ? JSON.stringify(t1.body).slice(0, 200) : String(t1.body).slice(0, 200) });

      const t2 = await writeCall({ alix_product_id: "00000000-0000-0000-0000-000000000000", field: "name", value: "X", expected_previous_value: null });
      tests.push({ name: "Fremdes Geraet -> CANARY_SCOPE", pass: !t2.ok && (codeOf(t2.body).includes("CANARY_SCOPE") || t2.status === 403), status: t2.status, detail: codeOf(t2.body) });

      const t3 = await writeCall({ alix_product_id: BLUEICE_ID, field: "price", value: "1", expected_previous_value: null });
      tests.push({ name: "Verbotenes Feld abgelehnt", pass: !t3.ok, status: t3.status, detail: codeOf(t3.body) });

      const t4 = await writeCall({ alix_product_id: BLUEICE_ID, field: "name", value: liveName, expected_previous_value: "__ABSICHTLICH_FALSCH__" });
      tests.push({ name: "Optimistic Lock (409 CONFLICT)", pass: t4.status === 409 || codeOf(t4.body).includes("CONFLICT"), status: t4.status, detail: codeOf(t4.body) });

      const after = await fetchDeProduct(BLUEICE_ID);
      tests.push({ name: "dry_run veraendert keine Daten", pass: after.payloadHash === before.payloadHash, status: 200, detail: after.payloadHash.slice(0, 12) });

      const allPass = tests.every((t) => t.pass);
      if (productId) {
        await admin.from("ph_settings").upsert(
          { key: "canary_de_write", value: { state: allPass ? "READY" : "NOT READY", tests, checked_at: new Date().toISOString() }, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      }
      return json(200, { de_write: allPass ? "READY" : "NOT READY", tests });
    }

    if (action === "snapshot") {
      if (!productId) return json(400, { error: "product_id fehlt" });
      const { data: product } = await admin.from("ph_products").select("*").eq("id", productId).maybeSingle();
      if (!product) return json(404, { error: "Produkt nicht gefunden" });
      const alixId = product.alix_product_id || BLUEICE_ID;

      // Live unmittelbar lesen – niemals alte Importwerte verwenden
      const { product: live, payloadHash } = await fetchDeProduct(alixId);

      // Offene DE-DRAFT-Diffs dieses Geraets
      const { data: queue } = await admin
        .from("ph_publish_queue")
        .select("*")
        .eq("product_id", productId)
        .eq("channel_code", "de")
        .eq("status", "DRAFT")
        .is("batch_id", null)
        .order("created_at", { ascending: true });
      if (!queue?.length) return json(400, { error: "Keine offenen DE-DRAFT-Diffs vorhanden" });

      const masterHash = await sha256(JSON.stringify(queue.map((q: any) => [q.field_key, q.new_value])));

      const { data: batch, error: be } = await admin.from("ph_canary_batches").insert({
        product_id: productId,
        alix_product_id: alixId,
        channel_code: "de",
        status: "FROZEN",
        snapshot_at: new Date().toISOString(),
        frozen_at: new Date().toISOString(),
        master_hash: masterHash,
        created_by: user.id,
        checks: { snapshot: "FROZEN", source: "DE_LIVE", export_hash: payloadHash },
        notes: "BlueIce DE Canary – Snapshot eingefroren, kein Live-Push",
      }).select("*").single();
      if (be) throw be;

      const snapshots: any[] = [];
      let order = 1;
      for (const q of queue) {
        const field = String(q.field_key);
        const deField = FIELD_MAP[field] || field;
        const current = liveValue(live, deField);
        const target = asText(typeof q.new_value === "string" ? q.new_value : (q.new_value as any));
        snapshots.push({
          batch_id: batch.id,
          product_id: productId,
          alix_product_id: alixId,
          channel_code: "de",
          field,
          current_live_value: current,
          value_state: current === null ? "NULL/EMPTY CONFIRMED" : "VALUE",
          target_master_value: target,
          source: "DE_LIVE",
          source_hash: await sha256(`${payloadHash}:${deField}:${current ?? ""}`),
          publish_id: q.id,
          rollback_order: order++,
          captured_at: new Date().toISOString(),
        });
      }
      const { error: se } = await admin.from("ph_canary_snapshots").insert(snapshots);
      if (se) throw se;

      // previous_value / expected_previous_value in die Queue uebernehmen
      for (const s of snapshots) {
        await admin.from("ph_publish_queue").update({
          batch_id: batch.id,
          old_value: s.current_live_value,
          expected_previous_value: s.current_live_value,
          rollback_order: s.rollback_order,
          verify_status: "PENDING",
          notes: `Canary-Snapshot ${batch.id} · ${s.value_state}`,
        }).eq("id", s.publish_id);
      }

      // Rollback-Paket (Reihenfolge = umgekehrte Schreibreihenfolge)
      const rollbacks = snapshots
        .slice()
        .sort((a, b) => b.rollback_order - a.rollback_order)
        .map((s) => ({
          queue_id: s.publish_id,
          product_id: productId,
          channel_code: "de",
          field_key: s.field,
          previous_value: s.current_live_value,
          restored_value: null,
          action: "PREPARED",
          performed_by: user.id,
        }));
      const { data: rbRows, error: re } = await admin.from("ph_publish_rollbacks").insert(rollbacks).select("id, queue_id");
      if (re) throw re;
      for (const rb of rbRows || []) {
        await admin.from("ph_publish_queue").update({ rollback_publish_id: rb.id }).eq("id", rb.queue_id);
      }

      await admin.from("ph_canary_batches").update({
        checks: { ...batch.checks, rollback: "READY", fields: snapshots.length },
        updated_at: new Date().toISOString(),
      }).eq("id", batch.id);

      return json(200, {
        batch_id: batch.id,
        snapshot: "FROZEN",
        fields: snapshots.length,
        rollback: "READY",
        snapshots: snapshots.map((s) => ({ field: s.field, current_live_value: s.current_live_value, value_state: s.value_state, target_master_value: s.target_master_value })),
      });
    }

    if (action === "dryrun") {
      const batchId = payload.batch_id;
      if (!batchId) return json(400, { error: "batch_id fehlt" });
      const { data: batch } = await admin.from("ph_canary_batches").select("*").eq("id", batchId).maybeSingle();
      if (!batch) return json(404, { error: "Batch nicht gefunden" });
      const { data: snaps } = await admin.from("ph_canary_snapshots").select("*").eq("batch_id", batchId).order("rollback_order");
      const results: any[] = [];
      for (const s of snaps || []) {
        const r = await writeCall({
          alix_product_id: batch.alix_product_id,
          field: FIELD_MAP[s.field] || s.field,
          value: s.target_master_value,
          expected_previous_value: s.current_live_value,
          idempotency_key: `${batchId}:${s.field}`,
        });
        results.push({ field: s.field, status: r.status, pass: r.ok, code: codeOf(r.body) });
      }
      const passed = results.length > 0 && results.every((r) => r.pass);
      await admin.from("ph_canary_batches").update({
        checks: { ...(batch.checks || {}), dry_run: passed ? "PASSED" : "FAILED", dry_run_results: results, dry_run_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", batchId);
      return json(200, { dry_run: passed ? "PASSED" : "FAILED", results });
    }

    if (action === "status") {
      const { data: setting } = await admin.from("ph_settings").select("*").eq("key", "canary_de_write").maybeSingle();
      const { data: batch } = await admin.from("ph_canary_batches").select("*")
        .eq("product_id", productId ?? "").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return json(200, { de_write: (setting?.value as any)?.state ?? "UNKNOWN", tests: (setting?.value as any)?.tests ?? [], batch });
    }

    return json(400, { error: "unbekannte Aktion" });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
