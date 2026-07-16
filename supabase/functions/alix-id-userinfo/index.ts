// Alix ID — Userinfo endpoint
// GET/POST with caller Supabase auth. Returns identity + orgs + app catalog with access flag.
import { corsHeaders, json, authIdentity } from '../_shared/alix-id.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'method_not_allowed' }, 405);

  const ctx = await authIdentity(req);
  if ('error' in ctx) return ctx.error;
  const { admin, identity, user } = ctx;

  const [{ data: orgs }, { data: apps }, { data: access }] = await Promise.all([
    admin.from('alix_identity_organizations')
      .select('id, relationship_type, relationship_status, is_primary, valid_until, organization:alix_organizations(id, legal_name, display_name, organization_type, status, country, linked_customer_id)')
      .eq('identity_id', identity.id)
      .eq('relationship_status', 'active'),
    admin.from('alix_applications')
      .select('id, app_key, app_name, description, icon_url, base_url, app_status, sort_order')
      .neq('app_status', 'archived')
      .order('sort_order'),
    admin.from('alix_identity_app_access')
      .select('application_id, organization_id, app_role, permissions, access_status, valid_until')
      .eq('identity_id', identity.id)
      .eq('access_status', 'active'),
  ]);

  const accessByApp = new Map<string, any[]>();
  for (const a of access ?? []) {
    if (!accessByApp.has(a.application_id)) accessByApp.set(a.application_id, []);
    accessByApp.get(a.application_id)!.push(a);
  }

  const appsOut = (apps ?? []).map((app) => ({
    ...app,
    has_access: accessByApp.has(app.id),
    access: accessByApp.get(app.id) ?? [],
  }));

  return json({
    identity: {
      id: identity.id,
      auth_user_id: identity.auth_user_id,
      email: user.email,
      display_name: identity.display_name,
      account_type: identity.account_type,
      preferred_language: identity.preferred_language,
      last_login_at: identity.last_login_at,
    },
    organizations: orgs ?? [],
    applications: appsOut,
  });
});
