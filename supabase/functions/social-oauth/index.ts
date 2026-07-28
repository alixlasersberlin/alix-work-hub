// Social OAuth: initiate + callback for Meta/Instagram/LinkedIn/TikTok.
// Actions:
//   - 'authorize' { account_id, provider, redirect_uri } -> { url }
//   - 'callback'  { account_id, provider, code, redirect_uri } -> stores tokens
//   - 'disconnect' { account_id }
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ENC = Deno.env.get('SOCIAL_ENC_KEY') ?? '';

const CFG: Record<string, { authUrl: string; tokenUrl: string; clientIdEnv: string; secretEnv: string; scope: string }> = {
  meta:      { authUrl: 'https://www.facebook.com/v20.0/dialog/oauth', tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token', clientIdEnv: 'META_APP_ID', secretEnv: 'META_APP_SECRET', scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish' },
  instagram: { authUrl: 'https://www.facebook.com/v20.0/dialog/oauth', tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token', clientIdEnv: 'META_APP_ID', secretEnv: 'META_APP_SECRET', scope: 'instagram_basic,instagram_content_publish,pages_show_list,business_management' },
  linkedin:  { authUrl: 'https://www.linkedin.com/oauth/v2/authorization', tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken', clientIdEnv: 'LINKEDIN_CLIENT_ID', secretEnv: 'LINKEDIN_CLIENT_SECRET', scope: 'w_member_social,r_liteprofile,w_organization_social,r_organization_admin' },
  tiktok:    { authUrl: 'https://www.tiktok.com/v2/auth/authorize', tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/', clientIdEnv: 'TIKTOK_CLIENT_KEY', secretEnv: 'TIKTOK_CLIENT_SECRET', scope: 'user.info.basic,video.publish,video.upload' },
};

function b64(a: Uint8Array) { let s=''; a.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); }
function fromB64(s: string) { return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }
async function key() {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ENC));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
}
async function enc(txt: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await key();
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, k, new TextEncoder().encode(txt)));
  return { ct: `\\x${hex(ct)}`, iv: `\\x${hex(iv)}` };
}
function hex(b: Uint8Array) { return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(''); }
function json(o: unknown, s=200) { return new Response(JSON.stringify(o), { status:s, headers:{...corsHeaders,'Content-Type':'application/json'} }); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: c } = await userClient.auth.getClaims(auth.replace('Bearer ',''));
    if (!c?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = c.claims.sub as string;
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: canAdmin } = await svc.rpc('can_admin_social');
    if (!canAdmin) return json({ error: 'Forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'authorize') {
      const cfg = CFG[body.provider];
      if (!cfg) return json({ error: 'Unknown provider' }, 400);
      const clientId = Deno.env.get(cfg.clientIdEnv);
      if (!clientId) return json({ error: `${cfg.clientIdEnv} not configured` }, 400);
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: body.redirect_uri,
        response_type: 'code', scope: cfg.scope, state,
      });
      if (body.provider === 'tiktok') { params.set('client_key', clientId); params.delete('client_id'); }
      return json({ url: `${cfg.authUrl}?${params}`, state });
    }

    if (action === 'callback') {
      const cfg = CFG[body.provider];
      if (!cfg) return json({ error: 'Unknown provider' }, 400);
      const clientId = Deno.env.get(cfg.clientIdEnv)!;
      const secret = Deno.env.get(cfg.secretEnv)!;
      const p = new URLSearchParams({
        client_id: clientId, client_secret: secret,
        code: body.code, redirect_uri: body.redirect_uri,
        grant_type: 'authorization_code',
      });
      if (body.provider === 'tiktok') { p.set('client_key', clientId); p.delete('client_id'); }
      const r = await fetch(cfg.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
      if (!r.ok) return json({ error: 'token_exchange_failed', details: await r.text() }, 502);
      const tok = await r.json();
      const access = tok.access_token || tok.data?.access_token;
      const refresh = tok.refresh_token || tok.data?.refresh_token || null;
      const expiresIn = tok.expires_in || tok.data?.expires_in || null;
      if (!access) return json({ error: 'no_access_token', tok }, 502);
      const a = await enc(access);
      const r2 = refresh ? await enc(refresh) : null;
      const row: any = {
        account_id: body.account_id, provider: body.provider,
        access_token_ct: a.ct, access_token_iv: a.iv,
        refresh_token_ct: r2?.ct ?? null, refresh_token_iv: r2?.iv ?? null,
        scopes: cfg.scope.split(','), created_by: userId,
        expires_at: expiresIn ? new Date(Date.now() + expiresIn*1000).toISOString() : null,
        external_user_id: tok.open_id ?? null,
      };
      await svc.from('social_oauth_tokens').delete().eq('account_id', body.account_id);
      const { error: e } = await svc.from('social_oauth_tokens').insert(row);
      if (e) return json({ error: e.message }, 500);
      await svc.from('social_accounts').update({ connected: true, status: 'connected' }).eq('id', body.account_id);
      await svc.from('social_activity_logs').insert({ actor_id: userId, action: 'oauth_connect', entity_type: 'social_accounts', entity_id: body.account_id });
      return json({ ok: true });
    }

    if (action === 'disconnect') {
      await svc.from('social_oauth_tokens').delete().eq('account_id', body.account_id);
      await svc.from('social_accounts').update({ connected: false, status: 'not_connected' }).eq('id', body.account_id);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
