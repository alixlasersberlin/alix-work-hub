// Alix ID — Logout endpoint
// POST { scope?: 'global' | 'this' }
// Logs the security event; caller-side calls supabase.auth.signOut() and clears
// RP cookies. 'global' also invalidates all pending authorization codes.
import { corsHeaders, json, authIdentity, logEvent } from '../_shared/alix-id.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authIdentity(req);
  if ('error' in ctx) return ctx.error;
  const { admin, identity, ip, ua } = ctx;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const scope = body?.scope === 'global' ? 'global' : 'this';

  if (scope === 'global') {
    await admin.from('alix_auth_transactions')
      .update({ status: 'revoked', used_at: new Date().toISOString() })
      .eq('identity_id', identity.id)
      .is('used_at', null);
  }

  await logEvent(admin, {
    identity_id: identity.id,
    event_type: 'logout',
    ip_address: ip, user_agent: ua,
    metadata: { scope },
  });

  return json({ success: true, scope });
});
