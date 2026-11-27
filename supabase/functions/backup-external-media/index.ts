// Daily read-only backup of external product files (images/datasheets referenced by ph_* rows).
// Never modifies product references. Stores content-addressed copies in private bucket
// "backups" under external-media/; the nightly Hetzner sync mirrors that bucket automatically.
// Auth: CRON_SECRET or service role only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { ALLOWED_HOSTS, MAX_BYTES, externalHost, groupByUrl, objectKey, type Ref } from "./refs.ts";

const TIME_BUDGET_MS = 100_000;
const Body = z.object({ offset: z.number().int().min(0).max(100000).optional(), run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).passthrough();

const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const hex = async (b: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), (x) => x.toString(16).padStart(2, "0")).join("");

async function fetchAllowed(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, current).toString();
      if (!externalHost(next)) throw new Error(`redirect outside allowlist`);
      current = next; continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cron = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  if (!((cron && auth === `Bearer ${cron}`) || auth === `Bearer ${srk}`)) return json(401, { error: "Unauthorized" });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const offset = parsed.data.offset ?? 0;
  const runDate = parsed.data.run_date ?? new Date().toISOString().slice(0, 10);
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, srk);
  const started = Date.now();

  const refs: Ref[] = [];
  const pull = async (table: string, cols: string[]) => {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(["id", ...cols].join(",")).range(from, from + 999).order("id");
      if (error) throw new Error(`${table}: ${error.message}`);
      for (const r of (data ?? []) as any[]) for (const c of cols) if (r[c]) refs.push({ table, id: r.id, field: c, url: r[c] });
      if (!data || data.length < 1000) break;
    }
  };
  try {
    await pull("ph_media", ["url"]);
    await pull("ph_documents", ["url"]);
    await pull("ph_products", ["hero_image_url", "offer_image_url"]);
    await pull("ph_seo", ["og_image"]);
  } catch (e) { return json(500, { error: String(e) }); }

  const groups = [...groupByUrl(refs).entries()].sort(([a], [b]) => a.localeCompare(b));
  const entries: any[] = [];
  let i = offset;
  for (; i < groups.length && Date.now() - started < TIME_BUDGET_MS; i++) {
    const [u, rs] = groups[i];
    const entry: any = { url: u, host: externalHost(u), references: rs, checked_at: new Date().toISOString() };
    try {
      const res = await fetchAllowed(u);
      entry.http_status = res.status;
      if (!res.ok) { entry.status = "unreachable"; await res.body?.cancel(); }
      else {
        const len = Number(res.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES) { entry.status = "too_large"; await res.body?.cancel(); }
        else {
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.byteLength > MAX_BYTES) entry.status = "too_large";
          else {
            const sha = await hex(bytes);
            const key = objectKey(sha);
            const ct = res.headers.get("content-type") ?? "application/octet-stream";
            entry.sha256 = sha; entry.size = bytes.byteLength; entry.content_type = ct; entry.object = key;
            const { error } = await sb.storage.from("backups").upload(key, bytes, { contentType: ct, upsert: false });
            if (!error) entry.status = "stored";
            else if (/exists|duplicate/i.test(error.message)) entry.status = "already_stored";
            else { entry.status = "store_failed"; entry.error = error.message; }
          }
        }
      }
    } catch (e) { entry.status = "unreachable"; entry.error = e instanceof Error ? e.message : String(e); }
    entries.push(entry);
  }

  const part = String(offset).padStart(5, "0");
  const indexKey = `external-media/index/${runDate}/part-${part}.json`;
  await sb.storage.from("backups").upload(indexKey, new TextEncoder().encode(JSON.stringify({
    version: 1, run_date: runDate, allowed_hosts: [...ALLOWED_HOSTS], total_urls: groups.length, offset, entries,
  }, null, 1)), { contentType: "application/json", upsert: true });

  const more = i < groups.length;
  if (more) {
    fetch(`${url}/functions/v1/backup-external-media`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${srk}` },
      body: JSON.stringify({ offset: i, run_date: runDate }),
    }).catch((e) => console.error("continuation failed", e));
  }
  const count = (s: string) => entries.filter((e) => e.status === s).length;
  return json(200, { run_date: runDate, total_urls: groups.length, processed: entries.length, next_offset: more ? i : null,
    stored: count("stored"), already_stored: count("already_stored"), unreachable: count("unreachable"),
    too_large: count("too_large"), store_failed: count("store_failed"), index: indexKey });
});
