import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const email = 'l.scheidler@Alix-operation.de';
  const newPassword = 'Larsiinpink123';

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: corsHeaders });

  const user = list.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404, headers: corsHeaders });

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: corsHeaders });

  return new Response(JSON.stringify({ ok: true, user_id: user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
