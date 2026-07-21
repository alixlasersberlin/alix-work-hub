import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Tracking-Endpoints für Kampagnen A/B-Metriken.
 *   GET  /open?r=<recipient_id>   -> 1x1 GIF Pixel, setzt opened_at
 *   GET  /click?r=<recipient_id>&u=<target_url> -> 302, setzt clicked_at
 */
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs='), (c) => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const rid = url.searchParams.get('r');
  const path = url.pathname.split('/').pop();

  if (!rid) return new Response('missing r', { status: 400, headers: corsHeaders });

  try {
    if (path === 'open') {
      await sb.from('ac_campaign_recipients').update({ opened_at: new Date().toISOString() })
        .eq('id', rid).is('opened_at', null);
      return new Response(GIF, { headers: { ...corsHeaders, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
    }
    if (path === 'click') {
      const target = url.searchParams.get('u') ?? '/';
      await sb.from('ac_campaign_recipients').update({ clicked_at: new Date().toISOString() })
        .eq('id', rid).is('clicked_at', null);
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target } });
    }
    return new Response('not found', { status: 404, headers: corsHeaders });
  } catch (e: any) {
    return new Response(String(e?.message ?? 'error'), { status: 500, headers: corsHeaders });
  }
});
