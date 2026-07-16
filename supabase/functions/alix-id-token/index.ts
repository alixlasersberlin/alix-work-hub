// Alix ID — Token endpoint (Authorization Code exchange with PKCE)
// POST { code, code_verifier, redirect_uri }
// Server-to-server call from a relying-party app backend.
// Returns identity + app access info; the RP creates its own session.
import { corsHeaders, json, admin as adminFn, logEvent, sha256, verifyPkce } from '../_shared/alix-id.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const { code, code_verifier, redirect_uri } = body ?? {};
  if (!code || !code_verifier || !redirect_uri) return json({ error: 'missing_parameters' }, 400);
  if (typeof code_verifier !== 'string' || code_verifier.length < 43 || code_verifier.length > 128) {
    return json({ error: 'invalid_code_verifier' }, 400);
  }

  const a = adminFn();
  const codeHash = await sha256(String(code));
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ua = req.headers.get('user-agent') ?? null;

  // Race-safe consumption: mark used_at only if still unused and not expired.
  const { data: consumed, error: consumeErr } = await a
    .from('alix_auth_transactions')
    .update({ used_at: new Date().toISOString(), status: 'consumed' })
    .eq('authorization_code_hash', codeHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('*')
    .maybeSingle();

  if (consumeErr || !consumed) {
    await logEvent(a, {
      event_type: 'sso_token_denied', severity: 'warn', success: false,
      ip_address: ip, user_agent: ua,
      metadata: { reason: 'code_invalid_or_used' },
    });
    return json({ error: 'invalid_or_expired_code' }, 400);
  }

  if (consumed.redirect_uri !== redirect_uri) {
    await logEvent(a, {
      identity_id: consumed.identity_id, application_id: consumed.application_id,
      event_type: 'sso_token_denied', severity: 'error', success: false,
      ip_address: ip, user_agent: ua, metadata: { reason: 'redirect_uri_mismatch' },
    });
    return json({ error: 'redirect_uri_mismatch' }, 400);
  }

  if (!consumed.code_challenge || !consumed.code_challenge_method) {
    return json({ error: 'pkce_required' }, 400);
  }
  const ok = await verifyPkce(code_verifier, consumed.code_challenge, consumed.code_challenge_method);
  if (!ok) {
    await logEvent(a, {
      identity_id: consumed.identity_id, application_id: consumed.application_id,
      event_type: 'sso_token_denied', severity: 'error', success: false,
      ip_address: ip, user_agent: ua, metadata: { reason: 'pkce_verification_failed' },
    });
    return json({ error: 'pkce_verification_failed' }, 400);
  }

  const { data: identity } = await a
    .from('alix_identities')
    .select('id, auth_user_id, display_name, preferred_language, account_type, account_status')
    .eq('id', consumed.identity_id)
    .single();

  if (!identity || identity.account_status !== 'active') {
    return json({ error: 'account_inactive' }, 403);
  }

  const { data: app } = await a
    .from('alix_applications')
    .select('id, app_key, app_name, session_duration_minutes')
    .eq('id', consumed.application_id)
    .single();

  const { data: access } = await a
    .from('alix_identity_app_access')
    .select('app_role, permissions, organization_id')
    .eq('identity_id', identity.id)
    .eq('application_id', app!.id)
    .eq('access_status', 'active')
    .maybeSingle();

  const { data: org } = consumed.organization_id
    ? await a.from('alix_organizations').select('id, legal_name, display_name, linked_customer_id, tenant_id')
        .eq('id', consumed.organization_id).maybeSingle()
    : { data: null };

  // Get auth user email for RP session bootstrap.
  const { data: authUser } = await a.auth.admin.getUserById(identity.auth_user_id);

  await a.from('alix_identity_app_access')
    .update({ last_used_at: new Date().toISOString() })
    .eq('identity_id', identity.id)
    .eq('application_id', app!.id);

  await a.from('alix_identities')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', identity.id);

  await logEvent(a, {
    identity_id: identity.id, application_id: app!.id, organization_id: consumed.organization_id,
    event_type: 'sso_token_issued', ip_address: ip, user_agent: ua,
  });

  return json({
    identity: {
      id: identity.id,
      auth_user_id: identity.auth_user_id,
      email: authUser?.user?.email ?? null,
      display_name: identity.display_name,
      preferred_language: identity.preferred_language,
      account_type: identity.account_type,
    },
    application: {
      key: app!.app_key,
      name: app!.app_name,
      session_duration_minutes: app!.session_duration_minutes,
    },
    organization: org ?? null,
    access: access ?? null,
    scope: consumed.scope ?? [],
  });
});
