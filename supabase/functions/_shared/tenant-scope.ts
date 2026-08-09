// Data Scope (Mandantenfähigkeit) für Edge Functions.
// Edge Functions laufen mit service_role und umgehen damit RLS —
// deshalb muss der Mandanten-Scope hier explizit geprüft werden.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

export const adminClient = (): SupabaseClient => createClient(SUPABASE_URL, SERVICE_KEY);

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
  if (!bearer) return none;
  if (bearer === SERVICE_KEY) {
    return { serviceRole: true, userId: null, codes: [], sourceSystems: [], tenantIds: [], restricted: false };
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: u } = await userClient.auth.getUser(bearer);
  if (!u?.user) return none;

  const admin = adminClient();
  const [{ data: tenants }, { data: access }] = await Promise.all([
    admin.from("tenants").select("id, code, zoho_source_system").eq("is_active", true),
    admin.from("user_tenant_access").select("tenant_id").eq("user_id", u.user.id),
  ]);

  const all = (tenants ?? []) as any[];
  const ids = new Set(((access ?? []) as any[]).map((r) => r.tenant_id));
  // Keine Zuweisung = keine Einschränkung (entspricht tenant_scope_restricted() in der DB)
  const restricted = ids.size > 0;
  const allowed = restricted ? all.filter((t) => ids.has(t.id)) : all;

  return {
    serviceRole: false,
    userId: u.user.id,
    codes: allowed.map((t) => t.code),
    sourceSystems: allowed.map((t) => t.zoho_source_system).filter(Boolean),
    tenantIds: allowed.map((t) => t.id),
    restricted,
  };
}

/** Prüft, ob ein source_system im Scope liegt. */
export function sourceInScope(scope: TenantScope, source?: string | null): boolean {
  if (scope.serviceRole || !scope.restricted) return true;
  if (!source) return true; // mandantenneutrale Datensätze
  return scope.sourceSystems.includes(source);
}

/** Prüft, ob eine tenant_id im Scope liegt. */
export function tenantInScope(scope: TenantScope, tenantId?: string | null): boolean {
  if (scope.serviceRole || !scope.restricted) return true;
  if (!tenantId) return true;
  return scope.tenantIds.includes(tenantId);
}

/** Prüft einen Kunden gegen den Scope (source_system + tenant_id). */
export async function customerInScope(scope: TenantScope, customerId: string): Promise<boolean> {
  if (scope.serviceRole || !scope.restricted) return true;
  const { data } = await adminClient()
    .from("customers").select("source_system").eq("id", customerId).maybeSingle();
  if (!data) return false;
  return sourceInScope(scope, (data as any).source_system);
}

/** Prüft einen Auftrag gegen den Scope. */
export async function orderInScope(scope: TenantScope, orderId: string): Promise<boolean> {
  if (scope.serviceRole || !scope.restricted) return true;
  const { data } = await adminClient()
    .from("orders").select("source_system").eq("id", orderId).maybeSingle();
  if (!data) return false;
  return sourceInScope(scope, (data as any).source_system);
}
