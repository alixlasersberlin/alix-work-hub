import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function hash(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function detectDevice(ua: string) {
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  if (/tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}
function detectBrowser(ua: string) {
  if (/edg\//i.test(ua)) return 'edge';
  if (/chrome/i.test(ua)) return 'chrome';
  if (/firefox/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua)) return 'safari';
  return 'other';
}
function detectOs(ua: string) {
  if (/windows/i.test(ua)) return 'windows';
  if (/mac os/i.test(ua)) return 'macos';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ios/i.test(ua)) return 'ios';
  if (/linux/i.test(ua)) return 'linux';
  return 'other';
}
const isBot = (ua: string) => /bot|crawler|spider|slurp|facebookexternalhit|preview/i.test(ua);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { api_key, events } = body ?? {};
    if (!api_key || !Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: site, error: siteErr } = await supabase
      .from('ac_websites').select('id, tenant_id, analytics_enabled, status')
      .eq('api_key', api_key).maybeSingle();
    if (siteErr || !site || site.status !== 'active' || !site.analytics_enabled) {
      return new Response(JSON.stringify({ error: 'website not found or disabled' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ua = req.headers.get('user-agent') ?? '';
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0';
    const day = new Date().toISOString().slice(0, 10);
    const salt = `${site.id}:${day}`;
    const visitor_hash = await hash(`${ip}:${ua}:${salt}`);
    const bot = isBot(ua);

    const rows = events.slice(0, 50).map((e: any) => ({
      website_id: site.id,
      tenant_id: site.tenant_id,
      session_hash: e.session_hash ?? visitor_hash,
      visitor_hash,
      event_type: String(e.event_type || 'pageview').slice(0, 40),
      page_url: e.page_url ? String(e.page_url).slice(0, 500) : null,
      page_title: e.page_title ? String(e.page_title).slice(0, 300) : null,
      referrer: e.referrer ? String(e.referrer).slice(0, 500) : null,
      utm_source: e.utm_source ?? null,
      utm_medium: e.utm_medium ?? null,
      utm_campaign: e.utm_campaign ?? null,
      utm_term: e.utm_term ?? null,
      utm_content: e.utm_content ?? null,
      language: e.language ?? null,
      device_type: detectDevice(ua),
      browser: detectBrowser(ua),
      os: detectOs(ua),
      screen_size: e.screen_size ?? null,
      duration_ms: e.duration_ms ?? null,
      scroll_depth: e.scroll_depth ?? null,
      is_bot: bot,
      metadata: e.metadata ?? {},
    }));

    const { error: insErr } = await supabase.from('ac_analytics_events').insert(rows);
    if (insErr) throw insErr;
    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ac-track error', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
