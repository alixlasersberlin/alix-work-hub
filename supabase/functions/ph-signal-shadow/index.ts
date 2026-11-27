// PRODUCT HUB 2.0 – SHADOW MODE change signals.
// Triggered by the database when a product's switch/status/hold changes. Computes the central
// publication decision and the signed signal that WOULD be sent, and records it in ph_sync_log.
// SHADOW_MODE is hard-coded: this function never contacts any website.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { SIGNAL_CHANNELS, decidePublication, legacyDecision } from "../_shared/ph-publication.ts";
import { dedupKey, isStale, sign, type ChangeSignal } from "../_shared/ph-signal.ts";

const SHADOW_MODE = true as const;
const Body = z.object({ product_id: z.string().uuid(), source: z.string().max(40).optional() });
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cron = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  if (!((cron && auth === `Bearer ${cron}`) || auth === `Bearer ${srk}`)) return json(401, { error: "unauthorized" });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, srk);
  const { data: p } = await sb.from("ph_products")
    .select("id,alix_product_id,name,slug,status,hero_image_url,active_de,active_com,active_dubai,updated_at")
    .eq("id", parsed.data.product_id).maybeSingle();
  if (!p) return json(404, { error: "not_found" });
  const { data: pcs } = await sb.from("ph_product_channels").select("channel_code,hold,status").eq("product_id", p.id);

  const results = [];
  for (const channel of SIGNAL_CHANNELS) {
    const ch = (pcs ?? []).find((r: any) => r.channel_code === channel) ?? null;
    const d = decidePublication(p as any, channel, ch);
    const version = p.updated_at as string;
    const key = await dedupKey({ channel, product_id: p.alix_product_id ?? p.id, version, desired: d.desired });

    const { data: prev } = await sb.from("ph_sync_log").select("payload")
      .eq("product_id", p.id).eq("channel_code", channel).eq("operation", "shadow_signal")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const prevPayload = (prev?.payload ?? {}) as any;
    if (prevPayload.dedup_key === key) { results.push({ channel, skipped: "duplicate" }); continue; }
    if (isStale(version, prevPayload.signal?.version)) { results.push({ channel, skipped: "stale" }); continue; }
    if (prevPayload.signal?.desired === d.desired && prevPayload.decision?.reasons?.join() === d.reasons.join()) {
      results.push({ channel, skipped: "unchanged" }); continue;
    }

    const signal: ChangeSignal = {
      event: "product.changed", event_id: crypto.randomUUID(), channel,
      product_id: p.alix_product_id ?? p.id, version, desired: d.desired, issued_at: new Date().toISOString(),
    };
    const secret = Deno.env.get(`PH_NOTIFY_SECRET_${channel.toUpperCase()}`);
    const signable = secret ? (await sign(secret, Math.floor(Date.now() / 1000), JSON.stringify(signal))).length > 0 : false;
    const legacy = legacyDecision(p as any, channel);

    await sb.from("ph_sync_log").insert({
      channel_code: channel, direction: "shadow", operation: "shadow_signal", product_id: p.id,
      status: "shadow",
      message: `SHADOW MODE · ${p.name} · ${channel} → ${d.desired}${d.reasons.length ? ` (${d.reasons.join(", ")})` : ""}${legacy !== d.desired ? ` · weicht von Live-Logik ab (${legacy})` : ""} · nicht gesendet`,
      payload: { shadow_mode: SHADOW_MODE, dedup_key: key, signal, signable, decision: d, legacy_decision: legacy, source: parsed.data.source ?? "trigger" },
    });
    results.push({ channel, desired: d.desired, reasons: d.reasons });
  }
  return json(200, { shadow_mode: SHADOW_MODE, sent: 0, results });
});
