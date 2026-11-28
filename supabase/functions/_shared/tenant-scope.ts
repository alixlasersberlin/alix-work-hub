// Data Scope (Mandantenfähigkeit) für Edge Functions.
// Edge Functions laufen mit service_role und umgehen damit RLS —
// deshalb muss der Mandanten-Scope hier explizit geprüft werden.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { requireCallerAccess } from './caller-access.ts';
import { machineAuthorized } from './job-auth.ts';


export interface TenantScope {
  /** true = Service-Role / Cron: kein Scope-Limit */
  serviceRole: boolean;
  userId: string | null;
  /** Mandanten-Codes, z. B. ["AT"] — leer = keine Zuweisung */
  codes: string[];
  /** Zoho source_system Werte der erlaubten Mandanten */
  sourceSystems: string[];
  /** Mandanten-UUIDs */
  tenantIds: string[];
  /** true = Zugriff eingeschränkt (nicht alle Mandanten) */
  restricted: boolean;
}

export const adminClient = (): SupabaseClient => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

/**
 * Ermittelt den Data Scope des Aufrufers aus dem Authorization-Header.
 * Service-Role-Aufrufe (Cron/interne Jobs) sind nicht eingeschränkt.
 */
export async function getTenantScope(req: Request): Promise<TenantScope> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const none: TenantScope = {
    serviceRole: false, userId: null, codes: [], sourceSystems: [], tenantIds: [], restricted: true,
  };
  if (machineAuthorized(req, Deno.env.get('CRON_SECRET') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
    return { serviceRole: true, userId: null, codes: [], sourceSystems: [], tenantIds: [], restricted: false };
  }
  if (!bearer) return none;

  const access = await requireCallerAccess(req, {});
  if ('response' in access) return none;
  const allowed = access.tenants;

  return {
    serviceRole: false,
    userId: access.user.id,
    codes: allowed.map((t) => t.code),
    sourceSystems: allowed.map((t) => t.zoho_source_system).filter(Boolean),
    tenantIds: allowed.map((t) => t.id),
    restricted: true,
  };
}

/** Prüft, ob ein source_system im Scope liegt. */
export function sourceInScope(scope: TenantScope, source?: string | null): boolean {
  if (scope.serviceRole || !scope.restricted) return true;
  if (!scope.userId || !scope.tenantIds.length || !source) return false;
  return scope.sourceSystems.includes(source);
}

/** Prüft, ob eine tenant_id im Scope liegt. */
export function tenantInScope(scope: TenantScope, tenantId?: string | null): boolean {
  if (scope.serviceRole || !scope.restricted) return true;
  if (!scope.userId || !scope.tenantIds.length || !tenantId) return false;
  return scope.tenantIds.includes(tenantId);
}

/** Prüft einen Kunden gegen den Scope (source_system + tenant_id). */
export async function customerInScope(scope: TenantScope, customerId: string): Promise<boolean> {
  if (scope.serviceRole || !scope.restricted) return true;
  if (!scope.userId || !scope.tenantIds.length) return false;
  const { data } = await adminClient()
    .from("customers").select("source_system").eq("id", customerId).maybeSingle();
  if (!data) return false;
  return sourceInScope(scope, (data as any).source_system);
}

/** Prüft einen Auftrag gegen den Scope. */
export async function orderInScope(scope: TenantScope, orderId: string): Promise<boolean> {
  if (scope.serviceRole || !scope.restricted) return true;
  if (!scope.userId || !scope.tenantIds.length) return false;
  const { data } = await adminClient()
    .from("orders").select("source_system").eq("id", orderId).maybeSingle();
  if (!data) return false;
  return sourceInScope(scope, (data as any).source_system);
}
