// sig-webhook-dispatch: verschickt Webhook-Events an konfigurierte sig_webhooks.
// Aufruf: POST { event, document_id, request_id, payload }.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { event, document_id, request_id, payload = {} } = body || {};
  if (!event) return new Response(JSON.stringify({ error: 'event required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: hooks } = await admin.from('sig_webhooks').select('*').eq('is_active', true);
  const targets = (hooks || []).filter((h: any) => !h.events?.length || h.events.includes(event) || h.events.includes('*'));

  let ok = 0, failed = 0;
  for (const h of targets) {
    const bodyStr = JSON.stringify({ event, document_id, request_id, payload, ts: new Date().toISOString() });
    const signature = h.secret ? await hmacSha256Hex(h.secret, bodyStr) : null;
    let status = 0; let respText = '';
    try {
      const res = await fetch(h.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AlixSign-Event': event,
          ...(signature ? { 'X-AlixSign-Signature': `sha256=${signature}` } : {}),
        },
        body: bodyStr,
      });
      status = res.status;
      respText = (await res.text()).slice(0, 500);
      if (res.ok) ok++; else failed++;
    } catch (e: any) { failed++; respText = e?.message ?? String(e); }

    await admin.from('sig_webhook_deliveries').insert({
      webhook_id: h.id, event, request_id, document_id,
      status_code: status, response: respText,
      success: status >= 200 && status < 300,
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: ok, failed, total: targets.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
