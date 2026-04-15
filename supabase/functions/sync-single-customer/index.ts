import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(sourceSystem: string) {
  const configs: Record<string, { prefix: string; accountsBase: string; apiBase: string }> = {
    zoho_eu_1: { prefix: "ZOHO_EU_1", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_eu_2: { prefix: "ZOHO_EU_2", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_us_1: { prefix: "ZOHO_US_1", accountsBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com/books/v3" },
  };
  const cfg = configs[sourceSystem];
  if (!cfg) return null;
  return {
    clientId: Deno.env.get(`${cfg.prefix}_CLIENT_ID`) ?? "",
    clientSecret: Deno.env.get(`${cfg.prefix}_CLIENT_SECRET`) ?? "",
    refreshToken: Deno.env.get(`${cfg.prefix}_REFRESH_TOKEN`) ?? "",
    organizationId: Deno.env.get(`${cfg.prefix}_ORGANIZATION_ID`) ?? "",
    accountsBaseUrl: cfg.accountsBase,
    booksApiBaseUrl: cfg.apiBase,
  };
}

async function getAccessToken(config: any): Promise<string> {
  const res = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Access token missing");
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Missing server configuration" }, 500);
    if (!authHeader) return jsonResponse({ error: "Missing authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: callerRoles } = await adminClient.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
    const roleNames = (callerRoles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
    if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { source_system, external_customer_id } = body;

    if (!source_system || !external_customer_id) {
      return jsonResponse({ error: "source_system and external_customer_id are required" }, 400);
    }
    if (!["zoho_eu_1", "zoho_eu_2", "zoho_us_1"].includes(source_system)) {
      return jsonResponse({ error: "Invalid source_system" }, 400);
    }

    const zohoConfig = getZohoConfig(source_system);
    if (!zohoConfig) return jsonResponse({ error: "Config not found" }, 500);

    const accessToken = await getAccessToken(zohoConfig);

    const contactRes = await fetch(
      `${zohoConfig.booksApiBaseUrl}/contacts/${external_customer_id}?organization_id=${zohoConfig.organizationId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );

    if (!contactRes.ok) {
      const text = await contactRes.text();
      return jsonResponse({ error: "Zoho API error", message: text }, 502);
    }

    const contactData = await contactRes.json();
    const contact = contactData.contact;
    if (!contact) return jsonResponse({ error: "Contact not found in Zoho response" }, 404);

    const customerPayload = {
      external_customer_id: contact.contact_id?.toString(),
      source_system,
      company_name: contact.company_name ?? null,
      contact_name: contact.contact_name ?? null,
      email: contact.email ?? null,
      phone: contact.mobile || contact.phone || null,
      billing_address: contact.billing_address ?? null,
      shipping_address: contact.shipping_address ?? null,
      raw_data: contact,
    };

    const { data: upserted, error: upsertError } = await adminClient
      .from("customers")
      .upsert(customerPayload, { onConflict: "external_customer_id,source_system" })
      .select("id, external_customer_id, company_name, contact_name")
      .single();

    if (upsertError) {
      return jsonResponse({ error: "Customer upsert failed", message: upsertError.message }, 500);
    }

    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      action: "sync_single_customer",
      module: "import_management",
      details: { source_system, external_customer_id, customer_id: upserted.id },
    });

    return jsonResponse({
      success: true,
      customer: upserted,
      source_system,
    });
  } catch (error: any) {
    console.error("sync-single-customer error:", error);
    return jsonResponse({ error: "Internal server error", message: error?.message ?? null }, 500);
  }
});
