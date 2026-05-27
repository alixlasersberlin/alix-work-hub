// Ad-hoc test endpoint: verifies ZOHO_EU_2 credentials by fetching 1 contact.
// Public (no auth) read-only test. Remove after verification.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const clientId = Deno.env.get('ZOHO_EU_2_CLIENT_ID') || Deno.env.get('ZOHO_EU_1_CLIENT_ID');
    const clientSecret = Deno.env.get('ZOHO_EU_2_CLIENT_SECRET') || Deno.env.get('ZOHO_EU_1_CLIENT_SECRET');
    const refreshToken = Deno.env.get('ZOHO_EU_2_REFRESH_TOKEN') || Deno.env.get('ZOHO_EU_1_REFRESH_TOKEN');
    const orgId = Deno.env.get('ZOHO_EU_2_ORGANIZATION_ID');

    if (!clientId || !clientSecret || !refreshToken || !orgId) {
      return new Response(JSON.stringify({
        ok: false,
        step: 'config',
        missing: {
          ZOHO_EU_2_CLIENT_ID: !clientId,
          ZOHO_EU_2_CLIENT_SECRET: !clientSecret,
          ZOHO_EU_2_REFRESH_TOKEN: !refreshToken,
          ZOHO_EU_2_ORGANIZATION_ID: !orgId,
        },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1) Refresh access token (EU)
    const tokenRes = await fetch(
      `https://accounts.zoho.eu/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`,
      { method: 'POST' },
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return new Response(JSON.stringify({ ok: false, step: 'token', status: tokenRes.status, body: tokenJson }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Fetch 1 contact
    const url = `https://www.zohoapis.eu/books/v3/contacts?organization_id=${orgId}&page=1&per_page=1`;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${tokenJson.access_token}` } });
    const json = await res.json();
    const contact = (json.contacts ?? [])[0] ?? null;

    return new Response(JSON.stringify({
      ok: res.ok,
      status: res.status,
      organization_id: orgId,
      page_context: json.page_context ?? null,
      contact_preview: contact ? {
        contact_id: contact.contact_id,
        contact_name: contact.contact_name,
        company_name: contact.company_name,
        email: contact.email,
      } : null,
      raw_error: res.ok ? undefined : json,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, step: 'exception', message: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
