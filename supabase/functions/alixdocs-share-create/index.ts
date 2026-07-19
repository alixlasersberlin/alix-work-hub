// AlixDocs — Create external share link
// Body: { document_ids: string[], expires_at?: ISO, password?: string, max_downloads?: number, note?: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const h = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function tokenGen(): string {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json(401, { error: 'missing_auth' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: 'unauthorized' });

  let body: any; try { body = await req.json(); } catch { return json(400, { error: 'invalid_json' }); }
  const ids: string[] = Array.isArray(body?.document_ids) ? body.document_ids.filter(Boolean) : [];
  if (ids.length === 0 || ids.length > 200) return json(400, { error: 'invalid_document_ids' });

  const admin = createClient(url, service);
  const password = typeof body?.password === 'string' && body.password.length > 0 ? body.password : null;
  const password_hash = password ? await sha256Hex(password) : null;
  const expires_at = typeof body?.expires_at === 'string' ? body.expires_at : null;
  const max_downloads = Number.isFinite(body?.max_downloads) ? Number(body.max_downloads) : null;
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : null;

  const token = tokenGen();
  const { data, error } = await admin.from('alixdocs_share_links').insert({
    token, document_ids: ids, created_by: u.user.id,
    password_hash, expires_at, max_downloads, note,
  }).select('id, token, expires_at, max_downloads').single();
  if (error) return json(500, { error: error.message });

  return json(200, { id: data.id, token: data.token, url: `/dokumente/share/${data.token}` });
});
