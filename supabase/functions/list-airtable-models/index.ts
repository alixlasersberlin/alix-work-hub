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

    const jsonResp = (status: number, body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!LOVABLE_API_KEY) {
      return jsonResp(500, { error: "LOVABLE_API_KEY ist nicht konfiguriert.", models: [] });
    }
    if (!AIRTABLE_API_KEY) {
      return jsonResp(500, {
        error:
          "AIRTABLE_API_KEY ist nicht konfiguriert. Bitte den Airtable-Connector verbinden.",
        models: [],
      });
    }
    if (!BASE_ID || !TABLE) {
      return jsonResp(200, {
        error:
          "AIRTABLE_MODELS_BASE_ID und AIRTABLE_MODELS_TABLE sind nicht konfiguriert. Bitte als Secrets hinterlegen.",
        models: [],
      });
    }

    // Validate Base-ID format (Airtable Base-IDs always start with "app" + 14 chars)
    const baseIdTrim = BASE_ID.trim();
    if (!/^app[A-Za-z0-9]{14}$/.test(baseIdTrim)) {
      return jsonResp(400, {
        error: `AIRTABLE_MODELS_BASE_ID hat ein ungültiges Format ("${baseIdTrim}"). Erwartet wird ein Wert wie "appXXXXXXXXXXXXXX" (17 Zeichen, beginnend mit "app"). Prüfe die URL deiner Base in Airtable.`,
        models: [],
      });
    }

    // Validate table name/id (must be non-empty; if it looks like an ID it must match tbl + 14 chars)
    const tableTrim = TABLE.trim();
    if (tableTrim.length === 0) {
      return jsonResp(400, {
        error: "AIRTABLE_MODELS_TABLE ist leer. Bitte den exakten Tabellennamen oder die Table-ID (tbl…) hinterlegen.",
        models: [],
      });
    }
    if (tableTrim.startsWith("tbl") && !/^tbl[A-Za-z0-9]{14}$/.test(tableTrim)) {
      return jsonResp(400, {
        error: `AIRTABLE_MODELS_TABLE sieht aus wie eine Table-ID ("${tableTrim}"), hat aber nicht das erwartete Format "tblXXXXXXXXXXXXXX".`,
        models: [],
      });
    }
    if (tableTrim.length > 255) {
      return jsonResp(400, {
        error: "AIRTABLE_MODELS_TABLE ist zu lang (max. 255 Zeichen).",
        models: [],
      });
    }

    const fieldTrim = FIELD.trim();
    if (fieldTrim.length === 0 || fieldTrim.length > 255) {
      return jsonResp(400, {
        error: "AIRTABLE_MODELS_FIELD ist ungültig. Bitte den exakten Feldnamen aus Airtable hinterlegen.",
        models: [],
      });
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
