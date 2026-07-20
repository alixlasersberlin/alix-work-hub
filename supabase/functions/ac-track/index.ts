// Edge Function: ac-track
// Öffentlicher Endpoint für den ALIX CONNECT Web-Tracker (connect.js).
// - CORS offen
// - kein JWT (verify_jwt=false via getClaims-Skip)
// - Rate-Limit 60 req/min/IP
// - IP-Hash mit Tagessalt aus app_settings
// - Batch-Insert in ac_analytics_events

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type IncomingEvent = {
  type?: string;
  url?: string;
  title?: string;
  referrer?: string;
  language?: string;
  screen?: string;
  device?: string;
  browser?: string;
  os?: string;
  scroll_depth?: number;
  duration_ms?: number;
  utm?: Record<string, string>;
  meta?: Record<string, unknown>;
  vid?: string; // consent-mode visitor cookie
};

const BOT_RE = /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|googlebot|bingbot|yandex|ahrefs|semrush/i;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getDailySalt(): Promise<string> {
  const key = `ac_track_salt_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;
  const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (data?.value) return data.value as string;
  const salt = crypto.randomUUID() + crypto.randomUUID();
  await admin.from('app_settings').upsert({ key, value: salt }, { onConflict: 'key' });
  return salt;
}

function parseUA(ua: string): { device: string; browser: string; os: string } {
  const device = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? (/iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile') : 'desktop';
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari'
    : /OPR\//i.test(ua) ? 'Opera'
    : 'Other';
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X/i.test(ua) ? 'macOS'
    : /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Other';
  return { device, browser, os };
}

async function checkRateLimit(bucket: string): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from('api_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('bucket_key', bucket)
    .gte('request_at', since);
  if ((count ?? 0) >= 60) return false;
  await admin.from('api_rate_limits').insert({ bucket_key: bucket, request_at: new Date().toISOString() });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const key = String(body?.key ?? '').trim();
    const events: IncomingEvent[] = Array.isArray(body?.events) ? body.events.slice(0, 25) : [];
    if (!key || !events.length) {
      return new Response(JSON.stringify({ ok: false, error: 'key & events required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: site } = await admin
      .from('ac_websites')
      .select('id, tenant_id, status, analytics_enabled, cookieless_analytics')
      .eq('api_key', key)
      .maybeSingle();
    if (!site || site.status !== 'active' || !site.analytics_enabled) {
      // Silently 200 so scripts don't retry-storm.
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit per IP+website
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0';
    const ua = req.headers.get('user-agent') ?? '';
    const country = req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country') || null;
    const acceptLang = (req.headers.get('accept-language') ?? '').split(',')[0]?.slice(0, 8) || null;

    if (!(await checkRateLimit(`ac_track:${site.id}:${ip}`))) {
      return new Response(JSON.stringify({ ok: false, error: 'rate_limit' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isBot = BOT_RE.test(ua);
    const salt = await getDailySalt();
    const uaInfo = parseUA(ua);
    const visitorFromConsent = events[0]?.vid && String(events[0].vid).length > 8 ? String(events[0].vid) : null;
    const visitorHash = visitorFromConsent
      ?? await sha256(`${ip}|${ua}|${salt}|${site.id}`);
    const sessionHash = await sha256(`${visitorHash}|${new Date().toISOString().slice(0, 10)}`);

    const rows = events.map((e) => {
      const url = String(e.url ?? '').slice(0, 2048);
      return {
        website_id: site.id,
        tenant_id: site.tenant_id,
        session_hash: sessionHash,
        visitor_hash: visitorHash,
        event_type: String(e.type ?? 'pageview').slice(0, 32),
        page_url: url || null,
        page_title: e.title ? String(e.title).slice(0, 512) : null,
        referrer: e.referrer ? String(e.referrer).slice(0, 1024) : null,
        utm_source: e.utm?.source ? String(e.utm.source).slice(0, 128) : null,
        utm_medium: e.utm?.medium ? String(e.utm.medium).slice(0, 128) : null,
        utm_campaign: e.utm?.campaign ? String(e.utm.campaign).slice(0, 256) : null,
        utm_term: e.utm?.term ? String(e.utm.term).slice(0, 128) : null,
        utm_content: e.utm?.content ? String(e.utm.content).slice(0, 128) : null,
        country,
        language: e.language ? String(e.language).slice(0, 8) : acceptLang,
        device_type: e.device || uaInfo.device,
        browser: e.browser || uaInfo.browser,
        os: e.os || uaInfo.os,
        screen_size: e.screen ? String(e.screen).slice(0, 16) : null,
        duration_ms: Number.isFinite(e.duration_ms) ? Math.max(0, Math.min(Number(e.duration_ms), 4 * 60 * 60 * 1000)) : null,
        scroll_depth: Number.isFinite(e.scroll_depth) ? Math.max(0, Math.min(Number(e.scroll_depth), 100)) : null,
        is_bot: isBot,
        metadata: (e.meta && typeof e.meta === 'object') ? e.meta : {},
      };
    });

    const { error } = await admin.from('ac_analytics_events').insert(rows);
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, accepted: rows.length, bot: isBot, vid: visitorHash.slice(0, 12) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
