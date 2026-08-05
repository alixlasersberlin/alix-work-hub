import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Holt Kontoumsätze über eine Bank-API / einen EBICS-Gateway ab.
 *
 * Es wird ein generischer HTTPS-Endpunkt aufgerufen (z. B. EBICS-Service-Provider,
 * FinTS-/Open-Banking-Gateway), der eine CAMT.053-Datei oder CSV zurückliefert.
 * Die Datei wird im Storage-Bucket `bank-statements` abgelegt und als
 * Import-Datensatz registriert; die Verarbeitung erfolgt im Import-Tab.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BANK_API_TOKEN = Deno.env.get('BANK_API_TOKEN') ?? '';

const SETTINGS_KEY = 'bank_api_connections';

interface Conn {
  id: string;
  label: string;
  bank_account_id: string;
  accounting_area: 'EU' | 'CH';
  endpoint_url: string;
  auth_header?: string;   // z. B. "Authorization: Bearer" – Token kommt aus dem Secret
  format: 'camt053' | 'camt052' | 'csv' | 'mt940';
  days_back: number;
  enabled: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const out = { fetched: 0, files: [] as string[], errors: [] as string[] };

  try {
    let onlyId: string | null = null;
    try { onlyId = (await req.json())?.connectionId ?? null; } catch { /* cron */ }

    const { data: setting } = await supabase
      .from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
    const conns: Conn[] = ((setting?.value as any)?.connections ?? []) as Conn[];
    const targets = conns.filter(c => c.enabled && (!onlyId || c.id === onlyId));

    if (!targets.length) {
      return new Response(JSON.stringify({ ...out, message: 'Keine aktive Bank-API-Verbindung konfiguriert' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!BANK_API_TOKEN) {
      return new Response(JSON.stringify({ ...out, error: 'BANK_API_TOKEN ist nicht hinterlegt' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const c of targets) {
      try {
        const to = new Date();
        const from = new Date(); from.setDate(from.getDate() - (c.days_back || 7));
        const url = new URL(c.endpoint_url);
        url.searchParams.set('from', from.toISOString().slice(0, 10));
        url.searchParams.set('to', to.toISOString().slice(0, 10));
        url.searchParams.set('format', c.format);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${BANK_API_TOKEN}`, Accept: '*/*' },
        });
        if (!res.ok) {
          const body = await res.text();
          out.errors.push(`${c.label} [${res.status}]: ${body.slice(0, 300)}`);
          continue;
        }
        const content = await res.text();
        const ext = c.format === 'csv' ? 'csv' : c.format === 'mt940' ? 'sta' : 'xml';
        const path = `api/${c.accounting_area}/${c.id}/${Date.now()}.${ext}`;

        const up = await supabase.storage.from('bank-statements')
          .upload(path, new Blob([content]), { contentType: 'text/plain', upsert: false });
        if (up.error) { out.errors.push(`${c.label}: ${up.error.message}`); continue; }

        await supabase.from('bank_imports').insert({
          bank_account_id: c.bank_account_id,
          accounting_area: c.accounting_area,
          file_name: path.split('/').pop(),
          file_path: path,
          file_format: c.format,
          status: 'abgerufen',
          source: 'bank_api',
          notes: `Automatischer Abruf über ${c.label} (${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)})`,
        } as any);

        out.fetched++;
        out.files.push(path);
      } catch (e) {
        out.errors.push(`${c.label}: ${String((e as Error).message ?? e)}`);
      }
    }

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('bank-api-fetch failed:', e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
