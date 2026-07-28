// Social credentials: encrypt/decrypt secrets with AES-256-GCM.
// Storage: service_role only. Access gated by can_admin_social()/can_manage_social().
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ENC_KEY_RAW = Deno.env.get('SOCIAL_ENC_KEY') ?? '';

function b64ToBytes(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function bytesToB64(a: Uint8Array) { let s = ''; a.forEach(b => s += String.fromCharCode(b)); return btoa(s); }

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Derive 32 bytes via SHA-256 over the secret string so any length is supported.
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(ENC_KEY_RAW));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
  return { ciphertext_b64: bytesToB64(ct), iv_b64: bytesToB64(iv) };
}
async function decrypt(ct_b64: string, iv_b64: string) {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(iv_b64) }, key, b64ToBytes(ct_b64));
  return new TextDecoder().decode(pt);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    if (!ENC_KEY_RAW) return json({ error: 'SOCIAL_ENC_KEY missing' }, 500);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: claims } = await userClient.auth.getClaims(auth.replace('Bearer ', ''));
    if (!claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    // Permission: must be admin of social module (Super Admin / Admin).
    const { data: canAdmin } = await svc.rpc('can_admin_social');
    if (!canAdmin) return json({ error: 'Forbidden' }, 403);

    if (action === 'store') {
      const { account_id, password } = body;
      if (!account_id || !password) return json({ error: 'Missing fields' }, 400);
      const { ciphertext_b64, iv_b64 } = await encrypt(String(password));
      // Delete existing then insert
      await svc.from('social_credentials').delete().eq('account_id', account_id);
      const { error } = await svc.from('social_credentials').insert({
        account_id,
        ciphertext: `\\x${bufToHex(b64ToBytes(ciphertext_b64))}`,
        iv: `\\x${bufToHex(b64ToBytes(iv_b64))}`,
        created_by: userId,
      });
      if (error) return json({ error: error.message }, 500);
      await svc.from('social_accounts').update({ connected: true, status: 'connected' }).eq('id', account_id);
      await svc.from('social_activity_logs').insert({ actor_id: userId, action: 'credential_store', entity_type: 'social_accounts', entity_id: account_id });
      return json({ ok: true });
    }

    if (action === 'reveal') {
      const { account_id } = body;
      if (!account_id) return json({ error: 'Missing account_id' }, 400);
      const { data: cred, error } = await svc.from('social_credentials').select('ciphertext, iv').eq('account_id', account_id).maybeSingle();
      if (error || !cred) return json({ error: 'Not found' }, 404);
      const ct_b64 = bytesToB64(hexToBytes(String(cred.ciphertext).replace(/^\\x/, '')));
      const iv_b64 = bytesToB64(hexToBytes(String(cred.iv).replace(/^\\x/, '')));
      const password = await decrypt(ct_b64, iv_b64);
      await svc.from('social_activity_logs').insert({ actor_id: userId, action: 'credential_reveal', entity_type: 'social_accounts', entity_id: account_id });
      return json({ password });
    }

    if (action === 'delete') {
      const { account_id } = body;
      await svc.from('social_credentials').delete().eq('account_id', account_id);
      await svc.from('social_accounts').update({ connected: false, status: 'not_connected' }).eq('id', account_id);
      await svc.from('social_activity_logs').insert({ actor_id: userId, action: 'credential_delete', entity_type: 'social_accounts', entity_id: account_id });
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function bufToHex(b: Uint8Array) { return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(h: string) { const out = new Uint8Array(h.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16); return out; }
