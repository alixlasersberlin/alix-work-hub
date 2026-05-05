import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/airtable";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const AIRTABLE_API_KEY = Deno.env.get("AIRTABLE_API_KEY");
    const BASE_ID = Deno.env.get("AIRTABLE_MODELS_BASE_ID");
    const TABLE = Deno.env.get("AIRTABLE_MODELS_TABLE");
    const FIELD = Deno.env.get("AIRTABLE_MODELS_FIELD") ?? "Name";

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!AIRTABLE_API_KEY) throw new Error("AIRTABLE_API_KEY is not configured");
    if (!BASE_ID || !TABLE) {
      return new Response(
        JSON.stringify({
          error:
            "AIRTABLE_MODELS_BASE_ID und AIRTABLE_MODELS_TABLE sind nicht konfiguriert. Bitte als Secrets hinterlegen.",
          models: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const models: { id: string; name: string }[] = [];
    let offset: string | undefined;

    do {
      const url = new URL(
        `${GATEWAY_URL}/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`,
      );
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("fields[]", FIELD);
      if (offset) url.searchParams.set("offset", offset);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": AIRTABLE_API_KEY,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Airtable error [${res.status}]: ${JSON.stringify(data)}`);
      }

      for (const r of data.records ?? []) {
        const name = r.fields?.[FIELD];
        if (typeof name === "string" && name.trim()) {
          models.push({ id: r.id, name: name.trim() });
        }
      }
      offset = data.offset;
    } while (offset);

    models.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("list-airtable-models error:", msg);
    return new Response(JSON.stringify({ error: msg, models: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
