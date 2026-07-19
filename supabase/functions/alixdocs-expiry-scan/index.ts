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

  // Recipients: Admin + Super Admin
  const { data: recipients } = await admin
    .from('user_roles')
    .select('user_id, roles:role_id(name)');
  const targetUserIds = Array.from(new Set(
    (recipients ?? [])
      .filter((r: any) => ['Admin', 'Super Admin'].includes(r.roles?.name))
      .map((r: any) => r.user_id as string),
  ));

  let created = 0;
  for (const d of docs ?? []) {
    const daysLeft = Math.round((new Date(d.expiry_date!).getTime() - new Date(today).getTime()) / 86400000);
    if (daysLeft > (d.expiry_warning_days ?? 30) || daysLeft < -1) continue;

    for (const uid of targetUserIds) {
      const { data: recent } = await admin.from('app_notifications')
        .select('id').eq('user_id', uid).eq('category', 'alixdocs_expiry')
        .contains('metadata', { document_id: d.id })
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).limit(1);
      if (recent && recent.length) continue;

      await admin.from('app_notifications').insert({
        user_id: uid,
        category: 'alixdocs_expiry',
        priority: daysLeft <= 7 ? 'high' : 'normal',
        title: `Dokument läuft ab: ${d.title}`,
        message: daysLeft < 0
          ? `Ablauf war vor ${Math.abs(daysLeft)} Tag(en).`
          : `Ablauf in ${daysLeft} Tag(en) (${d.expiry_date}).`,
        action_url: '/dokumente',
        metadata: { document_id: d.id, order_id: d.order_id, expiry_date: d.expiry_date },
      });
      created++;
    }
  }


  return new Response(JSON.stringify({ ok: true, checked: docs?.length ?? 0, created }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
