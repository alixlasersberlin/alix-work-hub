// AlixSmart Deep-Sync Poller
// Polls AlixSmart API for users, devices, registrations and events.
// Uses cursor (updated_since) per entity, tracks runs, updates alixsmart_customer_links / _device_links.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_BASE = (Deno.env.get("ALIXSMART_API_BASE_URL") ?? "").replace(/\/$/, "");
const API_KEY = Deno.env.get("ALIXSMART_API_KEY") ?? "";
const EXPORT_KEY = Deno.env.get("ALIXSMART_EXPORT_KEY") ?? "";
const EXPORT_URL = (Deno.env.get("ALIXSMART_EXPORT_URL") ?? "").replace(/\/$/, "");

const ENTITIES = ["users", "devices", "registrations", "events"] as const;
type Entity = typeof ENTITIES[number];

// AlixSmart stellt genau eine Export-Funktion bereit:
//   <base>/alixsmart-export-readonly?action=export&table=<tabelle>&limit=100&offset=0
// Header: x-alix-export-key
const TABLE_MAP: Record<Entity, string> = {
  users: "profiles",
  devices: "devices",
  registrations: "academy_bookings",
  events: "academy_sessions",
};

// Optional override: ALIXSMART_API_PATHS = {"devices":"/alixsmart-export-readonly?action=export&table=devices", ...}
let PATH_OVERRIDES: Partial<Record<Entity, string>> = {};
try { PATH_OVERRIDES = JSON.parse(Deno.env.get("ALIXSMART_API_PATHS") ?? "{}"); } catch { /* ignore */ }

function exportBase(): string {
  return EXPORT_URL || `${API_BASE}/alixsmart-export-readonly`;
}

function exportHeaders(): Record<string, string> {
  return {
    "x-alix-export-key": EXPORT_KEY || API_KEY,
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
  };
}

function entityUrl(entity: Entity, limit: number, offset: number): URL {
  const override = PATH_OVERRIDES[entity];
  const url = override
    ? new URL(API_BASE + override)
    : new URL(exportBase());
  if (!override) {
    url.searchParams.set("action", "export");
    url.searchParams.set("table", TABLE_MAP[entity]);
  }
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return url;
}

function extractItems(payload: any): any[] {
  const raw: any[] = Array.isArray(payload)
    ? payload
    : (payload?.rows ?? payload?.items ?? payload?.data ?? payload?.records ?? []);
  // Export-Format: { rows: [{ source_id, source_table, updated_at, payload: {...} }] }
  return raw.map((r: any) => (r && typeof r === "object" && r.payload && typeof r.payload === "object"
    ? { ...r.payload, updated_at: r.updated_at ?? r.payload.updated_at }
    : r));
}

/** Ruft die Export-Funktion seitenweise ab (limit max. 100) und filtert lokal nach `since`. */
async function fetchAllItems(entity: Entity, since: string | null): Promise<any[]> {
  const limit = 100;
  const maxPages = 50;
  const all: any[] = [];
  for (let page = 0; page < maxPages; page++) {
    const url = entityUrl(entity, limit, page * limit);
    const res = await fetch(url.toString(), { method: "GET", headers: exportHeaders() });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `AlixSmart ${entity} (${TABLE_MAP[entity]}) ${res.status}: ${text.slice(0, 300)} — Endpunkt: ${url.pathname}${url.search}`,
      );
    }
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`Ungültiges JSON von ${entity}`); }
    const items = extractItems(json);
    all.push(...items);
    if (items.length < limit) break;
  }
  if (!since) return all;
  return all.filter((i) => {
    const at = i.updated_at ?? i.created_at ?? i.event_at;
    return !at || String(at) > since;
  });
}



async function runEntity(supabase: any, entity: Entity, trigger: string, full = false) {
  const { data: state } = await supabase
    .from("alixsmart_sync_state")
    .select("*")
    .eq("entity", entity)
    .maybeSingle();

  const { data: run } = await supabase
    .from("alixsmart_sync_runs")
    .insert({ entity, direction: "pull", trigger, status: "running" })
    .select()
    .single();

  const since = full ? null : (state?.last_synced_at ?? null);
  let processed = 0, created = 0, updated = 0, failed = 0;
  let error: string | null = null;
  let newestAt: string | null = null;

  try {
    const items: any[] = await fetchAllItems(entity, since);
    processed = items.length;

    for (const item of items) {
      try {
        const at = item.updated_at ?? item.created_at ?? item.event_at;
        if (at && (!newestAt || at > newestAt)) newestAt = at;

        if (entity === "users") {
          const email = (item.email ?? "").toLowerCase();
          if (!email) continue;
          const { data: existing } = await supabase
            .from("alixsmart_customer_links")
            .select("id").eq("customer_email", email).maybeSingle();
          const payload = {
            customer_email: email,
            alixsmart_user_id: item.id ?? item.user_id ?? null,
            match_method: "api_sync",
            manually_confirmed: false,
            last_synced_at: new Date().toISOString(),
          };
          if (existing) {
            await supabase.from("alixsmart_customer_links").update(payload).eq("id", existing.id);
            updated++;
          } else {
            await supabase.from("alixsmart_customer_links").insert(payload);
            created++;
          }
        } else if (entity === "devices" || entity === "registrations") {
          const serial = item.serial_number ?? item.serial ?? item.device_serial;
          if (!serial) continue;
          const registered = entity === "registrations" ? true : !!item.registered;
          const { data: existing } = await supabase
            .from("alixsmart_device_links")
            .select("id").eq("serial_number", serial).maybeSingle();
          const payload = {
            serial_number: serial,
            alixsmart_user_id: item.user_id ?? item.alixsmart_user_id ?? null,
            registered_at: registered ? (item.registered_at ?? new Date().toISOString()) : null,
            status: registered ? "registered" : "unregistered",
            last_synced_at: new Date().toISOString(),
          };
          if (existing) {
            await supabase.from("alixsmart_device_links").update(payload).eq("id", existing.id);
            updated++;
          } else {
            await supabase.from("alixsmart_device_links").insert(payload);
            created++;
          }
        } else if (entity === "events") {
          await supabase.from("alixsmart_events").upsert({
            external_id: item.id ?? item.event_id ?? null,
            alixsmart_user_id: item.user_id ?? null,
            device_serial: item.serial_number ?? item.serial ?? null,
            event_type: item.type ?? item.event_type ?? "unknown",
            event_at: item.event_at ?? item.created_at ?? new Date().toISOString(),
            payload: item,
          }, { onConflict: "external_id", ignoreDuplicates: false });
          created++;
        }
      } catch (e) {
        failed++;
        console.error(`[${entity}] item failed:`, (e as Error).message);
      }
    }
  } catch (e) {
    error = (e as Error).message;
  }

  await supabase.from("alixsmart_sync_runs").update({
    status: error ? "failed" : "success",
    items_processed: processed,
    items_created: created,
    items_updated: updated,
    items_failed: failed,
    error,
    finished_at: new Date().toISOString(),
  }).eq("id", run.id);

  await supabase.from("alixsmart_sync_state").upsert({
    entity,
    last_synced_at: error ? (since ?? null) : (newestAt ?? new Date().toISOString()),
    last_status: error ? "failed" : "success",
    last_error: error,
    items_processed: processed,
    updated_at: new Date().toISOString(),
  }, { onConflict: "entity" });

  return { entity, processed, created, updated, failed, error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if ((!API_BASE && !EXPORT_URL) || (!EXPORT_KEY && !API_KEY)) {
    return new Response(JSON.stringify({ error: "ALIXSMART_API_BASE_URL / ALIXSMART_EXPORT_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch {}
  const trigger = body.trigger ?? "manual";
  const action = body.action ?? new URL(req.url).searchParams.get("action");
  if (action === "list_counts" || action === "dry_run" || action === "peek") {
    const url = new URL(exportBase());
    url.searchParams.set("action", action === "peek" ? "export" : action);
    if (action === "peek") { url.searchParams.set("table", body.table ?? "devices"); url.searchParams.set("limit", "1"); }
    const res = await fetch(url.toString(), { headers: exportHeaders() });
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const entities: Entity[] = Array.isArray(body.entities) && body.entities.length
    ? body.entities.filter((e: string) => ENTITIES.includes(e as Entity))
    : [...ENTITIES];

  const results = [];
  for (const e of entities) results.push(await runEntity(supabase, e, trigger, !!body.full));

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
