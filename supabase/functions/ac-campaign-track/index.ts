import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { safeRedirectTarget, verifyCampaignLink } from '../_shared/campaign-link.ts';

/**
 * Tracking-Endpoints für Kampagnen A/B-Metriken.
 *   GET  /open?r=<recipient_id>&s=<sig>   -> 1x1 GIF Pixel, setzt opened_at (nur signiert)
 *   GET  /click?r=<recipient_id>&u=<target_url>&s=<sig> -> 302 (nur signiert, nur http/https)
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
    const sig = url.searchParams.get('s');
    if (path === 'open') {
      if (await verifyCampaignLink(rid, '', sig)) await sb.from('ac_campaign_recipients').update({ opened_at: new Date().toISOString() })
        .eq('id', rid).is('opened_at', null);
      return new Response(GIF, { headers: { ...corsHeaders, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } });
    }
    if (path === 'click') {
      const raw = url.searchParams.get('u') ?? '';
      const target = safeRedirectTarget(raw);
      if (!target || !(await verifyCampaignLink(rid, raw, sig))) return new Response('invalid link', { status: 400, headers: corsHeaders });
      await sb.from('ac_campaign_recipients').update({ clicked_at: new Date().toISOString() })
        .eq('id', rid).is('clicked_at', null);
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: target } });
    }
    return new Response('not found', { status: 404, headers: corsHeaders });
  } catch (e: any) {
    console.error('ac-campaign-track', e?.message);
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});
