// PRODUCT HUB 2.0 – authenticated status receipts from websites.
// Each website signs with its own secret PH_STATUS_SECRET_<CHANNEL>. A receipt records the website-confirmed
// state (C) next to desired (A) and transmitted (B) state; it never changes product data and never triggers a signal.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { SIGNAL_CHANNELS, normalizeChannel } from "../_shared/ph-publication.ts";
import { confirms, isStale, verify } from "../_shared/ph-signal.ts";

const HOSTS: Record<string, string[]> = {
  de: ["alix-lasers.de", "www.alix-lasers.de"], com: ["alix-lasers.com", "www.alix-lasers.com"], dubai: ["alix-lasers.ae", "www.alix-lasers.ae"],
};
const Receipt = z.object({
  event_id: z.string().uuid(), channel: z.string().min(2).max(30), product_id: z.string().min(1).max(200),
  version: z.string().min(10).max(40), state: z.enum(["ONLINE", "OFFLINE", "ERROR"]),
  public_url: z.string().url().max(500).nullable(), error_code: z.string().max(80).nullable().default(null),
  error: z.string().max(1000).nullable().default(null), observed_at: z.string().datetime(),
});
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const raw = await req.text();
  if (raw.length > 8000) return json(413, { error: "too_large" });
  let body: unknown; try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const parsed = Receipt.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const r = parsed.data;
  const channel = normalizeChannel(r.channel);
  if (!channel || !(SIGNAL_CHANNELS as readonly string[]).includes(channel)) return json(400, { error: "unknown_channel" });

  const secret = Deno.env.get(`PH_STATUS_SECRET_${channel.toUpperCase()}`);
  if (!secret) return json(503, { error: "channel_not_connected" });
  const v = await verify(secret, req.headers.get("x-alixwork-timestamp"), req.headers.get("x-alixwork-signature"), raw);
  if (!v.ok) return json(401, { error: v.reason });
  if (r.public_url && !HOSTS[channel].includes(new URL(r.public_url).hostname)) return json(400, { error: "public_url_host_mismatch" });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: p } = await sb.from("ph_products").select("id").eq("alix_product_id", r.product_id).maybeSingle();
  if (!p) return json(404, { error: "unknown_product" });

  // Replay / duplicate: the same event_id is recorded once.
  const { data: dup } = await sb.from("ph_sync_log").select("id").eq("operation", "status_receipt")
    .eq("channel_code", channel).filter("payload->receipt->>event_id", "eq", r.event_id).limit(1).maybeSingle();
  if (dup) return json(200, { accepted: true, duplicate: true });

  const { data: last } = await sb.from("ph_sync_log").select("payload").eq("product_id", p.id).eq("channel_code", channel)
    .eq("operation", "shadow_signal").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const signal = (last?.payload as any)?.signal ?? null;
  const stale = signal ? isStale(r.version, signal.version) : false;
  const confirmed = signal ? confirms(signal, r) : false;
  const status = stale ? "stale" : r.state === "ERROR" ? "website_error" : confirmed ? "website_confirmed" : "website_mismatch";

  await sb.from("ph_sync_log").insert({
    channel_code: channel, direction: "inbound", operation: "status_receipt", product_id: p.id, status,
    message: `Rückmeldung ${channel}: ${r.state}${r.error_code ? ` (${r.error_code})` : ""} · Version ${r.version}${stale ? " · veraltet, ignoriert" : ""}`,
    payload: { receipt: r, desired: signal?.desired ?? null, transmitted_version: signal?.version ?? null, confirmed, stale, independent_check: "ausstehend" },
  });
  return json(202, { accepted: true, status, confirmed });
});
