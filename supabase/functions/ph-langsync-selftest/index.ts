// Temporaerer Selbsttest fuer product-hub-lang-sync (server-zu-server).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = Deno.env.get("PRODUCT_HUB_API_KEY");
  if (!key || req.headers.get("x-test-key") !== key) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
  }
  const payload = await req.json().catch(() => ({}));
  const url = Deno.env.get("SUPABASE_URL")!;
  const res = await fetch(`${url}/functions/v1/product-hub-lang-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: text }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
