// Reminder Scheduler: findet fällige appointment_reminders und versendet Web-Push.
// Läuft per Cron alle 60 s. Auth: CRON_SECRET oder service role.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:it@alixwork.de';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!token || (token !== cronSecret && token !== serviceKey)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const svc = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const now = new Date();
  const { data: due, error } = await svc
    .from('appointment_reminders')
    .select('*')
    .eq('status', 'planned')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(100);
  if (error) return json({ error: error.message }, 500);

  let sent = 0, failed = 0, skipped = 0;

  for (const r of due ?? []) {
    // Mark processing
    await svc.from('appointment_reminders').update({ status: 'processing', processed_at: now.toISOString() }).eq('id', r.id);

    // User-Präferenzen laden
    const { data: prefs } = await svc.from('notification_preferences').select('*').eq('user_id', r.user_id).maybeSingle();
    if (prefs && !prefs.push_enabled) {
      await svc.from('appointment_reminders').update({ status: 'cancelled', error_message: 'push_disabled' }).eq('id', r.id);
      skipped++; continue;
    }
    if (prefs && !prefs.weekend_enabled) {
      const dow = now.getDay(); // 0=Sun,6=Sat
      if ((dow === 0 || dow === 6) && (r.payload?.escalation_level ?? 0) < 3) {
        await svc.from('appointment_reminders').update({ status: 'cancelled', error_message: 'weekend_off' }).eq('id', r.id);
        skipped++; continue;
      }
    }
    // Ruhezeiten (nur für nicht-eskalierte)
    if (prefs?.quiet_hours_start && prefs?.quiet_hours_end && (r.payload?.escalation_level ?? 0) < 3) {
      const hhmm = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
      const s = prefs.quiet_hours_start.slice(0,5), e = prefs.quiet_hours_end.slice(0,5);
      const inQuiet = s < e ? (hhmm >= s && hhmm < e) : (hhmm >= s || hhmm < e);
      if (inQuiet) {
        // In 30 min erneut versuchen
        await svc.from('appointment_reminders').update({
          status: 'planned',
          scheduled_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          retry_count: (r.retry_count ?? 0) + 1,
          error_message: 'quiet_hours_deferred',
        }).eq('id', r.id);
        skipped++; continue;
      }
    }

    // Push-Payload zusammenstellen (Privacy-Mode = keine Kundendaten)
    const privacy = prefs?.privacy_mode ?? true;
    const minsAbs = Math.abs(Math.round((new Date(r.payload?.eventStart || Date.now()).getTime() - now.getTime()) / 60000));
    const title = r.payload?.escalation_level >= 3
      ? 'Dringende Termin-Eskalation'
      : (r.payload?.escalation_level >= 2 ? 'Termin beginnt gleich' : 'AlixWork Kalender');
    const body = privacy
      ? `Ein Termin steht an: ${r.payload?.title ?? ''}`.slice(0, 120)
      : `${r.payload?.title ?? ''}${r.payload?.customer ? ' · ' + r.payload.customer : ''}${r.payload?.location ? ' · ' + r.payload.location : ''}`.slice(0, 160);
    const push = {
      title,
      body,
      url: `/m/kalender/termin/${r.event_id}`,
      eventId: r.event_id,
      reminderId: r.id,
      tag: `event-${r.event_id}`,
      requireInteraction: (r.payload?.escalation_level ?? 0) >= 3,
      vibrate: prefs?.vibration_enabled === false ? [] : [200, 100, 200],
    };

    // Alle aktiven Subscriptions dieses Users
    const { data: subs } = await svc.from('mobile_push_subscriptions').select('*').eq('user_id', r.user_id);
    if (!subs || subs.length === 0) {
      await svc.from('appointment_reminders').update({ status: 'failed', error_message: 'no_subscription' }).eq('id', r.id);
      failed++; continue;
    }

    let anySuccess = false;
    for (const s of subs) {
      try {
        if (s.platform === 'ios' || s.platform === 'android') {
          // Native Push über push-send-native Function
          const res = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/push-send-native`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                user_id: r.user_id,
                title: push.title,
                body: push.body,
                url: push.url,
                data: { eventId: r.event_id, reminderId: r.id },
              }),
            },
          );
          if (res.ok) {
            anySuccess = true;
            await svc.from('mobile_push_subscriptions').update({ last_seen_at: now.toISOString() }).eq('id', s.id);
          }
          // native-send bündelt alle nativen Subs eines Users – nur einmal aufrufen
          break;
        } else {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
            JSON.stringify(push),
          );
          anySuccess = true;
          await svc.from('mobile_push_subscriptions').update({ last_seen_at: now.toISOString() }).eq('id', s.id);
        }
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await svc.from('mobile_push_subscriptions').delete().eq('id', s.id);
        }
      }
    }

    if (anySuccess) {
      // In-App-Benachrichtigung anlegen
      await svc.from('app_notifications').insert({
        user_id: r.user_id,
        event_id: r.event_id,
        category: 'appointment',
        title: push.title,
        message: push.body,
        priority: (r.payload?.escalation_level ?? 0) >= 3 ? 'urgent' : ((r.payload?.escalation_level ?? 0) >= 2 ? 'high' : 'normal'),
        action_url: push.url,
      });
      await svc.from('appointment_reminders').update({ status: 'sent', delivered_at: now.toISOString() }).eq('id', r.id);
      sent++;
    } else {
      const retries = (r.retry_count ?? 0) + 1;
      await svc.from('appointment_reminders').update({
        status: retries >= 3 ? 'failed' : 'planned',
        scheduled_at: new Date(Date.now() + Math.pow(2, retries) * 60000).toISOString(),
        retry_count: retries,
        error_message: 'push_failed',
      }).eq('id', r.id);
      failed++;
    }
  }

  return json({ ok: true, processed: due?.length ?? 0, sent, failed, skipped });
});

function json(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
