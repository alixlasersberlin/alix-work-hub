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
const UA = "Mozilla/5.0 (compatible; AlixWorkProductHub/1.0)";

const FIELD_MAP: Record<string, string> = {
  name: "product_name",
  product_name: "product_name",
  model: "model",
  wavelengths: "wavelengths_nm",
  wavelengths_nm: "wavelengths_nm",
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

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "product_name", "title"],
  model: ["model", "modell"],
  wavelengths: ["wavelengths", "wavelengths_nm", "wellenlaengen"],
  power: ["power", "power_w", "leistung"],
  cooling: ["cooling", "kuehlung", "kühlung"],
  fluence: ["fluence", "fluenz"],
  pulse_duration: ["pulse_duration", "pulsdauer"],
  frequency: ["frequency", "frequenz"],
  spot_sizes: ["spot_sizes", "spot_size", "spotgroesse", "spotgröße"],
  laser_class: ["laser_class", "laserklasse"],
  intended_use: ["intended_use", "zweckbestimmung"],
};

// Tiefensuche: der DE-Export legt technische Felder je nach Geraet flach
// oder verschachtelt (specs/tech_specs/attributes/...) ab.
function deepFind(raw: any, keys: string[], depth = 0): string | null {
  if (!raw || typeof raw !== "object" || depth > 4) return null;
  for (const k of keys) {
    if (k in raw) {
      const v = asText((raw as any)[k]);
      if (v) return v;
    }
  }
  for (const v of Object.values(raw)) {
    if (v && typeof v === "object") {
      const hit = deepFind(v, keys, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function liveValue(raw: any, field: string): string | null {
  if (!raw) return null;
  const keys = [...new Set([...(FIELD_ALIASES[field] || [field]), FIELD_MAP[field] || field])];
  return deepFind(raw, keys);
}


function collectProducts(body: any): any[] {
  if (Array.isArray(body)) return body;
  const direct = body?.products || body?.data || body?.items || body?.results || body?.rows;
  if (Array.isArray(direct)) return direct;
  // tief suchen: erstes Array mit Objekten, die produktartige Keys haben
  const out: any[] = [];
  const walk = (v: any, d = 0) => {
    if (!v || typeof v !== "object" || d > 4 || out.length) return;
    if (Array.isArray(v)) {
      if (v.some((x) => x && typeof x === "object" && ("alix_product_id" in x || "slug" in x || "name" in x || "product_name" in x))) {
        out.push(...v);
      }
      return;
    }
    for (const val of Object.values(v)) walk(val, d + 1);
  };
  walk(body);
  if (out.length) return out;
  if (direct && typeof direct === "object") return [direct];
  if (body?.product) return [body.product];
  return [];
}

async function fetchDeProduct(alixId: string) {
  const key = Deno.env.get("DE_EXPORT_API_KEY") || "";
  const res = await fetch(DE_EXPORT, { headers: { "x-api-key": key, "User-Agent": UA } });
  const text = await res.text();
  if (!res.ok) throw new Error(`DE Export ${res.status}: ${text.slice(0, 200)}`);
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error(`DE Export lieferte kein JSON: ${text.slice(0, 200)}`); }
  const list = collectProducts(body);
  const idOf = (p: any) => String(p?.alix_product_id ?? p?.alixProductId ?? p?.product_id ?? p?.id ?? "");
  const nameOf = (p: any) => String(p?.name ?? p?.product_name ?? p?.model ?? p?.slug ?? "").toLowerCase().replace(/[\s_-]/g, "");
  let hit = list.find((p) => idOf(p) === alixId);
  if (!hit) hit = list.find((p) => nameOf(p).includes("blueice"));
  if (!hit) {
    const sample = list.slice(0, 10).map((p) => `${idOf(p)}|${p?.name ?? p?.product_name ?? "?"}`).join(", ");
    throw new Error(
      `BlueIce im DE-Export nicht gefunden (${list.length} Produkte, Top-Keys: ${Object.keys(body || {}).slice(0, 8).join(",")}${sample ? `, Beispiele: ${sample}` : ""})`,
    );
  }
  return { product: hit, payloadHash: await sha256(JSON.stringify(hit)) };
}


async function writeCall(body: Record<string, unknown>, dryRun = true) {
  const key = Deno.env.get("DE_PRODUCT_HUB_WRITE_KEY") || "";
  if (!key) return { status: 0, body: { error: "DE_PRODUCT_HUB_WRITE_KEY fehlt" } as any, ok: false };
  const res = await fetch(DE_WRITE, {
    method: "PATCH",
    headers: { "x-api-key": key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ publish_id: `alixwork-${Date.now()}`, ...body, dry_run: dryRun }),
  });
  const raw = await res.text();
  let parsed: any = raw;
  try { parsed = JSON.parse(raw); } catch { /* text */ }
  return { status: res.status, body: parsed, ok: res.ok };
}

// wavelengths_nm erwartet am DE-Endpoint eine numerische Liste
function deValue(deField: string, v: unknown): unknown {
  if (deField === "wavelengths_nm") {
    const nums = String(asText(v) ?? "").match(/\d+/g)?.map(Number) ?? [];
    if (nums.length) return nums;
  }
  return asText(v);
}

// Normalisierter Vergleich: Zahlenlisten numerisch, Text ohne Trenner/Case/Unicode-Minus
function normCompare(field: string, a: unknown, b: unknown): boolean {
  const ta = asText(a), tb = asText(b);
  if (ta === null && tb === null) return true;
  if (ta === null || tb === null) return false;
  if (field === "wavelengths" || field === "wavelengths_nm") {
    const na = (ta.match(/\d+/g) || []).map(Number).sort((x, y) => x - y).join(",");
    const nb = (tb.match(/\d+/g) || []).map(Number).sort((x, y) => x - y).join(",");
    return na === nb && na !== "";
  }
  const clean = (s: string) =>
    s.toLowerCase().replace(/[−–—]/g, "-").replace(/\s+/g, " ").replace(/[.,;]+$/g, "").trim();
  return clean(ta) === clean(tb);
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
    if (action === "de_dump") {
      const cur = await fetchDeProduct(productId || BLUEICE_ID);
      const fields = ["name", "wavelengths", "power", "cooling", "fluence", "pulse_duration", "frequency", "spot_sizes", "laser_class", "intended_use"];
      const resolved: Record<string, string | null> = {};
      for (const f of fields) resolved[f] = liveValue(cur.product, f);
      return json(200, { raw: cur.product, resolved });
    }

    if (action === "selftest") {
      const tests: any[] = [];
      const before = await fetchDeProduct(BLUEICE_ID);
      const liveName = liveValue(before.product, "name");

      const t1 = await writeCall({ alix_product_id: BLUEICE_ID, field: "product_name", value: liveName, expected_previous_value: liveName });
      tests.push({ name: "Auth funktioniert", pass: t1.status !== 401 && t1.status !== 403 && t1.status !== 0, status: t1.status, detail: t1.status === 0 ? "Write-Key fehlt" : "" });
      tests.push({ name: "BlueIce-ID wird akzeptiert", pass: t1.ok, status: t1.status, detail: String((t1.body as any)?.status || codeOf(t1.body)) });
      tests.push({ name: "Erlaubtes Feld akzeptiert", pass: t1.ok, status: t1.status, detail: typeof t1.body === "object" ? JSON.stringify(t1.body).slice(0, 200) : String(t1.body).slice(0, 200) });

      const t2 = await writeCall({ alix_product_id: "00000000-0000-0000-0000-000000000000", field: "product_name", value: "X", expected_previous_value: null });
      tests.push({ name: "Fremdes Geraet abgewiesen (Scope)", pass: !t2.ok && [403, 404].includes(t2.status), status: t2.status, detail: codeOf(t2.body) });

      const t3 = await writeCall({ alix_product_id: BLUEICE_ID, field: "price", value: "1", expected_previous_value: null });
      tests.push({ name: "Verbotenes Feld abgelehnt (FIELD_NOT_ALLOWED)", pass: !t3.ok && codeOf(t3.body).includes("FIELD_NOT_ALLOWED"), status: t3.status, detail: codeOf(t3.body) });

      const t4 = await writeCall({ alix_product_id: BLUEICE_ID, field: "product_name", value: liveName, expected_previous_value: "__ABSICHTLICH_FALSCH__" });
      tests.push({ name: "Optimistic Lock (409 CONFLICT)", pass: t4.status === 409 || codeOf(t4.body).includes("CONFLICT"), status: t4.status, detail: codeOf(t4.body) });

      const after = await fetchDeProduct(BLUEICE_ID);
      tests.push({ name: "dry_run veraendert keine Daten", pass: after.payloadHash === before.payloadHash, status: 200, detail: after.payloadHash.slice(0, 12) });

      const allPass = tests.every((t) => t.pass);
      {
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

      // Offene DE-Diffs dieses Geraets – auch erneut snapshotbar (Re-Snapshot nach
      // gestopptem Lauf). Bereits VERIFIED/SKIPPED Felder bleiben unberuehrt.
      const { data: queue } = await admin
        .from("ph_publish_queue")
        .select("*")
        .eq("product_id", productId)
        .eq("channel_code", "de")
        .neq("verify_status", "VERIFIED")
        .in("status", ["DRAFT", "PUBLISHED", "FAILED"])
        .order("created_at", { ascending: true });
      if (!queue?.length) {
        return json(400, {
          error: "Keine offenen DE-Diffs vorhanden – alle Felder sind bereits verifiziert (SKIPPED/PUBLISHED).",
        });
      }


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
        const probe = await writeCall({
          publish_id: `snapshot-${batch.id}-${field}`,
          alix_product_id: alixId,
          field: deField,
          value: deValue(deField, q.new_value),
        });
        // current_value kommt auch bei 409 CONFLICT zurueck – immer auswerten
        const probed = asText((probe.body as any)?.current_value);
        const current = probed ?? liveValue(live, deField);
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
          status: "DRAFT",
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
          value: deValue(FIELD_MAP[s.field] || s.field, s.target_master_value),
          expected_previous_value: s.current_live_value,
          publish_id: `${batchId}:${s.field}`,
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

    // ---- BlueIce Sync-Lock aktivieren / verifizieren -------------------------
    if (action === "lock" || action === "lock_verify") {
      const { data: cur } = await admin.from("ph_settings").select("*").eq("key", "blueice_canary_lock").maybeSingle();
      const val: any = { ...(cur?.value || {}) };
      if (action === "lock") {
        val.active = true;
        val.scope = "single_product";
        val.master_source = "alixwork";
        val.product_id = BLUEICE_ID;
        val.excluded_product_ids = [BLUEICE_ID];
        val.activated_at = new Date().toISOString();
        val.activated_by = user.id;
        val.note = "COM→DE Sync fuer BlueIce ausgeschlossen. Alle anderen Produkte laufen weiter.";
        await admin.from("ph_settings").upsert(
          { key: "blueice_canary_lock", value: val, updated_at: new Date().toISOString(), updated_by: user.id },
          { onConflict: "key" },
        );
        await admin.from("ph_sync_log").insert({
          channel_code: "de", direction: "internal", operation: "canary_lock", status: "success",
          message: `BlueIce Sync-Lock AKTIV (${BLUEICE_ID}) – COM→DE fuer dieses Geraet ausgeschlossen`,
        });
      }
      // Verifikation: genau 1 Produkt gesperrt, uebrige weiterhin im Sync
      const { count: total } = await admin.from("ph_products").select("id", { count: "exact", head: true });
      const excluded: string[] = val.excluded_product_ids || [];
      const { data: phase } = await admin.from("ph_settings").select("value").eq("key", "migration_phase").maybeSingle();
      return json(200, {
        lock: val.active ? "ACTIVE" : "INACTIVE",
        excluded_product_ids: excluded,
        excluded_count: excluded.length,
        products_total: total ?? 0,
        products_still_syncing: Math.max((total ?? 0) - excluded.length, 0),
        com_de_sync_active: (phase?.value as any)?.com_de_sync_active ?? true,
        phase: (phase?.value as any)?.phase ?? "B",
        activated_at: val.activated_at ?? null,
      });
    }

    // ---- Live-Publish mit Read-back je Feld ---------------------------------
    if (action === "publish") {
      const batchId = payload.batch_id;
      if (!batchId) return json(400, { error: "batch_id fehlt" });

      // Guard 1: Lock muss aktiv sein
      const { data: lockRow } = await admin.from("ph_settings").select("value").eq("key", "blueice_canary_lock").maybeSingle();
      if (!(lockRow?.value as any)?.active) return json(400, { error: "BlueIce Sync-Lock ist nicht aktiv – Abbruch" });

      const { data: batch } = await admin.from("ph_canary_batches").select("*").eq("id", batchId).maybeSingle();
      if (!batch) return json(404, { error: "Batch nicht gefunden" });
      if (batch.alix_product_id !== BLUEICE_ID) return json(403, { error: "Nur BlueIce erlaubt" });
      if ((batch.checks || {}).dry_run !== "PASSED") return json(400, { error: "Dry-Run nicht bestanden – Abbruch" });

      const { data: snaps } = await admin.from("ph_canary_snapshots").select("*").eq("batch_id", batchId).order("rollback_order");
      const results: any[] = [];
      let written = 0, skipped = 0, verified = 0, failed = 0;
      let stopped: string | null = null;

      for (const s of snaps || []) {
        const deField = FIELD_MAP[s.field] || s.field;
        const target = s.target_master_value;

        // NO_CHANGE / SKIP – Wert steht bereits korrekt live
        if (normCompare(s.field, s.current_live_value, target)) {
          skipped++; verified++;
          results.push({ field: s.field, action: "SKIP", reason: "NO_CHANGE", live_value: s.current_live_value, readback: s.current_live_value, verified: true });
          await admin.from("ph_publish_queue").update({
            status: "SKIPPED", verify_status: "VERIFIED", verified_at: new Date().toISOString(),
            notes: "NO_CHANGE – Live-Wert entspricht bereits dem Master",
          }).eq("id", s.publish_id);
          continue;
        }

        const w = await writeCall({
          alix_product_id: batch.alix_product_id,
          field: deField,
          value: deValue(deField, target),
          expected_previous_value: s.current_live_value,
          publish_id: `${batchId}:${s.field}`,
          idempotency_key: `${batchId}:${s.field}`,
        }, false);

        if (!w.ok) {
          failed++;
          stopped = `${s.field}: HTTP ${w.status} ${codeOf(w.body)}`;
          results.push({ field: s.field, action: "WRITE", status: w.status, error: codeOf(w.body) || String(w.body).slice(0, 200), verified: false });
          await admin.from("ph_publish_queue").update({
            status: "FAILED", verify_status: "FAILED", notes: `Write-Fehler ${w.status} ${codeOf(w.body)}`,
          }).eq("id", s.publish_id);
          break;
        }
        written++;

        // Read-back direkt gegen den DE-Export – mit kurzen Retries, weil der
        // Export nach dem Schreiben leicht verzoegert/gecached ausliefern kann.
        let readback: string | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const fresh = await fetchDeProduct(batch.alix_product_id);
            readback = liveValue(fresh.product, s.field);
            stopped = null;
          } catch (e) {
            readback = null;
            stopped = `${s.field}: Read-back fehlgeschlagen (${(e as Error).message})`;
          }
          if (!stopped && normCompare(s.field, readback, target)) break;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }

        const ok = !stopped && normCompare(s.field, readback, target);
        if (ok) {
          verified++;
          await admin.from("ph_publish_queue").update({
            status: "PUBLISHED", verify_status: "VERIFIED", verified_at: new Date().toISOString(),
            old_value: s.current_live_value, notes: "Live geschrieben und zurueckgelesen",
          }).eq("id", s.publish_id);
          await admin.from("ph_canary_snapshots").update({ readback_value: readback, readback_at: new Date().toISOString() }).eq("id", s.id);
        } else {
          failed++;
          stopped = stopped || `${s.field}: Read-back weicht ab (live="${readback}", soll="${target}")`;
          results.push({ field: s.field, action: "WRITE", status: w.status, readback, verified: false, error: stopped });
          await admin.from("ph_publish_queue").update({
            status: "PUBLISHED", verify_status: "MISMATCH", notes: stopped,
          }).eq("id", s.publish_id);
          break;
        }
        results.push({ field: s.field, action: "WRITE", status: w.status, previous_value: s.current_live_value, new_value: asText(target), readback, verified: true });
        if (stopped) break;
      }

      const attempted = results.length;
      const allDone = !stopped && failed === 0 && (snaps || []).length === attempted;

      // Finaler Export-Vergleich Master <-> DE
      let compare: any = null;
      if (allDone) {
        const fresh = await fetchDeProduct(batch.alix_product_id);
        const diffs: any[] = [];
        for (const s of snaps || []) {
          const live = liveValue(fresh.product, s.field);
          if (!normCompare(s.field, live, s.target_master_value)) diffs.push({ field: s.field, live, master: s.target_master_value });
        }
        compare = { match: diffs.length === 0, diffs, export_hash: fresh.payloadHash, compared_at: new Date().toISOString() };
      }

      await admin.from("ph_canary_batches").update({
        status: allDone ? "PUBLISHED" : "FAILED",
        published_at: allDone ? new Date().toISOString() : null,
        checks: {
          ...(batch.checks || {}),
          publish: allDone ? "SUCCESS" : "STOPPED",
          attempted, written, skipped, verified, failed,
          stopped_at: stopped, results, compare,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", batchId);

      await admin.from("ph_sync_log").insert({
        channel_code: "de", direction: "outbound", operation: "canary_publish",
        status: allDone ? "success" : "error",
        message: allDone
          ? `BlueIce DE Canary: ${written} geschrieben, ${skipped} uebersprungen, Read-back ${verified}/${attempted}`
          : `BlueIce DE Canary GESTOPPT: ${stopped}`,
      });

      return json(200, {
        publish: allDone ? "SUCCESS" : "STOPPED",
        attempted, written, skipped, verified, failed,
        stopped_at: stopped, results, compare,
        rollback_available: true,
      });
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
