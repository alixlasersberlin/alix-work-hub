import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Bootstrap endpoint: fail closed until the versioned API and credentials are ready.
Deno.serve((req: Request) => {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const configured = Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  // Keep the SDK import in the bootstrap so deployment verifies server dependencies.
  void createClient;
  return new Response(JSON.stringify({ error: { code: 'SETUP_REQUIRED', message: 'Schnittstelle noch nicht freigeschaltet.' }, server_access_configured: configured }), { status: 503, headers });
});