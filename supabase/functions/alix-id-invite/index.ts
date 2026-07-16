// Alix ID — Invite endpoint (admin only)
// POST { email, display_name?, organization_id, relationship_type?, application_ids: [], app_role?: 'viewer'|'user'|'admin' }
// Creates auth user (invite email via Supabase), identity, org-link, and app access rows.
import { corsHeaders, json, requireAdminPermission, logEvent } from '../_shared/alix-id.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const ctx = await requireAdminPermission(req, 'invite_identity');
  if ('error' in ctx) return ctx.error;
  const { admin, user: adminUser, ip, ua } = ctx;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const {
    email, display_name, organization_id,
    relationship_type = 'employee',
    application_ids = [], app_role = 'user',
  } = body ?? {};

  if (!email || !organization_id || !Array.isArray(application_ids) || application_ids.length === 0) {
    return json({ error: 'missing_parameters' }, 400);
  }
  const cleanEmail = String(email).trim().toLowerCase();

  // Check org exists
  const { data: org } = await admin.from('alix_organizations').select('id').eq('id', organization_id).maybeSingle();
  if (!org) return json({ error: 'organization_not_found' }, 404);

  // Invite / find auth user
  let authUserId: string | null = null;
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find((u) => (u.email ?? '').toLowerCase() === cleanEmail);
  if (found) {
    authUserId = found.id;
  } else {
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(cleanEmail);
    if (invErr || !invited?.user) {
      return json({ error: 'invite_failed', detail: invErr?.message }, 500);
    }
    authUserId = invited.user.id;
  }

  // Upsert identity
  let { data: identity } = await admin
    .from('alix_identities')
    .select('*')
    .eq('auth_user_id', authUserId!)
    .maybeSingle();

  if (!identity) {
    const { data: created, error } = await admin.from('alix_identities')
      .insert({ auth_user_id: authUserId, display_name: display_name ?? cleanEmail })
      .select('*').single();
    if (error) return json({ error: 'identity_create_failed', detail: error.message }, 500);
    identity = created;
  }

  // Upsert org link
  const { data: existingLink } = await admin.from('alix_identity_organizations')
    .select('id').eq('identity_id', identity.id).eq('organization_id', organization_id).maybeSingle();
  if (!existingLink) {
    await admin.from('alix_identity_organizations').insert({
      identity_id: identity.id, organization_id,
      relationship_type, relationship_status: 'active', is_primary: true,
    });
  }

  // Grant app access
  const rows = application_ids.map((application_id: string) => ({
    identity_id: identity!.id,
    organization_id,
    application_id,
    app_role,
    access_status: 'active',
    granted_by: adminUser.id,
  }));

  const created: string[] = [];
  for (const row of rows) {
    const { data: exists } = await admin.from('alix_identity_app_access')
      .select('id')
      .eq('identity_id', row.identity_id)
      .eq('organization_id', row.organization_id)
      .eq('application_id', row.application_id)
      .maybeSingle();
    if (exists) continue;
    const { data: ins, error } = await admin.from('alix_identity_app_access')
      .insert(row).select('id').single();
    if (!error && ins) created.push(ins.id);
  }

  await logEvent(admin, {
    identity_id: identity.id, organization_id,
    event_type: 'identity_invited',
    ip_address: ip, user_agent: ua,
    metadata: { email_domain: cleanEmail.split('@')[1] ?? null, application_count: application_ids.length },
  });

  return json({
    success: true,
    identity_id: identity.id,
    auth_user_id: authUserId,
    access_created: created.length,
  });
});
