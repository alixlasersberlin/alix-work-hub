import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';

// CORS-Härtung: Whitelist statt '*'. Erweitern, falls weitere Domains genutzt werden.
const ALLOWED_ORIGINS = new Set<string>([
  'https://alixwork.de',
  'https://www.alixwork.de',
  'https://alix-finance.de',
  'https://www.alix-finance.de',
  'https://alix-pro-hub.lovable.app',
]);
function buildCors(origin: string | null) {
  const allow = origin && (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[\w-]+\.lovable(project)?\.app$/.test(origin) || origin.startsWith('http://localhost'))
    ? origin
    : 'https://alixwork.de';
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  } as Record<string, string>;
}

const CAPTCHA_BYPASS_EMAILS = new Set<string>([
  '2556690413@qq.com',
]);

const LOGIN_MAX = 10;
const LOGIN_WINDOW_SEC = 300;

const BodySchema = z.object({
  token: z.string().min(1).max(4096).optional(),
  email: z.string().email().max(255).optional(),
});

Deno.serve(async (req) => {
  const cors = buildCors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, error: 'invalid_input', issues: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const token = parsed.data.token;
    const email = parsed.data.email?.trim().toLowerCase() ?? '';

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
    const ua = req.headers.get('user-agent') ?? '';

    const supaUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const admin = (supaUrl && serviceKey) ? createClient(supaUrl, serviceKey) : null;

    // Rate-Limit
    if (admin) {
      try {
        const bucket = `login:${email || ip || 'anon'}`;
        const { data: limited } = await admin.rpc('check_rate_limit', {
          _bucket: bucket, _max: LOGIN_MAX, _window_seconds: LOGIN_WINDOW_SEC,
        });
        if (limited === true) {
          // Security-Log
          try {
            await admin.rpc('log_audit_event', {
              _action: 'rate_limit_hit',
              _module: 'auth',
              _record_id: null,
              _details: { endpoint: 'verify-turnstile', email, ip } as any,
              _ip_address: ip || null,
              _user_agent: ua || null,
            });
          } catch { /* ignore */ }
          return new Response(JSON.stringify({ success: false, error: 'rate_limited', message: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' }), {
            status: 429, headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(LOGIN_WINDOW_SEC) },
          });
        }
      } catch { /* never block on limiter errors */ }
    }

    if (email && CAPTCHA_BYPASS_EMAILS.has(email)) {
      return new Response(JSON.stringify({ success: true, bypass: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'missing token' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secret) {
      return new Response(JSON.stringify({ success: false, error: 'server not configured' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const form = new URLSearchParams();
    form.append('secret', secret);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await resp.json();

    // Security-Log bei fehlgeschlagener Captcha-Verifizierung
    if (admin && !data.success) {
      try {
        await admin.rpc('log_audit_event', {
          _action: 'captcha_failed',
          _module: 'auth',
          _record_id: null,
          _details: { email, ip, errors: data['error-codes'] ?? [] } as any,
          _ip_address: ip || null,
          _user_agent: ua || null,
        });
      } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ success: !!data.success, errors: data['error-codes'] ?? [] }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
