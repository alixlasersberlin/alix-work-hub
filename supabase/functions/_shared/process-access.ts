import { createClient } from 'npm:@supabase/supabase-js@2';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { requireCallerAccess } from './caller-access.ts';
import { machineAuthorized, requireJobAccess } from './job-auth.ts';

/** Existing private job credentials retain global job scope; humans never do. */
export async function requireProcessAccess(req: Request, cors: Record<string, string>, roles: string[]):Promise<{response:Response}|{machine:boolean;client:SupabaseClient;tenantIds:string[];userId:string|null;roles:string[]}> {
  if (req.method !== 'POST') return { response: new Response('Method not allowed', { status: 405, headers: cors }) };
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (machineAuthorized(req, Deno.env.get('CRON_SECRET') ?? '', key)) {
    const denied = await requireJobAccess(req, cors);
    if (denied) return { response: denied };
    return { machine: true as const, client: createClient(Deno.env.get('SUPABASE_URL') ?? '', key), tenantIds: [] as string[], userId: null, roles: [] as string[] };
  }
  const access = await requireCallerAccess(req, cors, roles);
  if ('response' in access) return access;
  return { machine: false as const, client: access.caller, tenantIds: access.tenants.map((t: any) => t.id as string), userId: access.user.id, roles: access.roles };
}

export const financeRoles = ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH'];

export function financeRegionAllowed(roles: string[], region: string): boolean {
  return roles.some((r) => ['Super Admin', 'Admin', 'Finance', 'Buchhaltung Admin'].includes(r))
    || roles.includes(region === 'CH' ? 'Buchhaltung CH' : 'Buchhaltung EU');
}

export function tenantObjectAllowed(ids: string[], tenant: unknown): boolean {
  return typeof tenant === 'string' && ids.includes(tenant);
}