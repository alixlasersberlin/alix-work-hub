// Fetches invoice/salesorder PDF from Zoho Books and returns it base64-encoded.
// Automatically routes the PDF through sig-apply-facsimile so the H. Tran
// signature is stamped on Zoho-generated documents as well.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getZohoConfig(source: string) {
  const map: Record<string, { prefix: string; accountsBase: string; apiBase: string }> = {
    zoho_eu_1: { prefix: "ZOHO_EU_1", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_eu_2: { prefix: "ZOHO_EU_2", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_us_1: { prefix: "ZOHO_US_1", accountsBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com/books/v3" },
  };
  const c = map[source];
  if (!c) return null;
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  return {
    clientId: source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_ID") : env(`${c.prefix}_CLIENT_ID`),
    clientSecret: source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_SECRET") : env(`${c.prefix}_CLIENT_SECRET`),
    refreshToken: source === "zoho_eu_2" ? env("ZOHO_EU_1_REFRESH_TOKEN") : env(`${c.prefix}_REFRESH_TOKEN`),
    organizationId: env(`${c.prefix}_ORGANIZATION_ID`),
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

async function getAccessToken(cfg: NonNullable<ReturnType<typeof getZohoConfig>>) {
  const res = await fetch(`${cfg.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cfg.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data?.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

type Resource = 'invoices' | 'recurringinvoices' | 'salesorders' | 'estimates';

function resolveResource(input: {
  resource?: string;
  recurring?: boolean;
}): { resource: Resource; docType: string } {
  const r = (input.resource || '').toLowerCase();
  if (r === 'salesorders' || r === 'salesorder' || r === 'order') {
    return { resource: 'salesorders', docType: 'order_confirmation' };
  }
  if (r === 'estimates' || r === 'estimate' || r === 'offer') {
    return { resource: 'estimates', docType: 'offer' };
  }
  if (r === 'recurringinvoices' || input.recurring) {
    return { resource: 'recurringinvoices', docType: 'invoice' };
  }
  return { resource: 'invoices', docType: 'invoice' };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      zoho_invoice_id,
      zoho_id,
      source_system = "zoho_eu_1",
      recurring = false,
      resource,
      doc_type,
      document_ref,
      skip_facsimile = false,
    } = body || {};

    const id = zoho_id || zoho_invoice_id;
    if (!id) return json({ error: "zoho_id / zoho_invoice_id missing" }, 400);

    const cfg = getZohoConfig(source_system);
    if (!cfg) return json({ error: "Invalid source_system" }, 400);

    const { resource: res, docType: defaultDocType } = resolveResource({ resource, recurring });
    const finalDocType = doc_type || defaultDocType;

    const token = await getAccessToken(cfg);
    const url = `${cfg.booksApiBaseUrl}/${res}/${id}?organization_id=${cfg.organizationId}&accept=pdf`;
    const zohoRes = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (!zohoRes.ok) {
      const t = await zohoRes.text();
      return json({ error: `Zoho PDF fehler [${zohoRes.status}]: ${t}` }, zohoRes.status);
    }
    const buf = new Uint8Array(await zohoRes.arrayBuffer());
    let pdfB64 = bytesToBase64(buf);
    let stamped = false;

    // Route through facsimile (server-side) so Zoho downloads carry H. Tran too.
    if (!skip_facsimile) {
      try {
        const admin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        const { data: stampRes, error: stampErr } = await admin.functions.invoke('sig-apply-facsimile', {
          body: {
            pdf_base64: pdfB64,
            doc_type: finalDocType,
            document_ref: document_ref || id,
          },
        });
        if (!stampErr && stampRes?.pdf_base64) {
          pdfB64 = stampRes.pdf_base64;
          stamped = !!stampRes.applied;
        } else if (stampErr) {
          console.warn('[zoho-invoice-pdf] facsimile skipped:', stampErr.message);
        }
      } catch (e) {
        console.warn('[zoho-invoice-pdf] facsimile error:', (e as Error).message);
      }
    }

    return json({ pdf_base64: pdfB64, size: buf.length, facsimile_applied: stamped, doc_type: finalDocType, resource: res });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
