// AlixDocs — Create a signed upload URL for large files (bypasses 10MB edge body limit).
// Input JSON: { filename: string }
// Returns: { bucket, path, token, signedUrl }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const BUCKET = 'alixdocs-private';

function sanitize(name: string) {
  const base = (name || 'datei').split(/[\\/]/).pop() ?? 'datei';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'datei';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json(401, { error: 'unauthorized' });

  const body = await req.json().catch(() => ({}));
  const filename = sanitize((body?.filename as string) || 'datei');
  const path = `staging/${userData.user.id}/${Date.now()}-${crypto.randomUUID()}-${filename}`;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return json(500, { error: 'signed_url_failed', details: error?.message });

  return json(200, { bucket: BUCKET, path, token: data.token, signedUrl: data.signedUrl });
});
