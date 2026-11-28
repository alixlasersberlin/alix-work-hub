import { createClient } from 'npm:@supabase/supabase-js@2';
import { activeMessageAccount } from './message-access.ts';

/** Role names are assigned identities, never inherited or read from JWT metadata. */
export function assignedRoleAllowed(assigned: string[], required: string[]): boolean {
  return required.length === 0 || required.some((role) => assigned.includes(role));
}

export async function requireCallerAccess(req: Request, cors: Record<string, string>, requiredRoles: string[] = []) {
  const deny = (status: number) => ({ response: new Response(JSON.stringify({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  }) });
  const header = req.headers.get('authorization') ?? '';
  const token = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
  if (!token) return deny(401);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anon || !key) return deny(503);
  // This helper is interactive only; machines use the existing job-auth gate.
  if (token === anon || token === key) return deny(401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await caller.auth.getUser(token);
  if (authError || !identity.user) return deny(401);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Only identity/authorization records may be read before authorization.
  const { data: profile, error: profileError } = await admin.from('user_profiles')
    .select('is_active,account_status,invitation_status,password_reset_required').eq('id', identity.user.id).maybeSingle();
  if (profileError || !activeMessageAccount(profile)) return deny(403);
  const { data: roles, error: roleError } = await admin.from('user_roles').select('roles:role_id(name)').eq('user_id', identity.user.id);
  const assigned = (roles ?? []).flatMap((row: any) => typeof row.roles?.name === 'string' ? [row.roles.name] : []);
  if (roleError || !assigned.length || !assignedRoleAllowed(assigned, requiredRoles)) return deny(403);
  const { data: memberships, error: membershipError } = await admin.from('user_tenant_access').select('tenant_id').eq('user_id', identity.user.id);
  if (membershipError || !memberships?.length) return deny(403);
  const { data: tenants, error: tenantError } = await admin.from('tenants').select('id,code,zoho_source_system').eq('is_active', true)
    .in('id', memberships.map((row: any) => row.tenant_id));
  if (tenantError || !tenants?.length) return deny(403);
  return { caller, user: identity.user, roles: assigned, tenants };
}