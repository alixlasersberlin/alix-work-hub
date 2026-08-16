// ALIXWORK PRODUCT HUB – BlueIce COM Canary Safety Layer (Phase B)
// Serverseitig, keine Secrets im Frontend/Log/Repo.
// Aktionen:
//   selftest    – ausschliesslich Vertragstest (dry_run), keine Datenaenderung
//   com_dump    – Diagnose des COM-Live-Datensatzes
//   snapshot    – COM-Live-Snapshot aller 11 Felder, Diff, Freeze, Rollback-Paket
//   dryrun      – Dry-Run aller UPDATE/CREATE-Felder
//   publish     – Live-Push feldweise mit Read-back (nur nach ausdruecklicher Freigabe)
//   rollback    – exakte Wiederherstellung der vorherigen COM-Werte
//   render_check– prueft, ob die oeffentliche COM-Produktseite die neuen Werte rendert
//   status      – Dashboard-Status
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const COM_SUPABASE_URL = "https://dxbrovbbwrtdsimdnrpy.supabase.co";
// Publishable COM key used by alix-lasers.com itself. This is intentionally not a
// private credential; writes still require COM_PRODUCT_HUB_WRITE_KEY server-side.
const COM_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4YnJvdmJid3J0ZHNpbWRucnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTQwMjEsImV4cCI6MjA5MjQ5MDAyMX0.z85uwvZravQhPi7qx9pRdjDY6C0JSKMdaKCNp5Poeo4";
// WICHTIG: www-Host direkt ansprechen. alix-lasers.com antwortet mit 307 auf www,
// dabei geht der x-api-key-Header verloren -> COM meldet faelschlich UNAUTHORIZED.
const COM_WRITE = "https://www.alix-lasers.com/api/public/product-hub/update";
// STRIKT: nur diese COM-Produkt-ID. Keine Fuzzy-Zuordnung (Fusion Red / Hybrid Red /
// BlueIce / BlueIce 2 Max KI sind eigenstaendige Produkte).
const COM_BLUEICE_ID = "c9f9b7c9-d6b7-4ed6-ac60-913cbdec2dd6";
const MASTER_SLUG = "alix-blueice-smart-ki";
const UA = "Mozilla/5.0 (compatible; AlixWorkProductHub/1.0)";

// Master-Spalte -> COM-Zielfeld (Spalte der COM-Tabelle `devices` bzw. Key im
// JSONB-Container `product_hub`). Es wird nichts geraten: was auf COM keine
// eigene Spalte hat, wird im dafuer vorgesehenen product_hub-Container gefuehrt.
const PH = "product_hub";
const FIELD_MAP: Record<string, string> = {
  name: "model_name",
  model: `${PH}.model`,
  wavelengths: "wavelengths",
  power: `${PH}.power`,
  cooling: "cooling",
  fluence: `${PH}.fluence`,
  pulse_duration: `${PH}.pulse_duration`,
  frequency: `${PH}.frequency`,
  spot_sizes: `${PH}.spot_sizes`,
  laser_class: `${PH}.laser_class`,
  intended_use: `${PH}.intended_use`,
};
const FIELDS = Object.keys(FIELD_MAP);

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["model_name", "product_name", "name", "title"],
  model: ["model", "modell"],
  wavelengths: ["wavelengths", "wavelengths_nm", "wellenlaengen", "wellenlängen"],
  power: ["power", "power_watt", "power_w", "impulse_power", "leistung"],
  cooling: ["cooling", "kuehlung", "kühlung"],
  fluence: ["fluence", "fluenz"],
  pulse_duration: ["pulse_duration", "pulsdauer"],
  frequency: ["frequency", "frequenz"],
  spot_sizes: ["spot_sizes", "spot_size", "spotgroesse", "spotgröße"],
  laser_class: ["laser_class", "laserklasse"],
  intended_use: ["intended_use", "zweckbestimmung"],
};
// Zielfeld existiert immer: entweder als COM-Spalte oder im product_hub-Container.
const targetExists = (raw: any, field: string) => {
  const t = FIELD_MAP[field];
  if (t.startsWith(`${PH}.`)) return !!raw && typeof raw === "object" && PH in raw;
  return !!raw && typeof raw === "object" && Object.keys(raw).some((k) => fieldKeys(field).includes(k));
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

function fieldKeys(field: string) {
  return [...new Set([...(FIELD_ALIASES[field] || [field]), FIELD_MAP[field] || field])];
}

// Tiefensuche – COM legt Werte teils flach, teils unter product_hub/specs ab.
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
function deepHas(raw: any, keys: string[], depth = 0): boolean {
  if (!raw || typeof raw !== "object" || depth > 4) return false;
  for (const k of keys) if (k in raw) return true;
  for (const v of Object.values(raw)) if (v && typeof v === "object" && deepHas(v, keys, depth + 1)) return true;
  return false;
}
// Legacy-Freitext wird NICHT interpretiert oder normalisiert – 1:1 uebernommen.
const liveValue = (raw: any, field: string) => (raw ? deepFind(raw, fieldKeys(field)) : null);

function collectProducts(body: any): any[] {
  if (Array.isArray(body)) return body;
  const direct = body?.products || body?.devices || body?.data || body?.items || body?.results || body?.rows;
  if (Array.isArray(direct)) return direct;
  const out: any[] = [];
  const walk = (v: any, d = 0) => {
    if (!v || typeof v !== "object" || d > 4 || out.length) return;
    if (Array.isArray(v)) {
      if (v.some((x) => x && typeof x === "object" && ("id" in x || "product_id" in x || "slug" in x || "name" in x || "product_name" in x))) out.push(...v);
      return;
    }
    for (const val of Object.values(v)) walk(val, d + 1);
  };
  walk(body);
  if (out.length) return out;
  if (body?.product) return [body.product];
  return [];
}

const idOf = (p: any) => String(p?.id ?? p?.product_id ?? p?.device_id ?? p?.alix_product_id ?? "");

async function fetchComExport() {
  const url = `${COM_SUPABASE_URL}/rest/v1/devices?select=*&id=eq.${encodeURIComponent(COM_BLUEICE_ID)}`;
  const res = await fetch(url, {
    headers: {
      apikey: COM_PUBLISHABLE_KEY,
      Authorization: `Bearer ${COM_PUBLISHABLE_KEY}`,
      Accept: "application/json",
      "User-Agent": UA,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`COM Datenquelle ${res.status}: ${text.slice(0, 200)}`);
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error(`COM Datenquelle lieferte kein JSON: ${text.slice(0, 200)}`); }
  return { body, list: collectProducts(body) };
}

// STRIKTE ID-Zuordnung – niemals ueber Namen matchen.
async function fetchComProduct(comId = COM_BLUEICE_ID) {
  const { list } = await fetchComExport();
  const hit = list.find((p) => idOf(p) === comId);
  if (!hit) throw new Error(`COM-Produkt ${comId} nicht im Export gefunden (${list.length} Datensaetze) – keine Fuzzy-Zuordnung erlaubt`);
  return { product: hit, payloadHash: await sha256(JSON.stringify(hit)) };
}

// COM akzeptiert den Schreib-Schluessel je nach Deployment unter
// verschiedenen Header-Namen. Wir probieren die gaengigen Varianten und
// merken uns die erste, die kein 401 liefert.
type AuthVariant = { label: string; headers: Record<string, string> };
const authVariants = (key: string): AuthVariant[] => [
  { label: "x-api-key", headers: { "x-api-key": key } },
  { label: "authorization-bearer", headers: { authorization: `Bearer ${key}` } },
  { label: "x-write-key", headers: { "x-write-key": key } },
  { label: "x-api-key+bearer", headers: { "x-api-key": key, authorization: `Bearer ${key}` } },
];
let acceptedAuth: AuthVariant | null = null;

async function writeCall(body: Record<string, unknown>, dryRun = true) {
  const key = Deno.env.get("COM_PRODUCT_HUB_WRITE_KEY") || "";
  if (!key) return { status: 0, body: { error: "COM_PRODUCT_HUB_WRITE_KEY fehlt" } as any, ok: false, auth: "none" };
  const payload = JSON.stringify({ publish_id: `alixwork-${Date.now()}`, target: "product_hub", ...body, dry_run: dryRun });
  const variants = acceptedAuth ? [acceptedAuth] : authVariants(key);

  let last: { status: number; body: any; ok: boolean; auth: string } | null = null;
  for (const v of variants) {
    const res = await fetch(COM_WRITE, {
      method: "PATCH",
      headers: { ...v.headers, "Content-Type": "application/json", "User-Agent": UA },
      body: payload,
    });
    const raw = await res.text();
    let parsed: any = raw;
    try { parsed = JSON.parse(raw); } catch { /* text */ }
    last = { status: res.status, body: parsed, ok: res.ok, auth: v.label };
    if (res.status !== 401 && res.status !== 403) { acceptedAuth = v; break; }
  }
  return last!;
}


// COM fuehrt alle Canary-Felder als Text (Spalte `wavelengths` ist Freitext,
// product_hub-Keys ebenfalls) – daher keine Typumdeutung, 1:1 als Text.
function comValue(_comField: string, v: unknown): unknown {
  return asText(v);
}

function normCompare(field: string, a: unknown, b: unknown): boolean {
  const ta = asText(a), tb = asText(b);
  if (ta === null && tb === null) return true;
  if (ta === null || tb === null) return false;
  if (field === "wavelengths") {
    const na = (ta.match(/\d+/g) || []).map(Number).sort((x, y) => x - y).join(",");
    const nb = (tb.match(/\d+/g) || []).map(Number).sort((x, y) => x - y).join(",");
    return na === nb && na !== "";
  }
  const clean = (s: string) => s.toLowerCase().replace(/[−–—]/g, "-").replace(/\s+/g, " ").replace(/[.,;]+$/g, "").trim();
  return clean(ta) === clean(tb);
}

const codeOf = (b: any) => String(b?.code || b?.error_code || b?.error || "").toUpperCase();
// Klarer Hinweis statt HTML-Dump, wenn die COM-Seite gar keinen Write-Endpunkt hat.
const writeDetail = (r: { status: number; body: any }) => {
  if (r.status === 0) return "COM_PRODUCT_HUB_WRITE_KEY fehlt";
  if (typeof r.body === "string" && r.body.trim().startsWith("<"))
    return `COM-Write-Endpunkt existiert nicht (HTTP ${r.status}, HTML statt JSON) – auf alix-lasers.com muss /api/public/product-hub/update bereitgestellt werden`;
  const c = codeOf(r.body);
  if (r.status === 401 || r.status === 403 || c === "UNAUTHORIZED")
    return `COM lehnt den Schreib-Schluessel ab (HTTP ${r.status}) – alle Header-Varianten (x-api-key, Authorization: Bearer, x-write-key) wurden abgelehnt. Der Wert von COM_PRODUCT_HUB_WRITE_KEY stimmt nicht mit dem auf alix-lasers.com hinterlegten Schreib-Schluessel ueberein.`;

  return c || (typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 200) : String(r.body).slice(0, 200));
};
const isHtmlResponse = (r: { body: any }) =>
  typeof r.body === "string" && /^\s*<!doctype html|^\s*<html/i.test(r.body);
const writeEndpointReached = (r: { status: number; body: any }) =>
  r.status > 0 && !isHtmlResponse(r);

// COM akzeptiert nur eine feste Allowlist von Zielfeldern. Welche Namen das sind,
// wird nicht geraten, sondern per Dry-Run-Probe ermittelt und persistiert.
const fieldCandidates = (field: string): string[] => {
  const aliases = [...new Set([...(FIELD_ALIASES[field] || [field]), field])];
  const out: string[] = [];
  for (const a of aliases) out.push(a);
  for (const a of aliases) out.push(`${PH}.${a}`, `specs.${a}`, `tech_specs.${a}`);
  const mapped = FIELD_MAP[field];
  return [...new Set([mapped, ...out].filter(Boolean))];
};
const FIELD_NOT_ALLOWED = (r: { status: number; body: any }) =>
  r.status === 400 && codeOf(r.body).includes("FIELD_NOT_ALLOWED");



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: userRes } = await admin.auth.getUser(jwt);
  const user = userRes?.user;
  if (!user) return json(401, { error: "unauthorized" });
  const { data: roleRows } = await admin.from("user_roles").select("roles(name)").eq("user_id", user.id);
  const roles = (roleRows || []).map((r: any) => String(r.roles?.name || ""));
  if (!roles.some((r) => ["Super Admin", "Admin"].includes(r))) return json(403, { error: "forbidden", detail: "Nur Admin / Super Admin" });

  let payload: any = {};
  try { payload = await req.json(); } catch { /* empty */ }
  const action = payload.action || "status";

  const loadMaster = async () => {
    const { data } = await admin.from("ph_products").select("*").eq("slug", MASTER_SLUG).maybeSingle();
    if (!data) throw new Error("Master-Produkt Alix BlueIce Smart KI nicht gefunden");
    return data as any;
  };

  // Ermittelte COM-Zielfelder (aus der Feld-Probe) ueber die statische Karte legen.
  const resolveFieldMap = async (): Promise<Record<string, string | null>> => {
    const { data } = await admin.from("ph_settings").select("value").eq("key", "canary_com_field_map").maybeSingle();
    const learned = ((data?.value as any)?.map || {}) as Record<string, string | null>;
    const out: Record<string, string | null> = { ...FIELD_MAP };
    for (const f of FIELDS) if (f in learned) out[f] = learned[f];
    return out;
  };

  try {
    // ------------------------------------------------------------ Feld-Probe
    if (action === "field_probe") {
      const probe: any[] = [];
      const map: Record<string, string | null> = {};
      const { product } = await fetchComProduct();
      for (const f of FIELDS) {
        const live = liveValue(product, f);
        let hit: string | null = null;
        const tried: any[] = [];
        for (const cand of fieldCandidates(f)) {
          const r = await writeCall({
            product_id: COM_BLUEICE_ID,
            field: cand,
            value: live ?? "PROBE",
            expected_previous_value: live,
          });
          tried.push({ field: cand, status: r.status, code: codeOf(r.body) });
          if (r.status === 401 || r.status === 403) {
            return json(200, { field_probe: "BLOCKED", detail: writeDetail(r) });
          }
          if (!FIELD_NOT_ALLOWED(r) && (r.ok || r.status === 409)) { hit = cand; break; }
        }
        map[f] = hit;
        probe.push({ field: f, com_field: hit, accepted: !!hit, tried });
      }
      const accepted = FIELDS.filter((f) => map[f]);
      const rejected = FIELDS.filter((f) => !map[f]);
      await admin.from("ph_settings").upsert(
        { key: "canary_com_field_map", value: { map, probe, accepted, rejected, checked_at: new Date().toISOString() }, updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: "key" },
      );
      return json(200, {
        field_probe: rejected.length ? "PARTIAL" : "COMPLETE",
        accepted, rejected, map, probe,
        summary: rejected.length
          ? `${accepted.length}/${FIELDS.length} Felder von COM akzeptiert · COM erlaubt (noch) nicht: ${rejected.join(", ")}`
          : `Alle ${FIELDS.length} Felder von COM akzeptiert`,
      });
    }

    // ---------------------------------------------------------------- Diagnose

    if (action === "com_dump") {
      const { product } = await fetchComProduct();
      const master = await loadMaster().catch(() => null);
      const resolved: Record<string, string | null> = {};
      const mapping: any[] = [];
      const empty: string[] = [], missing: string[] = [];
      for (const f of FIELDS) {
        const v = liveValue(product, f);
        resolved[f] = v;
        const hasTarget = targetExists(product, f);
        if (!hasTarget) missing.push(f);
        else if (!v) empty.push(f);
        mapping.push({
          field: f,
          com_target: FIELD_MAP[f],
          target_exists: hasTarget,
          live_value: v,
          master_value: master ? asText((master as any)[f]) : null,
          plan: !hasTarget ? "NO_TARGET" : v ? "UPDATE_OR_NO_CHANGE" : "CREATE",
        });
      }
      return json(200, {
        com_product_id: COM_BLUEICE_ID,
        raw: product,
        resolved,
        mapping,
        empty,
        missing,
        summary: missing.length
          ? `Mapping unvollstaendig: ${missing.join(", ")}`
          : `Mapping vollstaendig · ${empty.length} Felder werden auf COM neu angelegt (CREATE): ${empty.join(", ") || "keine"}`,
      });
    }

    // -------------------------------------------------------------- Selftest
    if (action === "selftest") {
      const tests: any[] = [];
      const { list } = await fetchComExport();
      const before = await fetchComProduct();
      const liveName = liveValue(before.product, "name");

      const exportOk = list.length > 0;
      tests.push({ name: "Export Auth OK", pass: exportOk, status: 200, detail: `${list.length} COM-Datensaetze` });

      const t1 = await writeCall({ product_id: COM_BLUEICE_ID, field: "product_name", value: liveName, expected_previous_value: liveName });
       const endpointReached = writeEndpointReached(t1);
       const endpointBlocker = endpointReached ? "" : writeDetail(t1);
       tests.push({ name: "COM-Schreib-Endpunkt erreichbar", pass: endpointReached, status: t1.status, detail: endpointReached ? "JSON-Antwort vom COM-Write-Service" : endpointBlocker });
       tests.push({ name: "Write Auth OK", pass: endpointReached && t1.status !== 401 && t1.status !== 403, status: t1.status, detail: endpointReached ? (codeOf(t1.body) || `HTTP ${t1.status}`) : endpointBlocker });
       tests.push({ name: "BlueIce-ID akzeptiert (strikt)", pass: endpointReached && t1.ok, status: t1.status, detail: writeDetail(t1) });

      // falsches Geraet: erstes anderes COM-Produkt
      const other = list.map(idOf).find((id) => id && id !== COM_BLUEICE_ID) || "00000000-0000-0000-0000-000000000001";
      const t2 = await writeCall({ product_id: other, field: "product_name", value: "X", expected_previous_value: null });
       tests.push({ name: "Falsches Geraet abgewiesen (Scope)", pass: writeEndpointReached(t2) && !t2.ok && [400, 403, 404, 409].includes(t2.status), status: t2.status, detail: writeDetail(t2) });

      const t3 = await writeCall({ product_id: "00000000-0000-0000-0000-000000000000", field: "product_name", value: "X", expected_previous_value: null });
       tests.push({ name: "Unbekanntes Geraet abgewiesen", pass: writeEndpointReached(t3) && !t3.ok && [400, 403, 404].includes(t3.status), status: t3.status, detail: writeDetail(t3) });

      const t4 = await writeCall({ product_id: COM_BLUEICE_ID, field: "price", value: "1", expected_previous_value: null });
       tests.push({ name: "Verbotenes Feld abgewiesen", pass: writeEndpointReached(t4) && !t4.ok && [400, 403, 422].includes(t4.status), status: t4.status, detail: writeDetail(t4) });

      const t5 = await writeCall({ product_id: COM_BLUEICE_ID, field: "product_name", value: liveName, expected_previous_value: "__ABSICHTLICH_FALSCH__" });
       tests.push({ name: "Optimistic Lock (409 CONFLICT)", pass: writeEndpointReached(t5) && (t5.status === 409 || codeOf(t5.body).includes("CONFLICT")), status: t5.status, detail: writeDetail(t5) });

       tests.push({ name: "Dry Run funktioniert", pass: endpointReached && t1.ok, status: t1.status, detail: endpointReached ? String((t1.body as any)?.dry_run ?? (t1.body as any)?.status ?? "") : endpointBlocker });

      const after = await fetchComProduct();
      tests.push({ name: "Keine Datenaenderung", pass: after.payloadHash === before.payloadHash, status: 200, detail: after.payloadHash.slice(0, 12) });

      const allPass = tests.every((t) => t.pass);
      await admin.from("ph_settings").upsert(
        { key: "canary_com_write", value: { state: allPass ? "READY" : "NOT READY", tests, checked_at: new Date().toISOString() }, updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: "key" },
      );
       return json(200, { com_write: allPass ? "COM WRITE READY" : "NOT READY", ready: allPass, blocker: endpointReached ? null : endpointBlocker, tests });
    }

    // -------------------------------------------------------------- Snapshot
    if (action === "snapshot") {
      const master = await loadMaster();
      const { product: live, payloadHash } = await fetchComProduct();

      const batchPayload = FIELDS.map((f) => [f, asText((master as any)[f])]);
      const masterHash = await sha256(JSON.stringify(batchPayload));

      const { data: batch, error: be } = await admin.from("ph_canary_batches").insert({
        product_id: master.id,
        alix_product_id: COM_BLUEICE_ID,
        channel_code: "com",
        status: "FROZEN",
        snapshot_at: new Date().toISOString(),
        frozen_at: new Date().toISOString(),
        master_hash: masterHash,
        created_by: user.id,
        checks: { snapshot: "FROZEN", source: "COM_LIVE", export_hash: payloadHash },
        notes: "BlueIce COM Canary – eigener COM-Snapshot, keine DE-Werte verwendet",
      }).select("*").single();
      if (be) throw be;

      const capturedAt = new Date().toISOString();
      const snapshots: any[] = [];
      const diffs: any[] = [];
      let order = 1;

      for (const field of FIELDS) {
        const comField = FIELD_MAP[field];
        const current = liveValue(live, field);              // Legacy-Freitext 1:1
        const target = asText((master as any)[field]);
        let diff: "NO_CHANGE" | "UPDATE" | "CREATE" | "CONFLICT";
        if (target === null && current === null) diff = "NO_CHANGE";
        else if (target === null) diff = "CONFLICT";          // Master leer, COM hat Wert
        else if (current === null) diff = "CREATE";
        else diff = normCompare(field, current, target) ? "NO_CHANGE" : "UPDATE";

        diffs.push({ field, com_field: comField, current_live_value: current, target_master_value: target, diff });

        let queueId: string | null = null;
        if (diff === "UPDATE" || diff === "CREATE") {
          const { data: q, error: qe } = await admin.from("ph_publish_queue").insert({
            product_id: master.id,
            channel_code: "com",
            field_key: field,
            old_value: current,
            new_value: target,
            expected_previous_value: current,
            status: "DRAFT",
            verify_status: "PENDING",
            batch_id: batch.id,
            rollback_order: order,
            requested_by: user.id,
            notes: `COM Canary-Snapshot ${batch.id} · ${diff}`,
          }).select("id").single();
          if (qe) throw qe;
          queueId = q.id;
        }

        snapshots.push({
          batch_id: batch.id,
          product_id: master.id,
          alix_product_id: COM_BLUEICE_ID,
          channel_code: "com",
          field,
          current_live_value: current,
          value_state: diff,
          target_master_value: target,
          source: "COM_LIVE",
          source_hash: await sha256(`${payloadHash}:${comField}:${current ?? ""}`),
          publish_id: queueId,
          rollback_order: order++,
          captured_at: capturedAt,
        });
      }

      const { error: se } = await admin.from("ph_canary_snapshots").insert(snapshots);
      if (se) throw se;

      // Rollback-Paket (umgekehrte Schreibreihenfolge), exakter vorheriger COM-Wert
      const rollbacks = snapshots
        .filter((s) => s.publish_id)
        .slice().sort((a, b) => b.rollback_order - a.rollback_order)
        .map((s) => ({
          queue_id: s.publish_id, product_id: master.id, channel_code: "com",
          field_key: s.field, previous_value: s.current_live_value, restored_value: null,
          action: "PREPARED", performed_by: user.id,
        }));
      if (rollbacks.length) {
        const { data: rbRows, error: re } = await admin.from("ph_publish_rollbacks").insert(rollbacks).select("id, queue_id");
        if (re) throw re;
        for (const rb of rbRows || []) await admin.from("ph_publish_queue").update({ rollback_publish_id: rb.id }).eq("id", rb.queue_id);
      }

      const changes = diffs.filter((d) => d.diff === "UPDATE" || d.diff === "CREATE").length;
      await admin.from("ph_canary_batches").update({
        checks: { ...batch.checks, rollback: rollbacks.length ? "READY" : "NOT_REQUIRED", fields: snapshots.length, changes, diffs },
        updated_at: new Date().toISOString(),
      }).eq("id", batch.id);

      return json(200, { batch_id: batch.id, snapshot: "COM CANARY SNAPSHOT FROZEN", fields: snapshots.length, changes, rollback: rollbacks.length ? "READY" : "NOT_REQUIRED", diffs });
    }

    // --------------------------------------------------------------- Dry Run
    if (action === "dryrun") {
      const batchId = payload.batch_id;
      if (!batchId) return json(400, { error: "batch_id fehlt" });
      const { data: batch } = await admin.from("ph_canary_batches").select("*").eq("id", batchId).eq("channel_code", "com").maybeSingle();
      if (!batch) return json(404, { error: "COM-Batch nicht gefunden" });
      const { data: snaps } = await admin.from("ph_canary_snapshots").select("*").eq("batch_id", batchId).order("rollback_order");

      const results: any[] = [];
      for (const s of snaps || []) {
        if (s.value_state === "NO_CHANGE" || s.value_state === "CONFLICT") {
          results.push({ field: s.field, result: s.value_state === "CONFLICT" ? "CONFLICT" : "SKIP", pass: s.value_state === "NO_CHANGE" });
          continue;
        }
        const r = await writeCall({
          product_id: COM_BLUEICE_ID,
          field: FIELD_MAP[s.field] || s.field,
          value: comValue(FIELD_MAP[s.field] || s.field, s.target_master_value),
          expected_previous_value: s.current_live_value,
          publish_id: `${batchId}:${s.field}`,
          idempotency_key: `${batchId}:${s.field}`,
        });
        results.push({ field: s.field, result: r.ok ? "WRITE_READY" : "FAILED", status: r.status, pass: r.ok, code: codeOf(r.body) });
      }
      const passed = results.length > 0 && results.every((r) => r.pass);
      await admin.from("ph_canary_batches").update({
        checks: { ...(batch.checks || {}), dry_run: passed ? "PASSED" : "FAILED", dry_run_results: results, dry_run_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", batchId);
      return json(200, { dry_run: passed ? "PASSED" : "FAILED", results });
    }

    // ---------------------------------------------------------- Live-Publish
    if (action === "publish") {
      const batchId = payload.batch_id;
      if (!batchId) return json(400, { error: "batch_id fehlt" });
      if (payload.confirm !== "COM CANARY GO") return json(400, { error: "Ausdrueckliche Freigabe fehlt (confirm)" });

      const { data: batch } = await admin.from("ph_canary_batches").select("*").eq("id", batchId).eq("channel_code", "com").maybeSingle();
      if (!batch) return json(404, { error: "COM-Batch nicht gefunden" });
      if (batch.alix_product_id !== COM_BLUEICE_ID) return json(403, { error: "Nur BlueIce Smart KI (COM) erlaubt" });
      if ((batch.checks || {}).dry_run !== "PASSED") return json(400, { error: "Dry-Run nicht bestanden – Abbruch" });
      const { data: wr } = await admin.from("ph_settings").select("value").eq("key", "canary_com_write").maybeSingle();
      if ((wr?.value as any)?.state !== "READY") return json(400, { error: "COM Write nicht READY – Abbruch" });

      const { data: snaps } = await admin.from("ph_canary_snapshots").select("*").eq("batch_id", batchId).order("rollback_order");
      const results: any[] = [];
      let written = 0, skipped = 0, verified = 0, failed = 0;
      let stopped: string | null = null;

      for (const s of snaps || []) {
        if (s.value_state === "NO_CHANGE" || s.value_state === "CONFLICT") {
          skipped++;
          results.push({ field: s.field, action: "SKIP", reason: s.value_state, live_value: s.current_live_value });
          if (s.publish_id) await admin.from("ph_publish_queue").update({ status: "SKIPPED", verify_status: "VERIFIED", verified_at: new Date().toISOString(), notes: s.value_state }).eq("id", s.publish_id);
          continue;
        }
        const comField = FIELD_MAP[s.field] || s.field;
        const w = await writeCall({
          product_id: COM_BLUEICE_ID,
          field: comField,
          value: comValue(comField, s.target_master_value),
          expected_previous_value: s.current_live_value,
          publish_id: `${batchId}:${s.field}`,
          idempotency_key: `${batchId}:${s.field}`,
        }, false);

        if (!w.ok) {
          failed++;
          stopped = `${s.field}: HTTP ${w.status} ${codeOf(w.body)}`;
          results.push({ field: s.field, action: "WRITE", status: w.status, error: stopped, verified: false });
          if (s.publish_id) await admin.from("ph_publish_queue").update({ status: "FAILED", verify_status: "FAILED", notes: stopped }).eq("id", s.publish_id);
          break;
        }
        written++;

        let readback: string | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const fresh = await fetchComProduct();
            readback = liveValue(fresh.product, s.field);
            stopped = null;
          } catch (e) {
            readback = null;
            stopped = `${s.field}: Read-back fehlgeschlagen (${(e as Error).message})`;
          }
          if (!stopped && normCompare(s.field, readback, s.target_master_value)) break;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }

        const ok = !stopped && normCompare(s.field, readback, s.target_master_value);
        await admin.from("ph_canary_snapshots").update({ readback_value: readback, readback_at: new Date().toISOString() }).eq("id", s.id);
        if (ok) {
          verified++;
          results.push({ field: s.field, action: "WRITE", status: w.status, previous_value: s.current_live_value, new_value: asText(s.target_master_value), readback, verified: true });
          if (s.publish_id) await admin.from("ph_publish_queue").update({ status: "PUBLISHED", verify_status: "VERIFIED", verified_at: new Date().toISOString(), notes: "Live geschrieben und zurueckgelesen" }).eq("id", s.publish_id);
        } else {
          failed++;
          stopped = stopped || `${s.field}: Read-back weicht ab (live="${readback}", soll="${s.target_master_value}")`;
          results.push({ field: s.field, action: "WRITE", status: w.status, readback, verified: false, error: stopped });
          if (s.publish_id) await admin.from("ph_publish_queue").update({ status: "PUBLISHED", verify_status: "MISMATCH", notes: stopped }).eq("id", s.publish_id);
          break; // SOFORT STOPP
        }
      }

      const allDone = !stopped && failed === 0 && (snaps || []).length === results.length;

      let compare: any = null;
      if (allDone) {
        const fresh = await fetchComProduct();
        const diffs: any[] = [];
        for (const s of snaps || []) {
          const live = liveValue(fresh.product, s.field);
          if (s.value_state === "CONFLICT") continue;
          if (!normCompare(s.field, live, s.target_master_value)) diffs.push({ field: s.field, live, master: s.target_master_value });
        }
        compare = { match: diffs.length === 0, diffs, export_hash: fresh.payloadHash, compared_at: new Date().toISOString() };
      }

      await admin.from("ph_canary_batches").update({
        status: allDone ? "PUBLISHED" : "FAILED",
        published_at: allDone ? new Date().toISOString() : null,
        checks: { ...(batch.checks || {}), publish: allDone ? "SUCCESS" : "PARTIAL_FAILURE", attempted: results.length, written, skipped, verified, failed, stopped_at: stopped, results, compare },
        updated_at: new Date().toISOString(),
      }).eq("id", batchId);

      await admin.from("ph_sync_log").insert({
        channel_code: "com", direction: "outbound", operation: "canary_publish",
        status: allDone ? "success" : "error",
        message: allDone ? `BlueIce COM Canary: ${written} geschrieben, ${skipped} uebersprungen, Read-back ${verified}` : `BlueIce COM Canary GESTOPPT: ${stopped}`,
      });

      return json(200, { publish: allDone ? "SUCCESS" : "PARTIAL_FAILURE", written, skipped, verified, failed, stopped_at: stopped, results, compare, rollback_available: written > 0 });
    }

    // --------------------------------------------------------------- Rollback
    if (action === "rollback") {
      const batchId = payload.batch_id;
      if (!batchId) return json(400, { error: "batch_id fehlt" });
      const { data: snaps } = await admin.from("ph_canary_snapshots").select("*").eq("batch_id", batchId).order("rollback_order", { ascending: false });
      const results: any[] = [];
      for (const s of snaps || []) {
        if (!s.publish_id || !s.readback_at) continue;
        const comField = FIELD_MAP[s.field] || s.field;
        const w = await writeCall({
          product_id: COM_BLUEICE_ID, field: comField,
          value: comValue(comField, s.current_live_value),   // exakter vorheriger Wert, auch Freitext
          publish_id: `${batchId}:rollback:${s.field}`,
        }, false);
        results.push({ field: s.field, restored_to: s.current_live_value, status: w.status, ok: w.ok });
        await admin.from("ph_publish_rollbacks").update({ action: "EXECUTED", restored_value: s.current_live_value, performed_by: user.id }).eq("queue_id", s.publish_id);
        await admin.from("ph_publish_queue").update({ status: "ROLLED_BACK", verify_status: "PENDING", notes: "Rollback auf COM-Snapshot-Wert" }).eq("id", s.publish_id);
      }
      await admin.from("ph_canary_batches").update({ status: "ROLLED_BACK", updated_at: new Date().toISOString() }).eq("id", batchId);
      return json(200, { rollback: "EXECUTED", results });
    }

    // -------------------------------------------------- Website-Rendering
    if (action === "render_check") {
      const master = await loadMaster();
      const url: string = payload.url || `https://alix-lasers.com/produkte/${MASTER_SLUG}`;
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const html = (await res.text()).replace(/\s+/g, " ");
      const probeFields = ["power", "fluence", "pulse_duration", "frequency", "cooling", "spot_sizes"];
      const found: string[] = [], missing: string[] = [];
      for (const f of probeFields) {
        const v = asText((master as any)[f]);
        if (!v) continue;
        const num = (v.match(/\d+/g) || [])[0];
        (html.toLowerCase().includes(v.toLowerCase()) || (num && html.includes(num)) ? found : missing).push(f);
      }
      const state = res.ok && found.length > 0 && missing.length === 0
        ? "COM WEBSITE RENDER OK"
        : res.ok ? "COM WEBSITE RENDER NOT MIGRATED" : `HTTP ${res.status}`;
      await admin.from("ph_settings").upsert(
        { key: "canary_com_render", value: { state, url, found, missing, checked_at: new Date().toISOString() }, updated_at: new Date().toISOString(), updated_by: user.id },
        { onConflict: "key" },
      );
      return json(200, { render: state, url, http: res.status, found, missing });
    }

    // ---------------------------------------------------------------- Status
    if (action === "status") {
      const master = await loadMaster();
      const [{ data: wr }, { data: rd }, { data: batch }, { data: phase }] = await Promise.all([
        admin.from("ph_settings").select("value").eq("key", "canary_com_write").maybeSingle(),
        admin.from("ph_settings").select("value").eq("key", "canary_com_render").maybeSingle(),
        admin.from("ph_canary_batches").select("*").eq("product_id", master.id).eq("channel_code", "com").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("ph_settings").select("value").eq("key", "migration_phase").maybeSingle(),
      ]);
      const { data: snaps } = batch
        ? await admin.from("ph_canary_snapshots").select("*").eq("batch_id", batch.id).order("rollback_order")
        : { data: [] as any[] };
      return json(200, {
        com_product_id: COM_BLUEICE_ID,
        master: { id: master.id, name: master.name },
        com_write: (wr?.value as any)?.state ?? "UNKNOWN",
        tests: (wr?.value as any)?.tests ?? [],
        render: (rd?.value as any)?.state ?? "UNKNOWN",
        batch, snapshots: snaps || [],
        phase: (phase?.value as any)?.phase ?? "B",
      });
    }

    return json(400, { error: "unbekannte Aktion" });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
