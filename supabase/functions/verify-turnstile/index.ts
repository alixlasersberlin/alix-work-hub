import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Captcha-Bypass für interne Accounts, die Cloudflare Turnstile nicht zuverlässig
// laden können (z. B. aus Regionen mit eingeschränktem Zugriff auf
// challenges.cloudflare.com). Bitte sparsam einsetzen.
const CAPTCHA_BYPASS_EMAILS = new Set<string>([
  '2556690413@qq.com', // Jerry – China-Netz, Turnstile lädt nicht
]);

// Server-seitiges Rate-Limit für Login-Versuche.
// Pro Identifier (Email bzw. IP-Fallback) max. N Requests pro Zeitfenster.
const LOGIN_MAX = 10;          // max. Versuche
const LOGIN_WINDOW_SEC = 300;  // 5 Minuten

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token: unknown = body?.token;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (email && CAPTCHA_BYPASS_EMAILS.has(email)) {
      return new Response(JSON.stringify({ success: true, bypass: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: 'server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await resp.json();

    return new Response(JSON.stringify({ success: !!data.success, errors: data['error-codes'] ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
