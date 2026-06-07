// AlixSmart Read-API
// Exposes read-only endpoints for AlixSmart frontend to consume AlixWork as master data source.
// Auth: header `x-api-key` matching the ALIXSMART_EXPORT_KEY secret.
//
// Endpoints (GET):
//   /alixsmart-readapi/customers
//   /alixsmart-readapi/devices
//   /alixsmart-readapi/maintenance
//   /alixsmart-readapi/manuals
//   /alixsmart-readapi/academy-sessions
//   /alixsmart-readapi/academy-bookings
//
// Query params: ?limit=200 (max 1000) &offset=0 &since=ISO-8601 (filters by updated_at)

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("ALIXSMART_EXPORT_KEY") ?? "";

const headers = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Content-Type": "application/json",
};

type Resource = {
  table: string;
  columns: string;
  orderBy: string;
};

const RESOURCES: Record<string, Resource> = {
  customers: {
    table: "customers",
    columns:
      "id, external_customer_id, source_system, company_name, contact_name, email, phone, billing_address, shipping_address, is_vip, iban, bic, bank_name, created_at, updated_at",
    orderBy: "updated_at",
  },
  devices: {
    table: "lager_devices",
    columns:
      "id, serial_number, model_name, source_system, alixsmart_source_id, alixsmart_user_id, customer_email, customer_name, device_status, entry_date, commissioning_date, last_service_date, next_service_date, reserved_order_id, notes, created_at, updated_at",
    orderBy: "updated_at",
  },
  maintenance: {
    table: "device_maintenance",
    columns:
      "id, serial_number, customer_id, customer_name, device_name, maintenance_plan_id, last_maintenance_date, next_maintenance_date, maintenance_status, assigned_technician, notes, created_at, updated_at",
    orderBy: "updated_at",
  },
  manuals: {
    table: "model_manuals",
    columns:
      "id, source_id, model_name, title, file_url, file_path, file_type, version, is_active, metadata, created_at, updated_at",
    orderBy: "updated_at",
  },
  "academy-sessions": {
    table: "academy_sessions",
    columns:
      "id, source_id, title, description, start_date, end_date, location, instructor, max_participants, status, metadata, created_at, updated_at",
    orderBy: "updated_at",
  },
  "academy-bookings": {
    table: "academy_bookings",
    columns:
      "id, source_id, academy_session_id, source_session_id, customer_id, source_customer_id, customer_name, customer_email, booking_status, notes, metadata, created_at, updated_at",
    orderBy: "updated_at",
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // Auth
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!API_KEY || apiKey !== API_KEY) {
    return json({ error: "unauthorized" }, 401);
  }

  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const url = new URL(req.url);
  // Path looks like /alixsmart-readapi/<resource>
  const parts = url.pathname.split("/").filter(Boolean);
  const resourceName = parts[parts.length - 1] ?? "";

  if (resourceName === "alixsmart-readapi" || resourceName === "") {
    return json({
      service: "alixsmart-readapi",
      resources: Object.keys(RESOURCES),
      usage:
        "GET /alixsmart-readapi/<resource>?since=ISO&limit=200&offset=0  (header x-api-key required)",
    });
  }

  const resource = RESOURCES[resourceName];
  if (!resource) {
    return json(
      { error: "unknown_resource", available: Object.keys(RESOURCES) },
      404,
    );
  }

  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1),
    1000,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    0,
  );
  const since = url.searchParams.get("since");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  let query = admin
    .from(resource.table)
    .select(resource.columns, { count: "exact" })
    .order(resource.orderBy, { ascending: true })
    .range(offset, offset + limit - 1);

  if (since) query = query.gte(resource.orderBy, since);

  const { data, error, count } = await query;

  if (error) {
    console.error("readapi error", resourceName, error);
    return json({ error: error.message, resource: resourceName }, 500);
  }

  return json({
    resource: resourceName,
    count: count ?? data?.length ?? 0,
    returned: data?.length ?? 0,
    limit,
    offset,
    since,
    data,
  });
});
