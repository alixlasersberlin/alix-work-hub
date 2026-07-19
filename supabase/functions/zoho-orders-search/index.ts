// Manual Zoho salesorder search across both EU mandants.
// Auth: authenticated Supabase user (Admin/Super Admin/Order) or service role.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type SourceSystem = "zoho_eu_1" | "zoho_eu_2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cfg(source: SourceSystem) {
  const orgPrefix = source === "zoho_eu_2" ? "ZOHO_EU_2" : "ZOHO_EU_1";
  return {
    clientId: Deno.env.get(`ZOHO_EU_1_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`ZOHO_EU_1_CLIENT_SECRET`) ?? "",
    refreshToken: Deno.env.get(`ZOHO_EU_1_REFRESH_TOKEN`) ?? "",
    organizationId: Deno.env.get(`${orgPrefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: "https://accounts.zoho.eu",
    booksApiBaseUrl: "https://www.zohoapis.eu/books/v3",
  };
}

async function token(c: ReturnType<typeof cfg>) {
  const res = await fetch(`${c.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: c.refreshToken,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Zoho token refresh failed: ${await res.text()}`);
  const j = await res.json();
  return j.access_token as string;
}

type Entity = "salesorder" | "estimate";

async function searchSource(source: SourceSystem, query: string, mode: "number" | "customer" | "auto", entity: Entity) {
  const c = cfg(source);
  if (!c.clientId || !c.refreshToken || !c.organizationId) {
    return { source, entity, error: "Missing Zoho credentials/organization", results: [] as any[] };
  }
  const t = await token(c);
  const resource = entity === "estimate" ? "estimates" : "salesorders";
  const numberField = entity === "estimate" ? "estimate_number_contains" : "salesorder_number_contains";
  const base = `${c.booksApiBaseUrl}/${resource}?organization_id=${c.organizationId}&per_page=50&sort_column=created_time&sort_order=D`;
  const params: string[] = [];
  const looksLikeNumber = /^\s*(so-|SO-|es-|ES-|an-|AN-)?\d/i.test(query);
  const effectiveMode = mode === "auto" ? (looksLikeNumber ? "number" : "customer") : mode;
  if (effectiveMode === "number") {
    params.push(`${numberField}=${encodeURIComponent(query.trim())}`);
  } else {
    params.push(`customer_name_contains=${encodeURIComponent(query.trim())}`);
  }
  const url = `${base}&${params.join("&")}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${t}` } });
  if (!res.ok) {
    return { source, entity, error: `Zoho search failed: ${await res.text()}`, results: [] };
  }
  const j = await res.json();
  const rows: any[] = Array.isArray(j[resource]) ? j[resource] : [];
  const suffix = source === "zoho_eu_2" && entity === "estimate" ? "-AT" : "";
  return {
    source,
    entity,
    mode: effectiveMode,
    results: rows.map((r) => ({
      salesorder_id: String(entity === "estimate" ? r.estimate_id : r.salesorder_id),
      salesorder_number: entity === "estimate"
        ? `${String(r.estimate_number ?? "")}${suffix}`
        : String(r.salesorder_number ?? ""),
      date: r.date,
      status: r.status,
      customer_name: r.customer_name,
      total: r.total,
      entity,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (bearer !== SERVICE_KEY) {
      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: u } = await authClient.auth.getUser(bearer);
      if (!u?.user) return json({ error: "Unauthorized" }, 401);
      const { data: isAdmin } = await authClient.rpc("is_admin");
      let ok = !!isAdmin;
      if (!ok) {
        const { data: canManage } = await authClient.rpc("can_manage_orders");
        ok = !!canManage;
      }
      if (!ok) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const query = String(body?.query ?? "").trim();
    const mode = (body?.mode as "number" | "customer" | "auto") ?? "auto";
    const sources: SourceSystem[] = Array.isArray(body?.sources) && body.sources.length
      ? body.sources.filter((s: any) => s === "zoho_eu_1" || s === "zoho_eu_2")
      : ["zoho_eu_1", "zoho_eu_2"];
    const entities: Entity[] = Array.isArray(body?.entities) && body.entities.length
      ? body.entities.filter((e: any) => e === "salesorder" || e === "estimate")
      : ["salesorder"];
    if (query.length < 2) return json({ error: "Query too short (min 2 chars)" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tasks: Promise<any>[] = [];
    for (const s of sources) {
      for (const e of entities) {
        tasks.push(searchSource(s, query, mode, e).catch((err) => ({
          source: s, entity: e, error: (err as Error).message, results: [] as any[],
        })));
      }
    }
    const results = await Promise.all(tasks);

    // Annotate salesorder hits with local orders match
    const soIds = results.filter((r) => r.entity === "salesorder").flatMap((r) => (r.results ?? []).map((x: any) => x.salesorder_id));
    const soNums = results.filter((r) => r.entity === "salesorder").flatMap((r) => (r.results ?? []).map((x: any) => String(x.salesorder_number ?? "").toUpperCase()));
    const localById = new Set<string>();
    const localByNum = new Set<string>();
    if (soIds.length) {
      const { data } = await admin
        .from("orders")
        .select("external_order_id, order_number, source_system")
        .or(`external_order_id.in.(${soIds.map((i) => `"${i}"`).join(",")}),order_number.in.(${soNums.map((n) => `"${n}"`).join(",")})`);
      (data as any[] | null)?.forEach((r) => {
        if (r.external_order_id) localById.add(String(r.external_order_id));
        if (r.order_number) localByNum.add(String(r.order_number).toUpperCase());
      });
    }
    // Annotate estimate hits with local offers match (by offer_number)
    const estNums = results.filter((r) => r.entity === "estimate").flatMap((r) => (r.results ?? []).map((x: any) => String(x.salesorder_number ?? "").toUpperCase()));
    const localOffers = new Set<string>();
    if (estNums.length) {
      const { data } = await admin.from("offers").select("offer_number").in("offer_number", Array.from(new Set(estNums)));
      (data as any[] | null)?.forEach((r) => { if (r.offer_number) localOffers.add(String(r.offer_number).toUpperCase()); });
    }
    for (const r of results) {
      for (const row of (r.results ?? []) as any[]) {
        if (r.entity === "estimate") {
          row.exists_local = localOffers.has(String(row.salesorder_number ?? "").toUpperCase());
        } else {
          row.exists_local = localById.has(row.salesorder_id) || localByNum.has(String(row.salesorder_number ?? "").toUpperCase());
        }
      }
    }

    return json({ ok: true, query, mode, entities, results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
