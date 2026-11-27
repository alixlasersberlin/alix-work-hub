// PRODUCT HUB 2.0 – SHADOW MODE change signals.
// Triggered by the database when a product's switch/status/hold changes. Computes the central
// publication decision and the signed signal that WOULD be sent, and records it in ph_sync_log.
// SHADOW_MODE is hard-coded: this function never contacts any website.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SHADOW_MODE = true as const;
const Body = z.object({ product_id: z.string().uuid(), source: z.string().max(40).optional() });
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cron = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  if (!srk || !((cron && auth === `Bearer ${cron}`) || auth === `Bearer ${srk}`)) return json(401, { error: "unauthorized" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });

  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return json(503, { error: "configuration_missing" });
  const sb = createClient(url, srk);
  const { error } = await sb.rpc('ph2_capture', { _product_id: parsed.data.product_id, _source: parsed.data.source ?? 'shadow_endpoint' });
  if (error) return json(500, { error: 'queue_capture_failed' });
  return json(200, { shadow_mode: SHADOW_MODE, sent: 0, queued: true });
});
