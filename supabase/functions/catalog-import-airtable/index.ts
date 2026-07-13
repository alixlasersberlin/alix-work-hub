// Airtable-Import via Connector Gateway → catalog_items
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY = 'https://connector-gateway.lovable.dev/airtable';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const AIRTABLE_API_KEY = Deno.env.get('AIRTABLE_API_KEY');
    if (!LOVABLE_API_KEY || !AIRTABLE_API_KEY) throw new Error('Airtable-Connector nicht konfiguriert');

    const body = await req.json();
    const { action, baseId, tableId, mapping, sourceId } = body ?? {};

    const gw = async (path: string) => {
      const r = await fetch(`${GATEWAY}${path}`, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': AIRTABLE_API_KEY,
        },
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`Airtable ${r.status}: ${text.slice(0, 300)}`);
      return JSON.parse(text);
    };

    if (action === 'list_bases') {
      const data = await gw('/v0/meta/bases');
      return json({ bases: data.bases ?? [] });
    }
    if (action === 'list_tables') {
      const data = await gw(`/v0/meta/bases/${baseId}/tables`);
      return json({ tables: data.tables ?? [] });
    }
    if (action === 'preview') {
      const data = await gw(`/v0/${baseId}/${encodeURIComponent(tableId)}?maxRecords=5`);
      return json({ records: data.records ?? [] });
    }
    if (action === 'import') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: job } = await supabase.from('catalog_import_jobs_v2').insert({
        source_id: sourceId ?? null, kind: 'airtable', status: 'running',
      }).select('id').single();

      let inserted = 0, updated = 0, skipped = 0, offset: string | undefined = undefined;
      const errors: string[] = [];
      do {
        const q = new URLSearchParams({ pageSize: '100' });
        if (offset) q.set('offset', offset);
        const data: any = await gw(`/v0/${baseId}/${encodeURIComponent(tableId)}?${q}`);
        for (const rec of data.records ?? []) {
          const f = rec.fields ?? {};
          const sku = f[mapping.sku] ?? rec.id;
          const name = f[mapping.name] ?? f[mapping.sku] ?? 'Unbenannt';
          if (!sku || !name) { skipped++; continue; }
          const payload: any = {
            sku: String(sku), name: String(name),
            brand: mapping.brand ? f[mapping.brand] : null,
            model: mapping.model ? f[mapping.model] : null,
            notes_internal: mapping.notes ? f[mapping.notes] : null,
            status: 'entwurf',
          };
          const { data: existing } = await supabase.from('catalog_items').select('id').eq('sku', payload.sku).maybeSingle();
          if (existing) {
            const { error } = await supabase.from('catalog_items').update(payload).eq('id', existing.id);
            if (error) errors.push(`${payload.sku}: ${error.message}`); else updated++;
          } else {
            const { error } = await supabase.from('catalog_items').insert(payload);
            if (error) errors.push(`${payload.sku}: ${error.message}`); else inserted++;
          }
        }
        offset = data.offset;
      } while (offset);

      await supabase.from('catalog_import_jobs_v2').update({
        status: errors.length ? 'partial' : 'success',
        stats: { inserted, updated, skipped, errors: errors.length },
        log: errors.slice(0, 20).join('\n'),
        finished_at: new Date().toISOString(),
      }).eq('id', job!.id);
      if (sourceId) await supabase.from('catalog_import_sources').update({
        last_run_at: new Date().toISOString(),
        last_status: errors.length ? 'partial' : 'success',
      }).eq('id', sourceId);

      return json({ jobId: job!.id, inserted, updated, skipped, errors });
    }
    throw new Error('unknown action');
  } catch (e: any) {
    return json({ error: e.message }, 400);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
