// Public VIES VAT number check proxy (no auth needed - internal app)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const country = (url.searchParams.get("country") || "").toUpperCase().trim();
    const number = (url.searchParams.get("number") || "").replace(/[^A-Za-z0-9]/g, "").trim();
    if (!/^[A-Z]{2}$/.test(country) || !number) {
      return new Response(JSON.stringify({ error: "invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const endpoint = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`;
    const r = await fetch(endpoint, { headers: { Accept: "application/json" } });
    const text = await r.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return new Response(JSON.stringify({
      ok: r.ok,
      status: r.status,
      isValid: !!body?.isValid,
      name: body?.name || body?.viesApproximate?.name || null,
      address: body?.address || null,
      userError: body?.userError || null,
      requestDate: body?.requestDate || null,
      raw: body,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
