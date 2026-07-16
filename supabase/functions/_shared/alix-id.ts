// Shared helpers for Alix ID edge functions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function env() {
  return {
    url: Deno.env.get('SUPABASE_URL')!,
    anon: Deno.env.get('SUPABASE_ANON_KEY')!,
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  };
}

export function admin() {
  const e = env();
  return createClient(e.url, e.service, { auth: { persistSession: false } });
}

/** Authenticate caller via Supabase session, return identity row (create if missing). */
export async function authIdentity(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { error: json({ error: 'unauthorized' }, 401) };

  const e = env();
  const userClient = createClient(e.url, e.anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return { error: json({ error: 'unauthorized' }, 401) };

  const a = admin();
  let { data: identity } = await a
    .from('alix_identities')
    .select('*')
    .eq('auth_user_id', u.user.id)
    .maybeSingle();

  if (!identity) {
    const { data: created, error } = await a
      .from('alix_identities')
      .insert({
        auth_user_id: u.user.id,
        display_name: u.user.email ?? null,
        email_verified_at: u.user.email_confirmed_at ?? null,
      })
      .select('*')
      .single();
    if (error) return { error: json({ error: 'identity_bootstrap_failed' }, 500) };
    identity = created;
  }

  if (identity.account_status !== 'active') {
    return { error: json({ error: 'account_' + identity.account_status }, 403) };
  }

  return {
    admin: a,
    user: u.user,
    identity,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    ua: req.headers.get('user-agent') ?? null,
  };
}

/** Require caller to have specific Alix-ID admin permission (Super Admin always allowed). */
export async function requireAdminPermission(req: Request, permission: string) {
  const a = admin();
  const e = env();
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { error: json({ error: 'unauthorized' }, 401) };
  const userClient = createClient(e.url, e.anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return { error: json({ error: 'unauthorized' }, 401) };

  const { data: allowed } = await userClient.rpc('has_alix_id_permission', { _permission: permission });
  if (!allowed) return { error: json({ error: 'forbidden' }, 403) };

  return {
    admin: a,
    user: u.user,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    ua: req.headers.get('user-agent') ?? null,
  };
}

export async function logEvent(a: any, row: {
  identity_id?: string | null;
  organization_id?: string | null;
  application_id?: string | null;
  event_type: string;
  severity?: 'info' | 'warn' | 'error' | 'critical';
  success?: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await a.from('alix_security_events').insert({
      severity: 'info',
      success: true,
      ...row,
    });
  } catch { /* never break flow */ }
}

/** Base64URL (no padding) encode of an ArrayBuffer. */
export function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return b64url(buf);
}

/** Cryptographically random authorization code (43 chars, ~256 bit). */
export function randomCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes.buffer);
}

/** Validate PKCE code_verifier against stored challenge. */
export async function verifyPkce(verifier: string, challenge: string, method: string) {
  if (method === 'plain') return verifier === challenge;
  if (method === 'S256') return (await sha256(verifier)) === challenge;
  return false;
}
