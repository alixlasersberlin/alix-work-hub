import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function sendWhatsApp(to: string, body: string) {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) throw new Error('WhatsApp secrets missing');
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${await r.text()}`);
}
async function sendSms(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !auth || !from) throw new Error('Twilio secrets missing');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${auth}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
}
async function sendEmail(to: string, subject: string, body: string) {
  const { error } = await admin.functions.invoke('send-email', {
    body: { to, subject: subject || '(kein Betreff)', html: body.replace(/\n/g, '<br/>') },
  });
  if (error) throw new Error(`send-email: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: 'Unauthorized' }, 401);
    const { data: isAdmin } = await userClient.rpc('has_role', { check_role: 'Admin' });
    const { data: isSA } = await userClient.rpc('has_role', { check_role: 'Super Admin' });
    if (!isAdmin && !isSA) return json({ error: 'forbidden' }, 403);

    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: 'campaign_id required' }, 400);

    const { data: camp } = await admin.from('ac_campaigns').select('*').eq('id', campaign_id).single();
    if (!camp) return json({ error: 'campaign not found' }, 404);
    if (!['draft', 'scheduled', 'failed'].includes(camp.status)) return json({ error: `status ${camp.status}` }, 400);

    await admin.from('ac_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', campaign_id);

    // A/B-Varianten vorbereiten
    const variants: Array<{ label: string; subject?: string; body: string; weight: number }> =
      Array.isArray(camp.ab_variants) && camp.is_ab_test && camp.ab_variants.length > 0
        ? camp.ab_variants
        : [{ label: 'A', subject: camp.subject ?? '', body: camp.body, weight: 1 }];
    const totalWeight = variants.reduce((s, v) => s + (Number(v.weight) || 1), 0);
    function pickVariant() {
      let r = Math.random() * totalWeight;
      for (const v of variants) { r -= (Number(v.weight) || 1); if (r <= 0) return v; }
      return variants[0];
    }

    const { data: recs } = await admin
      .from('ac_campaign_recipients')
      .select('id, address, variant')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending');

    let sent = 0, failed = 0;
    for (const r of recs ?? []) {
      try {
        const v = (r as any).variant
          ? (variants.find((x) => x.label === (r as any).variant) ?? pickVariant())
          : pickVariant();
        if (camp.channel_type === 'whatsapp') await sendWhatsApp(r.address, v.body);
        else if (camp.channel_type === 'sms') await sendSms(r.address, v.body);
        else if (camp.channel_type === 'email') await sendEmail(r.address, v.subject ?? '', v.body);
        await admin.from('ac_campaign_recipients').update({
          status: 'sent', sent_at: new Date().toISOString(), variant: v.label,
        }).eq('id', r.id);
        sent++;
      } catch (e) {
        await admin.from('ac_campaign_recipients').update({ status: 'failed', error: String((e as Error).message ?? e) }).eq('id', r.id);
        failed++;
      }
    }

    await admin.from('ac_campaigns').update({
      status: failed > 0 && sent === 0 ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
    }).eq('id', campaign_id);

    return json({ ok: true, sent, failed, variants: variants.length });
  } catch (e) {
    console.error('ac-campaign-run', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
