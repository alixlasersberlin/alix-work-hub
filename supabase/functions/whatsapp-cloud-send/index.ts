// Edge Function: whatsapp-cloud-send
// Sendet WhatsApp-Nachrichten über die offizielle Meta Cloud API.
// Erwartet Secrets: WHATSAPP_CLOUD_TOKEN, WHATSAPP_PHONE_NUMBER_ID
// Body: { to: string, text?: string, template?: { name, language, components? } }

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub;

  const token = Deno.env.get('WHATSAPP_CLOUD_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) return json({ error: 'WhatsApp Cloud API secrets missing' }, 500);

  try {
    const body = await req.json();
    const to = String(body?.to ?? '').replace(/\D/g, '');
    if (!to) return json({ error: 'to required' }, 400);

    let payload: Record<string, unknown>;
    if (body?.template?.name) {
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: body.template.name,
          language: { code: body.template.language ?? 'de' },
          components: body.template.components ?? [],
        },
      };
    } else {
      const text = String(body?.text ?? '').slice(0, 4096);
      if (!text) return json({ error: 'text or template required' }, 400);
      payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
    }

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      await admin.from('whatsapp_messages').insert({
        recipient: to, content: JSON.stringify(payload), direction: 'outbound',
        status: 'failed', error_message: JSON.stringify(data), user_id: userId,
      } as any);
      return json({ error: 'send_failed', details: data }, res.status);
    }

    const wamid = data?.messages?.[0]?.id ?? null;
    await admin.from('whatsapp_messages').insert({
      recipient: to, content: JSON.stringify(payload), direction: 'outbound',
      status: 'sent', external_id: wamid, user_id: userId,
    } as any);

    return json({ ok: true, message_id: wamid });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
