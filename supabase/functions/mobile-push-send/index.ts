// Edge Function: mobile-push-send
// Sendet Web-Push-Nachrichten an gespeicherte Techniker-Endpoints.
//
// Erwartete Secrets:
//   VAPID_PUBLIC_KEY   – Base64URL, identisch zu VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  – Base64URL, privater VAPID-Schlüssel
//   VAPID_SUBJECT      – mailto: oder https://…
//
// Aufruf (Service-Role oder Admin):
//   { user_ids: string[], title: string, body?: string, url?: string, tag?: string, requireInteraction?: boolean }
// Oder alle Techniker:
//   { role: 'Technik'|'Tourenplanung'|'Service'|'Reparaturannahme', title, body, url }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'https://esm.sh/web-push@3.6.7';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BodySchema = z.object({
  user_ids: z.array(z.string().uuid()).optional(),
  role: z.string().optional(),
  title: z.string().min(1).max(120),
  body: z.string().max(400).optional(),
  url: z.string().max(300).optional(),
  tag: z.string().max(80).optional(),
  requireInteraction: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return json({ error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured' }, 500);
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { user_ids, role, title, body, url, tag, requireInteraction } = parsed.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    let targetIds: string[] = user_ids ?? [];
    if ((!targetIds || targetIds.length === 0) && role) {
      const { data: ur } = await supabase
        .from('user_roles')
        .select('user_id, roles:role_id(name)')
        .limit(10000);
      targetIds = (ur ?? [])
        .filter((r: any) => r.roles?.name === role)
        .map((r: any) => r.user_id);
    }
    if (targetIds.length === 0) return json({ sent: 0, failed: 0, message: 'no targets' });

    const { data: subs } = await supabase
      .from('mobile_push_subscriptions')
      .select('id, endpoint, p256dh, auth_key, user_id')
      .in('user_id', targetIds);

    const payload = JSON.stringify({
      title, body: body ?? '', url: url ?? '/m', tag: tag ?? 'alix-mobile',
      requireInteraction: requireInteraction ?? false,
    });

    let sent = 0, failed = 0;
    const removeIds: string[] = [];
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          payload,
        );
        sent++;
      } catch (e: any) {
        failed++;
        if (e?.statusCode === 404 || e?.statusCode === 410) removeIds.push(s.id);
      }
    }
    if (removeIds.length > 0) {
      await supabase.from('mobile_push_subscriptions').delete().in('id', removeIds);
    }
    return json({ sent, failed, expired_removed: removeIds.length, targets: subs?.length ?? 0 });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
