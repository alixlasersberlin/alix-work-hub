// Import Produkte von einer Website via Firecrawl → catalog_items
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const FC_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FC_KEY) throw new Error('Firecrawl-Connector nicht konfiguriert');

    const { action, url, urls, limit, sourceId } = await req.json();

    if (action === 'map') {
      const r = await fetch('https://api.firecrawl.dev/v2/map', {
        method: 'POST',
        headers: { Authorization: `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit: limit ?? 100, includeSubdomains: false }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `Firecrawl ${r.status}`);
      return json({ links: data.links ?? data.data?.links ?? [] });
    }

    if (action === 'import') {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: job } = await supabase.from('catalog_import_jobs_v2').insert({
        source_id: sourceId ?? null, kind: 'website', status: 'running',
      }).select('id').single();

      let inserted = 0, updated = 0, skipped = 0;
      const errors: string[] = [];
      for (const u of (urls ?? []).slice(0, 50)) {
        try {
          const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: { Authorization: `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: u, onlyMainContent: true,
              formats: [{ type: 'json', prompt: 'Extract product data: {name, sku, brand, model, description, price_eur}' }],
            }),
          });
          const data = await r.json();
          const doc = data.data ?? data;
          const p = doc.json ?? {};
          const name = p.name || doc.metadata?.title || u;
          const sku = p.sku || u.replace(/[^a-zA-Z0-9]/g, '_').slice(-40);
          const payload: any = {
            sku, name,
            brand: p.brand ?? null,
            model: p.model ?? null,
            notes_internal: `Quelle: ${u}`,
            status: 'entwurf',
          };
          const { data: existing } = await supabase.from('catalog_items').select('id').eq('sku', sku).maybeSingle();
          if (existing) {
            const { error } = await supabase.from('catalog_items').update(payload).eq('id', existing.id);
            if (error) errors.push(`${sku}: ${error.message}`); else updated++;
          } else {
            const { error } = await supabase.from('catalog_items').insert(payload);
            if (error) errors.push(`${sku}: ${error.message}`); else inserted++;
          }
        } catch (e: any) {
          errors.push(`${u}: ${e.message}`); skipped++;
        }
      }

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
