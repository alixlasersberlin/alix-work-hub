// Katalog-Reminders: scannt Katalog auf fehlende Übersetzungen, veraltete Preise, fehlende Bilder
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: rules } = await supabase.from('catalog_reminder_rules').select('*').eq('enabled', true);
    let total = 0;
    for (const rule of rules ?? []) {
      const cutoff = new Date(Date.now() - rule.threshold_days * 86400000).toISOString();
      let entries: any[] = [];

      if (rule.kind === 'stale_price') {
        const { data } = await supabase.from('catalog_item_prices')
          .select('id, item_id, updated_at, country_code, catalog_items(name, sku)')
          .lt('updated_at', cutoff).limit(200);
        entries = (data ?? []).map((r: any) => ({
          target_type: 'price', target_id: r.id,
          target_label: `${r.catalog_items?.sku ?? ''} · ${r.country_code}`,
          details: { updated_at: r.updated_at, days_old: rule.threshold_days },
        }));
      } else if (rule.kind === 'missing_translation') {
        const { data: langs } = await supabase.from('catalog_languages').select('code').eq('is_active', true);
        const { data: items } = await supabase.from('catalog_items').select('id, sku, name').in('status', ['aktiv', 'freigegeben']).limit(500);
        const { data: descs } = await supabase.from('catalog_item_descriptions').select('item_id, language_code').eq('status', 'freigegeben');
        const have = new Set((descs ?? []).map((d: any) => `${d.item_id}:${d.language_code}`));
        for (const it of items ?? []) {
          for (const l of langs ?? []) {
            if (!have.has(`${it.id}:${l.code}`)) {
              entries.push({
                target_type: 'translation', target_id: it.id,
                target_label: `${it.sku} · ${l.code}`,
                details: { language: l.code },
              });
              if (entries.length >= 200) break;
            }
          }
          if (entries.length >= 200) break;
        }
      } else if (rule.kind === 'missing_image') {
        const { data } = await supabase.from('catalog_items').select('id, sku, name')
          .in('status', ['aktiv', 'freigegeben']).limit(500);
        const { data: imgs } = await supabase.from('catalog_item_images').select('item_id');
        const withImg = new Set((imgs ?? []).map((i: any) => i.item_id));
        entries = (data ?? []).filter((i: any) => !withImg.has(i.id)).map((i: any) => ({
          target_type: 'item', target_id: i.id, target_label: `${i.sku} · ${i.name}`,
          details: { missing: 'image' },
        }));
      }

      for (const e of entries) {
        await supabase.from('catalog_reminder_log_v2').upsert({
          rule_id: rule.id, ...e, notified_emails: rule.notify_emails ?? [],
        });
        total++;
      }
      await supabase.from('catalog_reminder_rules').update({ last_run_at: new Date().toISOString() }).eq('id', rule.id);
    }
    return new Response(JSON.stringify({ ok: true, total }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
