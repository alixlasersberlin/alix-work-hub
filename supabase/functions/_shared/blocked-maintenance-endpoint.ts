/** A0 containment: no credentials, payload reads, providers or database access. */
export function blockedMaintenanceEndpoint(req: Request): Response {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Cache-Control": "no-store",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({ error: "maintenance_endpoint_blocked", code: "A0_ENDPOINT_BLOCKED" }), {
    status: 410,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
