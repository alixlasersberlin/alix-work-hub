// Öffentliche Liste der mietbaren Product-Hub-Geräte (Single Source of Truth = ph_products).
// Liefert nur Anzeigedaten – keine internen Einkaufspreise.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export const DEFAULT_RENT_FACTORS: Record<string, number> = { "12": 3, "24": 2.5, "36": 2 };
const DEFAULT_DEPOSIT_PCT = 20;
const DEFAULT_VK_MIN_DISCOUNT = 10;

type Any = Record<string, any>;

function effectiveMin(p: Any): number {
  const uvp = Number(p.uvp || 0);
  const mode = p.vk_min_value === null || p.vk_min_value === undefined || p.vk_min_value === ""
    ? "percent"
    : (p.vk_min_mode === "percent" ? "percent" : "fixed");
  const val = p.vk_min_value === null || p.vk_min_value === undefined || p.vk_min_value === ""
    ? DEFAULT_VK_MIN_DISCOUNT
    : Number(p.vk_min_value);
  if (mode !== "percent") return val;
  return uvp * (1 - Math.abs(val) / 100);
}

function effectiveMax(p: Any): number {
  const uvp = Number(p.uvp || 0);
  const val = Number(p.vk_max_value || 0);
  if (p.vk_max_mode === "percent") return uvp * (1 + val / 100);
  return val;
}

export function rentBase(p: Any): number {
  if (p.rent_base === "uvp") return Number(p.uvp || 0);
  if (p.rent_base === "vk_max") return effectiveMax(p);
  return effectiveMin(p);
}

export function monthlyFor(p: Any, term: number): number {
  const cfg = (p.rent_terms || {})[String(term)] || {};
  if (cfg.enabled === false) return 0;
  const mode = cfg.mode === "fixed" ? "fixed" : "percent";
  const hasValue = !(cfg.value === null || cfg.value === undefined || cfg.value === "");
  const value = hasValue ? Number(cfg.value) : (mode === "percent" ? (DEFAULT_RENT_FACTORS[String(term)] ?? 0) : 0);
  if (!value) return 0;
  return mode === "fixed" ? value : (rentBase(p) * value) / 100;
}

export function depositPct(p: Any): number {
  if (p.deposit_active === false) return 0;
  const v = p.deposit_value === null || p.deposit_value === undefined || p.deposit_value === ""
    ? DEFAULT_DEPOSIT_PCT
    : Number(p.deposit_value);
  return p.deposit_mode === "fixed" ? 0 : v;
}

export function rentalInfo(row: Any) {
  const pc = (row.price_countries || {}) as Any;
  const de = (pc.de || {}) as Any;
  if (de.rent_active === false) return null;
  const terms = [12, 24, 36, 48, 60]
    .map((t) => ({ term: t, monthly: Math.round(monthlyFor(de, t) * 100) / 100 }))
    .filter((x) => x.monthly > 0);
  if (!terms.length) return null;
  const cheapest = terms.reduce((a, b) => (b.monthly < a.monthly ? b : a));
  const dep = depositPct(de);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    model: row.model,
    technology: row.technology_claims?.[0] || row.product_group || row.applications?.[0] || null,
    image_url: row.hero_image_url || row.offer_image_url || null,
    short_description: row.short_description,
    from_monthly: cheapest.monthly,
    currency: de.currency || "EUR",
    terms,
    deposit_percent: dep,
    deposit_fixed: de.deposit_mode === "fixed" ? Number(de.deposit_value || 0) : null,
    delivery_days: de.rent_delivery_days ? Number(de.rent_delivery_days) : null,
    rent_note: de.rent_note || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase
    .from("ph_products")
    .select("id,name,slug,model,product_group,applications,technology_claims,hero_image_url,offer_image_url,short_description,price_countries,sort_order,status")
    .in("status", ["approved", "published"])
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("rental-devices query failed", error.message);
    return Response.json({ error: "query_failed" }, { status: 500, headers: corsHeaders });
  }
  const devices = (data || []).map(rentalInfo).filter(Boolean);
  return Response.json({ devices }, { headers: corsHeaders });
});
