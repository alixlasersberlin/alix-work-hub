// Alix ID — Authorization endpoint (Authorization Code + PKCE)
// POST { app_key, organization_id?, redirect_uri, code_challenge, code_challenge_method, state, scope? }
// Returns { redirect: "<uri>?code=...&state=..." }
import { corsHeaders, json, authIdentity, logEvent, randomCode, sha256 } from '../_shared/alix-id.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authIdentity(req);
  if ('error' in ctx) return ctx.error;
  const { admin, identity, ip, ua } = ctx;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const {
    app_key, organization_id, redirect_uri, state,
    code_challenge, code_challenge_method = 'S256', scope = [],
  } = body ?? {};

  if (!app_key || !redirect_uri || !state || !code_challenge) {
    return json({ error: 'missing_parameters' }, 400);
  }
  if (!['S256', 'plain'].includes(code_challenge_method)) {
    return json({ error: 'invalid_code_challenge_method' }, 400);
  }
  if (typeof state !== 'string' || state.length < 8 || state.length > 256) {
    return json({ error: 'invalid_state' }, 400);
  }

  const { data: app } = await admin
    .from('alix_applications')
    .select('id, app_key, app_status, redirect_uris, session_duration_minutes, requires_mfa')
    .eq('app_key', app_key)
    .maybeSingle();

  if (!app || app.app_status !== 'active') {
    await logEvent(admin, {
      identity_id: identity.id, event_type: 'sso_authorize_denied',
      severity: 'warn', success: false, ip_address: ip, user_agent: ua,
      metadata: { reason: 'app_inactive_or_unknown', app_key },
    });
    return json({ error: 'application_unavailable' }, 403);
  }

  // Phase 3f — MFA-Enforcement: Apps mit requires_mfa=true blockieren, wenn die
  // Identität weder ein bestätigtes TOTP-Secret noch einen WebAuthn-Passkey hat.
  if (app.requires_mfa) {
    const [{ data: totp }, { count: webauthnCount }] = await Promise.all([
      admin
        .from('user_mfa_secrets')
        .select('user_id, totp_confirmed_at, enrolled_at, disabled_at')
        .eq('user_id', ctx.user.id)
        .maybeSingle(),
      admin
        .from('mfa_webauthn_credentials')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.user.id),
    ]);
    const totpActive = !!(totp?.totp_confirmed_at && totp?.enrolled_at && !totp?.disabled_at);
    const webauthnActive = (webauthnCount ?? 0) > 0;
    if (!totpActive && !webauthnActive) {
      await logEvent(admin, {
        identity_id: identity.id, application_id: app.id,
        event_type: 'sso_authorize_denied',
        severity: 'warn', success: false, ip_address: ip, user_agent: ua,
        metadata: { reason: 'mfa_required', app_key },
      });
      return json({ error: 'mfa_required' }, 403);
    }
  }

  if (!Array.isArray(app.redirect_uris) || !app.redirect_uris.includes(redirect_uri)) {
    await logEvent(admin, {
      identity_id: identity.id, application_id: app.id, event_type: 'sso_authorize_denied',
      severity: 'error', success: false, ip_address: ip, user_agent: ua,
      metadata: { reason: 'redirect_uri_mismatch' },
    });
    return json({ error: 'invalid_redirect_uri' }, 400);
  }

  // Check active access (org optional). Org-scoped access wins if org supplied.
  let accessQuery = admin
    .from('alix_identity_app_access')
    .select('id, organization_id, access_status, valid_until')
    .eq('identity_id', identity.id)
    .eq('application_id', app.id)
    .eq('access_status', 'active');
  if (organization_id) accessQuery = accessQuery.eq('organization_id', organization_id);

  const { data: accesses } = await accessQuery;
  const now = Date.now();
  const validAccess = (accesses ?? []).find((a) =>
    !a.valid_until || new Date(a.valid_until).getTime() > now
  );

  if (!validAccess) {
    await logEvent(admin, {
      identity_id: identity.id, application_id: app.id, event_type: 'sso_authorize_denied',
      severity: 'warn', success: false, ip_address: ip, user_agent: ua,
      metadata: { reason: 'no_active_access', organization_id },
    });
    return json({ error: 'no_access' }, 403);
  }

  const code = randomCode();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  const { error: insErr } = await admin.from('alix_auth_transactions').insert({
    identity_id: identity.id,
    application_id: app.id,
    organization_id: validAccess.organization_id ?? null,
    authorization_code_hash: codeHash,
    code_challenge,
    code_challenge_method,
    redirect_uri,
    scope: Array.isArray(scope) ? scope : [],
    expires_at: expiresAt,
    status: 'created',
  });

  if (insErr) {
    await logEvent(admin, {
      identity_id: identity.id, application_id: app.id, event_type: 'sso_authorize_error',
      severity: 'error', success: false, metadata: { db: insErr.message },
    });
    return json({ error: 'internal_error' }, 500);
  }

  await logEvent(admin, {
    identity_id: identity.id, application_id: app.id, organization_id: validAccess.organization_id ?? null,
    event_type: 'sso_authorize_issued', ip_address: ip, user_agent: ua,
    metadata: { app_key, state_len: state.length },
  });

  const sep = redirect_uri.includes('?') ? '&' : '?';
  return json({
    redirect: `${redirect_uri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    expires_in: 60,
  });
});
