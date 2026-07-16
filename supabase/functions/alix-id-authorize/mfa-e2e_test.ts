// Alix ID — Phase 3f/3g E2E-Test: MFA-Enforcement für MFA-pflichtige Apps.
//
// Ablauf pro App (Studio / eAnamnese / Finance):
//   1) Testuser + Identity + Org + App-Access seed'en.
//   2) `alix-id-authorize` ohne TOTP  → 403 {error:'mfa_required'}.
//   3) `user_mfa_secrets` fake-enrollen (totp_confirmed_at + enrolled_at).
//   4) `alix-id-authorize` erneut     → 200 mit `?code=…&state=…` Redirect.
//   5) `alix-id-token` mit korrektem PKCE-Verifier → 200 (identity + app).
//   6) Zweiter Tausch desselben Codes → 400 (Race-Schutz / code_used).
//   7) Cleanup aller angelegten Rows.
//
// Läuft im Edge-Function-Runtime via `supabase--test_edge_functions`:
// dort ist `SUPABASE_SERVICE_ROLE_KEY` gesetzt. `SUPABASE_URL` / `SUPABASE_ANON_KEY`
// werden von der Test-Umgebung ebenfalls bereitgestellt. Für den lokalen
// Deno-Aufruf zusätzlich Werte aus dem Repo-`.env` nachladen.
import 'https://deno.land/std@0.224.0/dotenv/load.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')!;
const ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('VITE_SUPABASE_PUBLISHABLE_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const REDIRECT_URI = 'https://e2e.alix.local/sso/callback';
const MFA_APP_KEYS = ['alix_studio', 'alix_eanamnese', 'alix_finance'] as const;

// ────────────────────────── Helpers ──────────────────────────

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomBytes(len: number): Uint8Array {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b;
}
async function sha256b64url(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return b64url(new Uint8Array(buf));
}
function pkce() {
  const verifier = b64url(randomBytes(48)); // 64 chars, meets 43..128
  return { verifier };
}
async function invoke(path: string, body: unknown, bearer: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: r.status, json, text };
}

// ────────────────────────── Test ──────────────────────────

Deno.test({
  name: 'Alix ID MFA-Enforcement E2E (Studio / eAnamnese / Finance)',
  sanitizeOps: false,
  sanitizeResources: false,
}, async (t) => {
  if (!SERVICE_KEY) {
    console.warn('[skip] SUPABASE_SERVICE_ROLE_KEY nicht gesetzt — Test übersprungen.');
    return;
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Alle MFA-Apps laden (unabhängig vom aktuellen app_status; Test soll
  // ausdrücklich vor der `active`-Umschaltung Sicherheit geben).
  const { data: apps, error: appsErr } = await admin
    .from('alix_applications')
    .select('id, app_key, app_status, requires_mfa, redirect_uris')
    .in('app_key', MFA_APP_KEYS as unknown as string[]);
  if (appsErr) throw appsErr;
  assert(apps && apps.length === MFA_APP_KEYS.length, 'MFA-Apps im Katalog vollständig?');

  for (const appKey of MFA_APP_KEYS) {
    await t.step(`app=${appKey}`, async () => {
      const app = apps.find((a: any) => a.app_key === appKey)!;
      assertEquals(app.requires_mfa, true, `${appKey}: requires_mfa muss true sein`);

      const stamp = Date.now();
      const email = `alix-e2e-${appKey}-${stamp}@alix-e2e.local`;
      const password = crypto.randomUUID() + 'A!9';

      // 1) auth.users
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr) throw cErr;
      const authUserId = created.user!.id;

      // 2) alix_identities
      const { data: identity, error: idErr } = await admin
        .from('alix_identities')
        .insert({
          auth_user_id: authUserId,
          display_name: `E2E ${appKey}`,
          account_status: 'active',
          account_type: 'employee',
        })
        .select('id').single();
      if (idErr) throw idErr;

      // 3) org + access
      const { data: org, error: oErr } = await admin
        .from('alix_organizations')
        .insert({
          organization_type: 'internal',
          legal_name: `E2E ${appKey} Org`,
          display_name: `E2E ${appKey}`,
          status: 'active',
        })
        .select('id').single();
      if (oErr) throw oErr;

      const { error: accErr } = await admin
        .from('alix_identity_app_access')
        .insert({
          identity_id: identity.id,
          application_id: app.id,
          organization_id: org.id,
          access_status: 'active',
          app_role: 'user',
        });
      if (accErr) throw accErr;

      // Sicherstellen, dass der Test-Redirect zugelassen ist (nur für Testlauf).
      const origRedirects: string[] = Array.isArray(app.redirect_uris) ? app.redirect_uris : [];
      const patchedRedirects = origRedirects.includes(REDIRECT_URI)
        ? origRedirects
        : [...origRedirects, REDIRECT_URI];
      await admin.from('alix_applications')
        .update({ redirect_uris: patchedRedirects })
        .eq('id', app.id);

      // Sicherstellen, dass app_status='active' — sonst blockt authorize schon vor MFA.
      const origStatus = app.app_status;
      if (origStatus !== 'active') {
        await admin.from('alix_applications').update({ app_status: 'active' }).eq('id', app.id);
      }

      // 4) Sign-in mit Anon-Client → Bearer JWT
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
      const { data: signIn, error: siErr } =
        await userClient.auth.signInWithPassword({ email, password });
      if (siErr) throw siErr;
      const bearer = signIn.session!.access_token;

      try {
        // 5) authorize OHNE MFA → 403 mfa_required
        const { verifier } = pkce();
        const challenge = await sha256b64url(verifier);
        const state = b64url(randomBytes(12).buffer);
        const authorizeBody = {
          app_key: appKey,
          organization_id: org.id,
          redirect_uri: REDIRECT_URI,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          scope: ['openid', 'profile'],
        };
        const r1 = await invoke('alix-id-authorize', authorizeBody, bearer);
        assertEquals(r1.status, 403, `Schritt 1: ${appKey} muss ohne MFA 403 liefern (got ${r1.status} ${r1.text})`);
        assertEquals(r1.json?.error, 'mfa_required', `Schritt 1: error=mfa_required erwartet (got ${JSON.stringify(r1.json)})`);

        // 6) Fake TOTP-Enrollment
        const { error: mfaErr } = await admin
          .from('user_mfa_secrets')
          .upsert({
            user_id: authUserId,
            totp_secret_encrypted: 'e2e-fake-secret',
            totp_confirmed_at: new Date().toISOString(),
            enrolled_at: new Date().toISOString(),
            disabled_at: null,
          }, { onConflict: 'user_id' });
        if (mfaErr) throw mfaErr;

        // 7) authorize MIT MFA → 200 mit redirect
        const r2 = await invoke('alix-id-authorize', authorizeBody, bearer);
        assertEquals(r2.status, 200, `Schritt 2: 200 erwartet (got ${r2.status} ${r2.text})`);
        const redirect: string = r2.json?.redirect ?? '';
        assert(redirect.startsWith(REDIRECT_URI), `Schritt 2: redirect_uri-Präfix (got ${redirect})`);
        const u = new URL(redirect);
        const code = u.searchParams.get('code')!;
        assertEquals(u.searchParams.get('state'), state, 'Schritt 2: state muss zurückkommen');
        assert(code && code.length > 20, 'Schritt 2: code vorhanden');

        // 8) token-Exchange → 200
        const r3 = await invoke('alix-id-token', {
          code, code_verifier: verifier, redirect_uri: REDIRECT_URI,
        }, bearer);
        assertEquals(r3.status, 200, `Schritt 3: token 200 erwartet (got ${r3.status} ${r3.text})`);
        assertEquals(r3.json?.application?.key, appKey, 'Schritt 3: app_key im Response');
        assertEquals(r3.json?.identity?.auth_user_id, authUserId, 'Schritt 3: identity.auth_user_id passt');

        // 9) zweiter Tausch → 400
        const r4 = await invoke('alix-id-token', {
          code, code_verifier: verifier, redirect_uri: REDIRECT_URI,
        }, bearer);
        assertEquals(r4.status, 400, `Schritt 4: Reuse muss 400 sein (got ${r4.status} ${r4.text})`);
      } finally {
        // Cleanup — Reihenfolge wichtig wegen FKs
        await admin.from('alix_auth_transactions').delete().eq('identity_id', identity.id);
        await admin.from('alix_security_events').delete().eq('identity_id', identity.id);
        await admin.from('alix_identity_app_access').delete().eq('identity_id', identity.id);
        await admin.from('alix_identities').delete().eq('id', identity.id);
        await admin.from('alix_organizations').delete().eq('id', org.id);
        await admin.from('user_mfa_secrets').delete().eq('user_id', authUserId);
        await admin.auth.admin.deleteUser(authUserId);
        // Redirect-URIs und Status zurücksetzen
        await admin.from('alix_applications')
          .update({ redirect_uris: origRedirects, app_status: origStatus })
          .eq('id', app.id);
      }
    });
  }
});
