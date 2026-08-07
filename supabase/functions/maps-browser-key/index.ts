import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Liefert den (nicht geheimen, referrer-beschränkten) Google-Maps-Browser-Key.
// Notwendig, weil der BYOK-Key für app.alixwork.de nicht als VITE-Variable im
// Frontend-Build landet.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key =
    Deno.env.get('GOOGLE_MAPS_BROWSER_KEY_1') ||
    Deno.env.get('GOOGLE_MAPS_BROWSER_KEY') ||
    '';
  const channel =
    Deno.env.get('GOOGLE_MAPS_TRACKING_ID_1') ||
    Deno.env.get('GOOGLE_MAPS_TRACKING_ID') ||
    '';

  if (!key) {
    return new Response(JSON.stringify({ error: 'Kein Google-Maps-Browser-Key konfiguriert' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ key, channel }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' },
  });
});
