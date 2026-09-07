// Temporärer Selbsttest: ruft die Produkt-API mit dem serverseitigen Schlüssel auf.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") || "de";
  const base = Deno.env.get("SUPABASE_URL")!;
  const r = await fetch(`${base}/functions/v1/product-hub-api/products?locale=${locale}`, {
    headers: { "x-api-key": Deno.env.get("PRODUCT_HUB_API_KEY") ?? "" },
  });
  const body = await r.text();
  return new Response(body, { status: r.status, headers: { "Content-Type": "application/json" } });
});
