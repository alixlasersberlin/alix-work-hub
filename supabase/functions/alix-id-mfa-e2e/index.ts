// Alix ID — Automatisierter MFA-Enforcement-E2E-Test.
// Läuft komplett serverseitig, damit SUPABASE_SERVICE_ROLE_KEY zur Verfügung
// steht und der Test aus /id-admin/applications per Klick reproduzierbar ist.
//
// POST { app_keys?: string[] }  → { results: Array<{ app_key, steps, ok }> }
//
// Pro App:
//   1. Testuser + Identity + Org + App-Access seed'en.
//   2. Sign-In per anon-Client (Password) → Bearer.
//   3. authorize ohne MFA → 403 mfa_required.
//   4. user_mfa_secrets fake-enrollen.
//   5. authorize erneut → 200 mit ?code=&state=.
//   6. alix-id-token tauschen → 200.
//   7. Reuse desselben Codes → 400.
//   8. Cleanup.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, json, requireAdminPermission, env, logEvent } from '../_shared/alix-id.ts';

const DEFAULT_APPS = ['alix_studio', 'alix_eanamnese', 'alix_finance'];
const REDIRECT_URI = 'https://e2e.alix.local/sso/callback';

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function rnd(len: number): Uint8Array {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b;
}
async function sha256url(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return b64url(new Uint8Array(buf));
}
type Step = { name: string; ok: boolean; detail?: string };
function step(name: string, ok: boolean, detail?: string): Step {
  return { name, ok, detail };
}

async function callFn(path: string, body: unknown, bearer: string, e: ReturnType<typeof env>) {
  const r = await fetch(`${e.url}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: e.anon,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let js: any = null;
  try { js = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: r.status, json: js, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await requireAdminPermission(req, 'manage_application');
  if ('error' in ctx) return ctx.error;
  const { admin, user: adminUser } = ctx;
  const e = env();

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const appKeys: string[] = Array.isArray(body?.app_keys) && body.app_keys.length
    ? body.app_keys
    : DEFAULT_APPS;

  const { data: apps, error: appsErr } = await admin
    .from('alix_applications')
    .select('id, app_key, app_status, requires_mfa, redirect_uris')
    .in('app_key', appKeys);
  if (appsErr) return json({ error: 'apps_query_failed', detail: appsErr.message }, 500);

  const results: Array<{ app_key: string; ok: boolean; steps: Step[] }> = [];

  for (const appKey of appKeys) {
    const steps: Step[] = [];
    const app = (apps ?? []).find((a: any) => a.app_key === appKey);
    if (!app) {
      results.push({ app_key: appKey, ok: false, steps: [step('app_lookup', false, 'unknown app_key')] });
      continue;
    }
    if (!app.requires_mfa) {
      results.push({ app_key: appKey, ok: false, steps: [step('requires_mfa', false, 'App ist nicht als MFA-pflichtig markiert')] });
      continue;
    }

    const stamp = Date.now();
    const email = `alix-e2e-${appKey}-${stamp}@alix-e2e.local`;
    const password = crypto.randomUUID() + 'A!9';
    let authUserId: string | null = null;
    let identityId: string | null = null;
    let orgId: string | null = null;
    const origRedirects: string[] = Array.isArray(app.redirect_uris) ? app.redirect_uris : [];
    const origStatus = app.app_status;

    try {
      // 1) Seed
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr) throw new Error(`createUser: ${cErr.message}`);
      authUserId = created.user!.id;
      steps.push(step('seed.user', true));

      const { data: identity, error: idErr } = await admin
        .from('alix_identities')
        .insert({ auth_user_id: authUserId, display_name: `E2E ${appKey}`, account_status: 'active', account_type: 'employee' })
        .select('id').single();
      if (idErr) throw new Error(`identity: ${idErr.message}`);
      identityId = identity.id;

      const { data: org, error: oErr } = await admin
        .from('alix_organizations')
        .insert({ organization_type: 'internal', legal_name: `E2E ${appKey}`, display_name: `E2E ${appKey}`, status: 'active' })
        .select('id').single();
      if (oErr) throw new Error(`org: ${oErr.message}`);
      orgId = org.id;

      const { error: accErr } = await admin.from('alix_identity_app_access').insert({
        identity_id: identityId, application_id: app.id, organization_id: orgId,
        access_status: 'active', app_role: 'user',
      });
      if (accErr) throw new Error(`access: ${accErr.message}`);
      steps.push(step('seed.identity_org_access', true));

      // Redirect + Status patchen (nur für Test)
      const patched = origRedirects.includes(REDIRECT_URI) ? origRedirects : [...origRedirects, REDIRECT_URI];
      await admin.from('alix_applications')
        .update({ redirect_uris: patched, app_status: 'active' })
        .eq('id', app.id);

      // 2) Sign-In → Bearer
      const userClient = createClient(e.url, e.anon, { auth: { persistSession: false } });
      const { data: si, error: siErr } = await userClient.auth.signInWithPassword({ email, password });
      if (siErr) throw new Error(`signIn: ${siErr.message}`);
      const bearer = si.session!.access_token;
      steps.push(step('sign_in', true));

      // 3) authorize OHNE MFA → 403 mfa_required
      const verifier = b64url(rnd(48));
      const challenge = await sha256url(verifier);
      const state = b64url(rnd(12));
      const authorizeBody = {
        app_key: appKey,
        organization_id: orgId,
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        scope: ['openid', 'profile'],
      };
      const r1 = await callFn('alix-id-authorize', authorizeBody, bearer, e);
      const ok1 = r1.status === 403 && r1.json?.error === 'mfa_required';
      steps.push(step('authorize.without_mfa_403', ok1,
        ok1 ? undefined : `status=${r1.status} body=${r1.text.slice(0, 200)}`));
      if (!ok1) throw new Error('mfa_required-Gate offen');

      // 4) Fake TOTP enrollen
      const { error: mfaErr } = await admin.from('user_mfa_secrets').upsert({
        user_id: authUserId,
        totp_secret_encrypted: 'e2e-fake-secret',
        totp_confirmed_at: new Date().toISOString(),
        enrolled_at: new Date().toISOString(),
        disabled_at: null,
      }, { onConflict: 'user_id' });
      if (mfaErr) throw new Error(`totp_seed: ${mfaErr.message}`);
      steps.push(step('enroll.totp_fake', true));

      // 5) authorize MIT MFA
      const r2 = await callFn('alix-id-authorize', authorizeBody, bearer, e);
      const ok2 = r2.status === 200 && typeof r2.json?.redirect === 'string' && r2.json.redirect.startsWith(REDIRECT_URI);
      steps.push(step('authorize.with_mfa_200', ok2,
        ok2 ? undefined : `status=${r2.status} body=${r2.text.slice(0, 200)}`));
      if (!ok2) throw new Error('authorize nach Enrollment fehlgeschlagen');

      const u = new URL(r2.json.redirect);
      const code = u.searchParams.get('code') ?? '';
      const returnedState = u.searchParams.get('state') ?? '';
      const ok2b = code.length > 20 && returnedState === state;
      steps.push(step('authorize.code_and_state', ok2b));

      // 6) token-Exchange
      const r3 = await callFn('alix-id-token',
        { code, code_verifier: verifier, redirect_uri: REDIRECT_URI }, bearer, e);
      const ok3 = r3.status === 200 && r3.json?.application?.key === appKey && r3.json?.identity?.auth_user_id === authUserId;
      steps.push(step('token.exchange_200', ok3,
        ok3 ? undefined : `status=${r3.status} body=${r3.text.slice(0, 200)}`));
      if (!ok3) throw new Error('token-Exchange fehlgeschlagen');

      // 7) Reuse → 400
      const r4 = await callFn('alix-id-token',
        { code, code_verifier: verifier, redirect_uri: REDIRECT_URI }, bearer, e);
      const ok4 = r4.status === 400;
      steps.push(step('token.reuse_400', ok4,
        ok4 ? undefined : `status=${r4.status} body=${r4.text.slice(0, 200)}`));

      const allOk = steps.every((s) => s.ok);
      results.push({ app_key: appKey, ok: allOk, steps });
    } catch (err: any) {
      steps.push(step('exception', false, err?.message ?? String(err)));
      results.push({ app_key: appKey, ok: false, steps });
    } finally {
      // Cleanup — FK-Reihenfolge
      try {
        if (identityId) {
          await admin.from('alix_auth_transactions').delete().eq('identity_id', identityId);
          await admin.from('alix_security_events').delete().eq('identity_id', identityId);
          await admin.from('alix_identity_app_access').delete().eq('identity_id', identityId);
          await admin.from('alix_identities').delete().eq('id', identityId);
        }
        if (orgId) await admin.from('alix_organizations').delete().eq('id', orgId);
        if (authUserId) {
          await admin.from('user_mfa_secrets').delete().eq('user_id', authUserId);
          await admin.auth.admin.deleteUser(authUserId);
        }
        await admin.from('alix_applications')
          .update({ redirect_uris: origRedirects, app_status: origStatus })
          .eq('id', app.id);
      } catch { /* Cleanup ist best-effort */ }
    }
  }

  const overall = results.every((r) => r.ok);
  await logEvent(admin, {
    event_type: overall ? 'mfa_e2e_test_pass' : 'mfa_e2e_test_fail',
    severity: overall ? 'info' : 'error',
    success: overall,
    metadata: { by: adminUser.id, apps: appKeys, results: results.map((r) => ({ app: r.app_key, ok: r.ok })) },
  });

  return json({ ok: overall, results });
});
