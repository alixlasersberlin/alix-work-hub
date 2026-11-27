// PRODUCT HUB 2.0 – authenticated status receipts from websites.
// Each website signs with its own secret PH_STATUS_SECRET_<CHANNEL>. A receipt records the website-confirmed
// state (C) next to desired (A) and transmitted (B) state; it never changes product data and never triggers a signal.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { SIGNAL_CHANNELS, normalizeChannel } from "../_shared/ph-publication.ts";
import { verify } from "../_shared/ph-signal.ts";

const HOSTS: Record<string, string[]> = {
  de: ["alix-lasers.de", "www.alix-lasers.de"], com: ["alix-lasers.com", "www.alix-lasers.com"], dubai: ["alix-lasers.ae", "www.alix-lasers.ae"],
};
const Receipt = z.object({
  event_id: z.string().uuid(), channel: z.string().min(2).max(30), product_id: z.string().min(1).max(200),
  version: z.string().datetime({ precision: null }).max(40), state: z.enum(["ONLINE", "OFFLINE", "ERROR"]),
  public_url: z.string().url().max(500).nullable(), error_code: z.string().max(80).nullable().default(null),
  error: z.string().max(1000).nullable().default(null), observed_at: z.string().datetime(),
});
// Connection-test receipts: signed like normal receipts, stored only as log evidence, never touch product state.
const TestReceipt = z.object({ kind: z.literal("connection_test"), test_id: z.string().uuid(), channel: z.enum(["de", "com"]), observed_at: z.string().datetime() });
async function testReceipt(req: Request, raw: string, r: z.infer<typeof TestReceipt>) {
  const secret = Deno.env.get(`PH_STATUS_SECRET_${r.channel.toUpperCase()}`);
  if (!secret) return json(503, { error: "channel_not_connected" });
  const v = await verify(secret, req.headers.get("x-alixwork-timestamp"), req.headers.get("x-alixwork-signature"), raw);
  if (!v.ok) return json(401, { error: v.reason });
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json(503, { error: "configuration_missing" });
  const sb = createClient(url, key);
  const { error } = await sb.from("ph_sync_log").insert({ channel_code: r.channel, direction: "inbound", operation: "ph2_connection_test_receipt", status: "ok", message: "Testrückmeldung", payload: r });
  if (error) return json(500, { error: "receipt_storage_failed" });
  return json(202, { accepted: true, test: true });
}
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const raw = await req.text();
  if (raw.length > 8000) return json(413, { error: "too_large" });
  let body: unknown; try { body = JSON.parse(raw); } catch { return json(400, { error: "invalid_json" }); }
  const test = TestReceipt.safeParse(body);
  if (test.success) return testReceipt(req, raw, test.data);
  const parsed = Receipt.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const r = parsed.data;
  const channel = normalizeChannel(r.channel);
  if (!channel || !(SIGNAL_CHANNELS as readonly string[]).includes(channel)) return json(400, { error: "unknown_channel" });

  const secret = Deno.env.get(`PH_STATUS_SECRET_${channel.toUpperCase()}`);
  if (!secret) return json(503, { error: "channel_not_connected" });
  const v = await verify(secret, req.headers.get("x-alixwork-timestamp"), req.headers.get("x-alixwork-signature"), raw);
  if (!v.ok) return json(401, { error: v.reason });
  if (r.public_url) {
    const publicUrl = new URL(r.public_url);
    if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || !HOSTS[channel].includes(publicUrl.hostname)) return json(400, { error: 'public_url_host_mismatch' });
  }
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(503, { error: 'configuration_missing' });
  const sb = createClient(url, key);
  const { data, error } = await sb.rpc('ph2_receipt', { _receipt: { ...r, channel } });
  if (error) return json(500, { error: 'receipt_storage_failed' });
  return json(data?.accepted ? data.duplicate ? 200 : 202 : 409, data);
});
