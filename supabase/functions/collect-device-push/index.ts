// ALIX COLLECT – Sperr-/Entsperr-Befehle an AlixSmart-Geräte pushen
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin'];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const cronSecret = req.headers.get('x-cron-secret');
    const bearer = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const isCron = (!!cronSecret && cronSecret === (Deno.env.get('CRON_SECRET') ?? ''))
      || (!!bearer && bearer === SERVICE_KEY);
    let actor: string | null = null;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
      actor = user.id;
      const { data: rolesRows } = await admin.from('user_roles').select('roles(name)').eq('user_id', user.id);
      const roleNames = (rolesRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!roleNames.some((n: string) => ALLOWED.includes(n))) return json({ error: 'Keine Berechtigung' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const deviceLinkId: string | null = body?.device_link_id ?? null;

    let query = admin.from('collect_device_links').select('*');
    if (deviceLinkId) query = query.eq('id', deviceLinkId);
    else query = query.or('push_status.is.null,push_status.eq.pending').limit(200);

    const { data: links, error } = await query;
    if (error) throw new Error(error.message);
    if (!links?.length) return json({ success: true, pushed: 0, message: 'Nichts zu übertragen' });

    let pushed = 0;
    const failures: string[] = [];

    for (const l of links) {
      const blocked = !!(l.spare_parts_block || l.comfort_features_block);
      const eventType = blocked ? 'collect_block' : 'collect_unblock';

      const { error: evErr } = await admin.from('alixsmart_events').insert({
        device_serial: l.device_serial ?? l.serial_number,
        event_type: eventType,
        event_at: new Date().toISOString(),
        payload: {
          source: 'alix_collect',
          case_id: l.case_id,
          customer_name: l.customer_name,
          spare_parts_block: !!l.spare_parts_block,
          comfort_features_block: !!l.comfort_features_block,
          serial_number: l.serial_number ?? null,
          reason: l.block_note ?? 'Zahlungsverzug',
        },
      });

      if (evErr) {
        console.error('push failed', l.id, evErr.message);
        failures.push(`${l.device_serial ?? l.serial_number}: ${evErr.message}`);
        await admin.from('collect_device_links').update({ push_status: 'failed' }).eq('id', l.id);
        continue;
      }

      await admin.from('collect_device_links').update({
        push_status: 'pushed',
        pushed_at: new Date().toISOString(),
      }).eq('id', l.id);
      pushed++;

      if (l.case_id) {
        await admin.from('collect_events').insert({
          case_id: l.case_id,
          event_type: blocked ? 'device_blocked' : 'device_unblocked',
          channel: 'device',
          direction: 'outbound',
          subject: `${blocked ? 'Sperre' : 'Entsperrung'} an Gerät ${l.device_serial ?? l.serial_number} übertragen`,
          actor,
          automated: isCron,
          meta: { device_serial: l.device_serial ?? l.serial_number, blocked },
        });
      }
    }

    return json({ success: true, pushed, failed: failures.length, failures });
  } catch (e: any) {
    console.error('collect-device-push error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
