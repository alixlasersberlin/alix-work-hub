import { createClient } from 'npm:@supabase/supabase-js@2';
import { activeMessageAccount } from './message-access.ts';

// Public project keys and unverified JWT claims are never job credentials.
export function machineAuthorized(req: Request, cronSecret: string, serviceKey: string): boolean {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  return (!!cronSecret && (req.headers.get('x-cron-secret') === cronSecret || bearer === cronSecret))
    || (!!serviceKey && (bearer === serviceKey || req.headers.get('apikey') === serviceKey));
}

export async function requireJobAccess(req: Request, cors: Record<string, string>, roles: string[] = []): Promise<Response | null> {
  const reject = (status: number) => new Response(JSON.stringify({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (machineAuthorized(req, Deno.env.get('CRON_SECRET') ?? '', serviceKey)) return null;
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !roles.length) return reject(401);
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error } = await caller.auth.getUser(token);
  if (error || !identity.user) return reject(401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('user_profiles')
    .select('is_active,account_status,invitation_status,password_reset_required').eq('id', identity.user.id).maybeSingle();
  if (profileError || !activeMessageAccount(profile)) return reject(403);
  const { data: assigned, error: roleError } = await admin.from('user_roles')
    .select('roles:role_id(name)').eq('user_id', identity.user.id);
  if (roleError || !(assigned ?? []).some((row: any) => roles.includes(row.roles?.name))) return reject(403);
  return null;
}