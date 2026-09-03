// send-mobile-notification
// Serverseitiger Push-Dispatch für ALIXWORK MOBILE.
// - Empfänger werden IMMER serverseitig ermittelt (niemals blind aus dem Client übernommen)
// - Preferences, Ruhezeiten, Preview-Datenschutz, Dedup, Burst-Debounce, Retry
// - Transport: FCM (Android), APNs (iOS), Web-Push (PWA-Fallback)
// - Protokollierung in notification_events + In-App in app_notifications
//
// Secrets (nur serverseitig): FCM_SERVICE_ACCOUNT_JSON, APNS_KEY_P8, APNS_KEY_ID,
// APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_USE_SANDBOX, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';
import { z } from 'https://esm.sh/zod@3.23.8';
import { sendFcm, sendApns, fcmConfigured, apnsConfigured, type NativePayload } from './native.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BodySchema = z.object({
  notification_type: z.enum([
    'NEW_MESSAGE', 'ASSIGNED', 'P1_ALERT', 'P2_ALERT', 'ESCALATION',
    'TICKET_CREATED', 'TICKET_ASSIGNED', 'SYSTEM', 'TEST',
  ]),
  conversation_id: z.string().uuid().optional(),
  message_id: z.string().uuid().optional(),
  priority: z.string().max(4).optional(),
  target_user_ids: z.array(z.string().uuid()).max(50).optional(),
  target_role: z.string().max(60).optional(),
  exclude_user_id: z.string().uuid().optional(),
  title: z.string().max(120).optional(),
  body: z.string().max(400).optional(),
  url: z.string().max(300).optional(),
  dedup_suffix: z.string().max(60).optional(),
});

const DEPT_ROLES: Record<string, string[]> = {
  TECHNIK: ['Service', 'Serviceleitung', 'Reparaturannahme', 'Technik', 'After Sales'],
  SALES: ['Vertrieb', 'Vertriebsleitung', 'Order'],
  SERVICE: ['Service', 'Serviceleitung', 'Kundenservice', 'After Sales'],
  ZENTRALE: ['Admin', 'Super Admin', 'SACHBEARBEITUNG'],
  SCHULUNG: ['Service', 'Serviceleitung'],
};

const CHANNEL_LABEL: Record<string, string> = {
  TECHNIK: 'ALIX TECHNIK', SALES: 'ALIX SALES', SERVICE: 'ALIX SERVICE',
  ZENTRALE: 'ALIX ZENTRALE', SCHULUNG: 'ALIX SCHULUNG',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function inQuietHours(now: Date, tz: string, start?: string | null, end?: string | null) {
  if (!start || !end) return false;
  const local = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'Europe/Berlin',
  }).format(now);
  const cur = Number(local.slice(0, 2)) * 60 + Number(local.slice(3, 5));
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

async function usersForRoles(roleNames: string[]): Promise<string[]> {
  if (!roleNames.length) return [];
  const { data: roles } = await admin.from('roles').select('id, name').in('name', roleNames);
  const ids = (roles ?? []).map((r: any) => r.id);
  if (!ids.length) return [];
  const { data } = await admin.from('user_roles').select('user_id').in('role_id', ids);
  return Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const isInternal = bearer && bearer === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    let callerId: string | null = null;
    if (!isInternal) {
      const { data } = await admin.auth.getUser(bearer);
      callerId = data?.user?.id ?? null;
      if (!callerId) return json({ error: 'unauthorized' }, 401);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const p = parsed.data;

    // Nicht-interne Aufrufe dürfen ausschließlich einen Test-Push an sich selbst auslösen.
    if (!isInternal && !(p.notification_type === 'TEST' || p.notification_type === 'SYSTEM')) {
      return json({ error: 'forbidden: only TEST notifications allowed for client callers' }, 403);
    }

    // --- Conversation-Kontext (serverseitige Wahrheit) ---
    let conv: any = null;
    if (p.conversation_id) {
      const { data } = await admin.from('ac_conversations')
        .select('id, assigned_to, assigned_department, category, priority, inbox_status, channel_id, customer_id, contact_id, last_message_preview, is_test, ac_contacts(full_name), customers(company_name)')
        .eq('id', p.conversation_id).maybeSingle();
      conv = data ?? null;
    }
    const priority = (p.priority || conv?.priority || 'P3').toUpperCase();
    const dept = (conv?.assigned_department || conv?.category || 'ZENTRALE').toUpperCase();

    // --- Empfänger ermitteln ---
    let recipients: string[] = [];
    if (!isInternal) {
      recipients = [callerId!];
    } else if (p.target_user_ids?.length) {
      recipients = p.target_user_ids;
    } else if (p.target_role) {
      recipients = await usersForRoles([p.target_role]);
    } else if (conv?.assigned_to) {
      recipients = [conv.assigned_to];
    } else {
      recipients = await usersForRoles(DEPT_ROLES[dept] ?? DEPT_ROLES.ZENTRALE);
    }
    if (p.exclude_user_id) recipients = recipients.filter((u) => u !== p.exclude_user_id);
    recipients = Array.from(new Set(recipients.filter(Boolean)));
    if (!recipients.length) return json({ ok: true, recipients: 0, sent: 0, skipped: 0 });

    const customerLabel = conv?.customers?.company_name || conv?.ac_contacts?.full_name || 'Kunde';
    const channelLabel = priority === 'P1' ? 'ALIX PRIORITÄT P1' : (CHANNEL_LABEL[dept] ?? 'ALIXWORK');
    const preview = p.body ?? conv?.last_message_preview ?? '';
    const deepLink = p.url ?? (p.conversation_id ? `/mobil/inbox/${p.conversation_id}` : '/mobil/benachrichtigungen');

    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:it@alix-lasers.com', VAPID_PUBLIC, VAPID_PRIVATE);
    }

    const now = new Date();
    let sent = 0, failed = 0, skipped = 0;
    const diagnostics: any[] = [];

    for (const userId of recipients) {
      // Preferences
      const { data: prefRow } = await admin.from('notification_preferences')
        .select('*').eq('user_id', userId).maybeSingle();
      const pref: any = prefRow ?? {};
      const enabled = pref.push_enabled ?? true;
      const typeOk = (() => {
        switch (p.notification_type) {
          case 'NEW_MESSAGE': return (pref.new_messages ?? true)
            && (dept !== 'TECHNIK' || (pref.technical_messages ?? true))
            && (dept !== 'SALES' || (pref.sales_messages ?? true));
          case 'ASSIGNED': return pref.assigned_messages ?? true;
          case 'P1_ALERT': return pref.priority_p1 ?? true;
          case 'P2_ALERT': return pref.priority_p2 ?? true;
          case 'ESCALATION': return pref.escalations_enabled ?? true;
          case 'TICKET_CREATED':
          case 'TICKET_ASSIGNED': return pref.ticket_notifications ?? true;
          default: return true;
        }
      })();

      const quiet = (pref.quiet_hours_enabled ?? false)
        && inQuietHours(now, pref.timezone ?? 'Europe/Berlin', pref.quiet_hours_start, pref.quiet_hours_end)
        && !(priority === 'P1' && (pref.p1_ignores_quiet_hours ?? true));

      const dedupKey = `${p.notification_type}:${p.message_id ?? p.conversation_id ?? 'na'}:${userId}:${p.dedup_suffix ?? ''}`;

      // Burst-Debounce: gleiche Conversation, gleicher User, < 60s (außer P1)
      let burst = false;
      if (p.notification_type === 'NEW_MESSAGE' && priority !== 'P1' && p.conversation_id) {
        const { data: recent } = await admin.from('notification_events')
          .select('id').eq('user_id', userId).eq('conversation_id', p.conversation_id)
          .eq('notification_type', 'NEW_MESSAGE').eq('status', 'SENT')
          .gte('created_at', new Date(now.getTime() - 60_000).toISOString()).limit(1);
        burst = !!recent?.length;
      }

      const skipReason = !enabled ? 'push_disabled' : !typeOk ? 'type_disabled'
        : quiet ? 'quiet_hours' : burst ? 'burst_debounce' : null;

      const previewOn = pref.preview_enabled ?? true;
      const title = previewOn ? `${channelLabel} · ${customerLabel}` : 'ALIXWORK';
      const bodyText = previewOn
        ? (p.body ?? preview ?? 'Neue Nachricht eingegangen.').slice(0, 220)
        : 'Neue Nachricht eingegangen.';

      // In-App Notification Center (immer, unabhängig vom Push-Transport)
      await admin.from('app_notifications').insert({
        user_id: userId,
        category: p.notification_type,
        title: p.title ?? title,
        message: bodyText,
        priority,
        action_url: deepLink,
        metadata: { conversation_id: p.conversation_id ?? null, message_id: p.message_id ?? null },
      });

      const { data: evt } = await admin.from('notification_events').insert({
        user_id: userId,
        conversation_id: p.conversation_id ?? null,
        message_id: p.message_id ?? null,
        notification_type: p.notification_type,
        priority,
        status: skipReason ? 'SKIPPED' : 'QUEUED',
        dedup_key: dedupKey,
        title: p.title ?? title,
        body: bodyText,
        failure_reason: skipReason,
        metadata: { department: dept, deep_link: deepLink },
      }).select('id').maybeSingle();

      if (!evt) { skipped++; diagnostics.push({ userId, skipped: 'duplicate' }); continue; }
      if (skipReason) { skipped++; diagnostics.push({ userId, skipped: skipReason }); continue; }

      // Aktive Geräte
      const { data: devices } = await admin.from('mobile_push_subscriptions')
        .select('id, platform, native_token, endpoint, p256dh, auth_key, push_provider')
        .eq('user_id', userId).is('revoked_at', null).eq('notifications_enabled', true);

      // Badge = ungelesene Conversations (nicht Nachrichten)
      const { count: badge } = await admin.from('ac_conversations')
        .select('id', { count: 'exact', head: true })
        .gt('unread_count', 0).not('inbox_status', 'in', '("RESOLVED","ARCHIVED")');

      const payload: NativePayload = {
        title: p.title ?? title,
        body: bodyText,
        url: deepLink,
        priority,
        sound: pref.sound_enabled ?? true,
        threadId: p.conversation_id ?? 'alixwork',
        badge: badge ?? undefined,
        androidChannel: p.notification_type === 'ESCALATION' ? 'alix_escalations'
          : priority === 'P1' ? 'alix_priority'
          : p.notification_type.startsWith('TICKET') ? 'alix_tickets' : 'alix_messages',
        iosCategory: p.notification_type === 'ESCALATION' ? 'ESCALATION'
          : priority === 'P1' ? 'PRIORITY_MESSAGE' : 'MESSAGE',
        data: {
          notification_type: p.notification_type,
          conversation_id: p.conversation_id ?? '',
          message_id: p.message_id ?? '',
          priority,
          channel_id: conv?.channel_id ?? '',
          event_id: evt.id,
        },
      };

      let anyOk = false;
      let lastErr = '';
      let provider = '';
      for (const d of devices ?? []) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (d.native_token && d.platform === 'android') { await sendFcm(d.native_token, payload); provider = 'fcm'; }
            else if (d.native_token && d.platform === 'ios') { await sendApns(d.native_token, payload); provider = 'apns'; }
            else if (d.endpoint && VAPID_PUBLIC && VAPID_PRIVATE) {
              await webpush.sendNotification(
                { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth_key } },
                JSON.stringify({
                  title: payload.title, body: payload.body, url: payload.url,
                  tag: payload.threadId, data: payload.data,
                  requireInteraction: priority === 'P1',
                }),
              );
              provider = 'webpush';
            } else { lastErr = 'no transport for device'; break; }
            anyOk = true;
            await admin.from('mobile_push_subscriptions')
              .update({ last_push_ok_at: new Date().toISOString(), last_push_error: null }).eq('id', d.id);
            break;
          } catch (e: any) {
            lastErr = String(e?.message ?? e);
            const invalid = /404|410|Unregistered|BadDeviceToken/i.test(lastErr);
            if (invalid) {
              await admin.from('mobile_push_subscriptions')
                .update({ notifications_enabled: false, last_push_error: lastErr, last_push_error_at: new Date().toISOString() })
                .eq('id', d.id);
              break;
            }
            if (attempt === 3) {
              await admin.from('mobile_push_subscriptions')
                .update({ last_push_error: lastErr, last_push_error_at: new Date().toISOString() }).eq('id', d.id);
            } else {
              await new Promise((r) => setTimeout(r, attempt * 300));
            }
          }
        }
      }

      await admin.from('notification_events').update({
        status: anyOk ? 'SENT' : 'FAILED',
        provider: provider || null,
        sent_at: anyOk ? new Date().toISOString() : null,
        failed_at: anyOk ? null : new Date().toISOString(),
        failure_reason: anyOk ? null : (lastErr || 'no active devices'),
        attempt: 1,
      }).eq('id', evt.id);

      anyOk ? sent++ : failed++;
      diagnostics.push({ userId, devices: devices?.length ?? 0, ok: anyOk, error: anyOk ? null : lastErr });
    }

    return json({
      ok: true,
      recipients: recipients.length,
      sent, failed, skipped,
      transports: { fcm: fcmConfigured(), apns: apnsConfigured(), webpush: !!(VAPID_PUBLIC && VAPID_PRIVATE) },
      diagnostics: isInternal || diagnostics.length <= 1 ? diagnostics : undefined,
    });
  } catch (e: any) {
    console.error('send-mobile-notification error', e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
