// AlixDocs — Ablauf-Warnungen: erzeugt app_notifications für Dokumente,
// deren expiry_date in <= expiry_warning_days fällt.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const today = new Date().toISOString().slice(0, 10);
  const { data: docs } = await admin
    .from('alixdocs_documents')
    .select('id, title, expiry_date, expiry_warning_days, order_id')
    .not('expiry_date', 'is', null)
    .is('deleted_at', null);

  let created = 0;
  for (const d of docs ?? []) {
    const daysLeft = Math.round((new Date(d.expiry_date!).getTime() - new Date(today).getTime()) / 86400000);
    if (daysLeft > (d.expiry_warning_days ?? 30) || daysLeft < -1) continue;

    // De-dupe: 1 Notification pro Dokument alle 7 Tage
    const { data: recent } = await admin.from('app_notifications')
      .select('id').eq('type', 'alixdocs_expiry').contains('metadata', { document_id: d.id })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).limit(1);
    if (recent && recent.length) continue;

    await admin.from('app_notifications').insert({
      type: 'alixdocs_expiry',
      title: `Dokument läuft ab: ${d.title}`,
      body: daysLeft < 0
        ? `Ablauf war vor ${Math.abs(daysLeft)} Tag(en).`
        : `Ablauf in ${daysLeft} Tag(en) (${d.expiry_date}).`,
      severity: daysLeft <= 7 ? 'warning' : 'info',
      metadata: { document_id: d.id, order_id: d.order_id, expiry_date: d.expiry_date },
      target_role: 'Admin',
    });
    created++;
  }

  return new Response(JSON.stringify({ ok: true, checked: docs?.length ?? 0, created }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
