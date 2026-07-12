// Security Remediate — Ein-Klick-Fixes für Security-Findings
// Actions:
//  - deactivate_stale_sessions        → ruft public.security_deactivate_stale_sessions() auf
//  - invalidate_session { session_id }→ setzt eine Session inaktiv
//  - revoke_role { user_id, role_id } → entfernt einen Rollen-Eintrag
//  - set_bucket_private { bucket_id } → schaltet einen Storage-Bucket auf privat
//  - mark_finding_resolved { finding_id } → schließt ein Finding
// Alle Aktionen sind Super-Admin-only (JWT check + role check).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

async function requireSuperAdmin(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false as const, status: 401, error: 'missing token' };
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'invalid token' };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await admin
    .from('user_roles')
    .select('roles:role_id(name)')
    .eq('user_id', user.id);
  const names = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
  if (!names.includes('Super Admin')) return { ok: false as const, status: 403, error: 'forbidden' };
  return { ok: true as const, user, admin };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const g = await requireSuperAdmin(req);
    if (!g.ok) return json({ error: g.error }, g.status);
    const { admin, user } = g;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    const audit = async (act: string, target: string, meta: any) => {
      await admin.from('audit_logs').insert({
        user_id: user.id, action: `security_remediate:${act}`,
        entity_type: 'security', entity_id: target, metadata: meta,
      });
    };

    if (action === 'deactivate_stale_sessions') {
      const { data, error } = await admin.rpc('security_deactivate_stale_sessions' as any);
      if (error) return json({ error: error.message }, 400);
      await audit('deactivate_stale_sessions', 'login_sessions', { affected: data });
      return json({ ok: true, affected: data });
    }

    if (action === 'invalidate_session') {
      const sid = String(body?.session_id ?? '');
      if (!sid) return json({ error: 'session_id required' }, 400);
      const { error } = await admin.from('login_sessions').update({ is_active: false }).eq('id', sid);
      if (error) return json({ error: error.message }, 400);
      await audit('invalidate_session', sid, {});
      return json({ ok: true });
    }

    if (action === 'revoke_role') {
      const uid = String(body?.user_id ?? ''); const rid = String(body?.role_id ?? '');
      if (!uid || !rid) return json({ error: 'user_id & role_id required' }, 400);
      const { error } = await admin.from('user_roles').delete().eq('user_id', uid).eq('role_id', rid);
      if (error) return json({ error: error.message }, 400);
      await audit('revoke_role', `${uid}/${rid}`, {});
      return json({ ok: true });
    }

    if (action === 'set_bucket_private') {
      const bid = String(body?.bucket_id ?? '');
      if (!bid) return json({ error: 'bucket_id required' }, 400);
      // Direct REST call to storage admin
      const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
        body: JSON.stringify({ public: false }),
      });
      if (!res.ok) return json({ error: `bucket update failed ${res.status}` }, 400);
      await audit('set_bucket_private', `bucket:${bid}`, {});
      return json({ ok: true });
    }

    if (action === 'mark_finding_resolved') {
      const fid = String(body?.finding_id ?? '');
      if (!fid) return json({ error: 'finding_id required' }, 400);
      const { error } = await admin.from('security_audit_findings')
        .update({ status: 'resolved' }).eq('id', fid);
      if (error) return json({ error: error.message }, 400);
      await audit('mark_finding_resolved', fid, {});
      return json({ ok: true });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
