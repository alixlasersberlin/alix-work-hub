import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: list, error: le } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (le) return new Response(JSON.stringify({ error: le.message }), { status: 500, headers: corsHeaders });
  const u = list.users.find(x => x.email?.toLowerCase() === '2556690413@qq.com');
  if (!u) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: corsHeaders });
  const { error } = await admin.auth.admin.updateUserById(u.id, { password: 'Jerry2026!Alix' });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  return new Response(JSON.stringify({ ok: true, email: u.email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
