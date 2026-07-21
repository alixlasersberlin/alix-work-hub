import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Cron-Tick (alle 5 Minuten). Verarbeitet fällige ac_journey_runs.
 * Step-Kinds: send_email | send_sms | send_whatsapp | wait | condition
 */
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function sendEmail(to: string, subject: string, body: string) {
  const { error } = await sb.functions.invoke('send-email', {
    body: { to, subject: subject || '(kein Betreff)', html: body.replace(/\n/g, '<br/>') },
  });
  if (error) throw new Error(error.message);
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

function render(tpl: string, ctx: Record<string, any>) {
  return (tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => String(ctx[k] ?? ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const nowIso = new Date().toISOString();
    const { data: runs } = await sb.from('ac_journey_runs')
      .select('id,journey_id,contact_id,current_step,context')
      .eq('status', 'active')
      .lte('next_action_at', nowIso)
      .order('next_action_at', { ascending: true })
      .limit(100);

    let processed = 0, done = 0, failed = 0, waiting = 0;

    for (const run of runs ?? []) {
      try {
        const { data: steps } = await sb.from('ac_journey_steps')
          .select('id,position,kind,config').eq('journey_id', (run as any).journey_id)
          .order('position', { ascending: true });
        const step = (steps ?? [])[(run as any).current_step];
        if (!step) {
          await sb.from('ac_journey_runs').update({
            status: 'completed', completed_at: nowIso,
          }).eq('id', (run as any).id);
          done++; continue;
        }

        const { data: contact } = await sb.from('ac_contacts')
          .select('display_name,email,phone,email_opt_out,sms_opt_out')
          .eq('id', (run as any).contact_id).maybeSingle();
        const ctx = { ...(run as any).context, name: contact?.display_name ?? '' };
        const cfg = step.config ?? {};

        if (step.kind === 'wait') {
          const mins = Number(cfg.minutes ?? 60);
          await sb.from('ac_journey_runs').update({
            current_step: (run as any).current_step + 1,
            next_action_at: new Date(Date.now() + mins * 60000).toISOString(),
          }).eq('id', (run as any).id);
          waiting++; processed++; continue;
        }

        if (step.kind === 'send_email' && contact?.email && !contact?.email_opt_out) {
          await sendEmail(contact.email, render(cfg.subject ?? '', ctx), render(cfg.body ?? '', ctx));
        } else if (step.kind === 'send_sms' && contact?.phone && !contact?.sms_opt_out) {
          await sendSms(contact.phone, render(cfg.body ?? '', ctx));
        } else if (step.kind === 'send_whatsapp' && contact?.phone) {
          await sendWhatsApp(contact.phone, render(cfg.body ?? '', ctx));
        }
        // condition: einfach überspringen, falls Bedingung nicht erfüllt (v1)

        await sb.from('ac_journey_runs').update({
          current_step: (run as any).current_step + 1,
          next_action_at: nowIso, last_error: null,
        }).eq('id', (run as any).id);
        processed++;
      } catch (e: any) {
        failed++;
        await sb.from('ac_journey_runs').update({
          status: 'failed', last_error: String(e?.message ?? e), completed_at: nowIso,
        }).eq('id', (run as any).id);
      }
    }

    return new Response(JSON.stringify({ scanned: runs?.length ?? 0, processed, done, failed, waiting }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'internal' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
