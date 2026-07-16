// Alix ID — Admin actions
// POST { action, ... }
//   action=suspend_identity | reactivate_identity | grant_access | revoke_access | update_application
import { corsHeaders, json, requireAdminPermission, logEvent } from '../_shared/alix-id.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const action = body?.action as string;
  if (!action) return json({ error: 'missing_action' }, 400);

  const permMap: Record<string, string> = {
    suspend_identity: 'manage_identity',
    reactivate_identity: 'manage_identity',
    grant_access: 'manage_access',
    revoke_access: 'manage_access',
    update_application: 'manage_application',
  };
  const requiredPerm = permMap[action];
  if (!requiredPerm) return json({ error: 'unknown_action' }, 400);

  const ctx = await requireAdminPermission(req, requiredPerm);
  if ('error' in ctx) return ctx.error;
  const { admin, user: adminUser, ip, ua } = ctx;

  try {
    switch (action) {
      case 'suspend_identity': {
        const { identity_id, reason } = body;
        if (!identity_id) return json({ error: 'missing_identity_id' }, 400);
        await admin.from('alix_identities')
          .update({ account_status: 'suspended' })
          .eq('id', identity_id);
        await admin.from('alix_auth_transactions')
          .update({ status: 'revoked', used_at: new Date().toISOString() })
          .eq('identity_id', identity_id)
          .is('used_at', null);
        await logEvent(admin, {
          identity_id, event_type: 'identity_suspended', severity: 'warn',
          ip_address: ip, user_agent: ua, metadata: { by: adminUser.id, reason: reason ?? null },
        });
        return json({ success: true });
      }
      case 'reactivate_identity': {
        const { identity_id } = body;
        if (!identity_id) return json({ error: 'missing_identity_id' }, 400);
        await admin.from('alix_identities')
          .update({ account_status: 'active' })
          .eq('id', identity_id);
        await logEvent(admin, {
          identity_id, event_type: 'identity_reactivated',
          ip_address: ip, user_agent: ua, metadata: { by: adminUser.id },
        });
        return json({ success: true });
      }
      case 'grant_access': {
        const { identity_id, organization_id, application_id, app_role = 'user', permissions = [], valid_until = null } = body;
        if (!identity_id || !application_id) return json({ error: 'missing_parameters' }, 400);
        const { data: exists } = await admin.from('alix_identity_app_access')
          .select('id').eq('identity_id', identity_id)
          .eq('application_id', application_id)
          .eq('organization_id', organization_id ?? null)
          .maybeSingle();
        let id = exists?.id;
        if (exists) {
          await admin.from('alix_identity_app_access').update({
            access_status: 'active', app_role, permissions,
            valid_until, revoked_at: null, revoked_by: null, revoke_reason: null,
            granted_by: adminUser.id, granted_at: new Date().toISOString(),
          }).eq('id', exists.id);
        } else {
          const { data: ins } = await admin.from('alix_identity_app_access').insert({
            identity_id, organization_id, application_id, app_role, permissions,
            valid_until, granted_by: adminUser.id, access_status: 'active',
          }).select('id').single();
          id = ins?.id;
        }
        await logEvent(admin, {
          identity_id, application_id, organization_id,
          event_type: 'access_granted',
          ip_address: ip, user_agent: ua, metadata: { by: adminUser.id, app_role },
        });
        return json({ success: true, access_id: id });
      }
      case 'revoke_access': {
        const { access_id, reason } = body;
        if (!access_id) return json({ error: 'missing_access_id' }, 400);
        const { data: row } = await admin.from('alix_identity_app_access')
          .select('identity_id, application_id, organization_id').eq('id', access_id).maybeSingle();
        await admin.from('alix_identity_app_access').update({
          access_status: 'revoked',
          revoked_by: adminUser.id,
          revoked_at: new Date().toISOString(),
          revoke_reason: reason ?? null,
        }).eq('id', access_id);
        await logEvent(admin, {
          identity_id: row?.identity_id, application_id: row?.application_id, organization_id: row?.organization_id,
          event_type: 'access_revoked', severity: 'warn',
          ip_address: ip, user_agent: ua, metadata: { by: adminUser.id, reason: reason ?? null },
        });
        return json({ success: true });
      }
      case 'update_application': {
        const { application_id, patch } = body;
        if (!application_id || !patch || typeof patch !== 'object') return json({ error: 'missing_parameters' }, 400);
        const allowed = ['app_name', 'description', 'base_url', 'icon_url', 'redirect_uris', 'allowed_origins', 'app_status', 'requires_mfa', 'session_duration_minutes', 'sort_order'];
        const clean: Record<string, unknown> = {};
        for (const k of allowed) if (k in patch) clean[k] = patch[k];
        if (Object.keys(clean).length === 0) return json({ error: 'nothing_to_update' }, 400);
        await admin.from('alix_applications').update(clean).eq('id', application_id);
        await logEvent(admin, {
          application_id, event_type: 'application_updated',
          ip_address: ip, user_agent: ua, metadata: { by: adminUser.id, fields: Object.keys(clean) },
        });
        return json({ success: true });
      }
    }
  } catch (e: any) {
    return json({ error: 'internal_error', detail: e?.message }, 500);
  }
  return json({ error: 'unhandled' }, 500);
});
