import { supabase } from '@/integrations/supabase/client';

// Kritische Rechte (Namensmuster). Werden gegen roles.name gematcht,
// damit Bewertung ohne security_permissions-Zuweisung funktioniert.
export const CRITICAL_ROLE_NAMES = new Set<string>([
  'Super Admin',
  'Admin',
  'FACTORY INVOICE',
  'Finance',
  'Finanzierungen',
]);

export const CRITICAL_PERMISSION_KEYWORDS = [
  'delete', 'export', 'admin', 'super', 'finance', 'invoice',
  'bank', 'sepa', 'datev', 'secret', 'api_key', 'password',
];

export type RoleRow = { id: string; name: string; description: string | null };
export type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  account_status: string | null;
  department_id: string | null;
};

export type UserRoleAssignment = { user_id: string; role_id: string };

export type EffectiveRole = {
  role_id: string;
  role_name: string;
  source: 'primary' | 'temporary';
  valid_until: string | null;
  granted_by: string | null;
};

export type SecurityScore = {
  score: number;
  level: 'safe' | 'review' | 'risk' | 'critical';
  reasons: string[];
};

export function scoreForRole(role: RoleRow, userCount: number): SecurityScore {
  const reasons: string[] = [];
  let score = 100;
  const isCritical = CRITICAL_ROLE_NAMES.has(role.name);
  if (isCritical) { score -= 25; reasons.push('Enthält kritische Systemrechte'); }
  if (!role.description) { score -= 10; reasons.push('Keine Beschreibung hinterlegt'); }
  if (userCount === 0) { score -= 5; reasons.push('Rolle nicht zugewiesen (ungenutzt)'); }
  if (userCount > 20) { score -= 10; reasons.push('Viele Benutzer'); }
  score = Math.max(0, Math.min(100, score));
  const level: SecurityScore['level'] =
    score >= 90 ? 'safe' : score >= 70 ? 'review' : score >= 40 ? 'risk' : 'critical';
  return { score, level, reasons };
}

export function scoreForUser(opts: {
  isActive: boolean;
  status: string | null;
  roleCount: number;
  hasCriticalRole: boolean;
  hasTenant: boolean;
}): SecurityScore {
  const reasons: string[] = [];
  let score = 100;
  if (!opts.isActive) { score -= 40; reasons.push('Benutzer ist inaktiv'); }
  if (opts.status && opts.status !== 'active') { score -= 20; reasons.push(`Status: ${opts.status}`); }
  if (opts.roleCount === 0) { score -= 30; reasons.push('Keine Rolle zugewiesen'); }
  if (opts.roleCount >= 4) { score -= 10; reasons.push('Sehr viele Rollen'); }
  if (opts.hasCriticalRole) { score -= 15; reasons.push('Kritische Rolle aktiv'); }
  if (!opts.hasTenant) { score -= 10; reasons.push('Keine Niederlassung zugeordnet'); }
  score = Math.max(0, Math.min(100, score));
  const level: SecurityScore['level'] =
    score >= 90 ? 'safe' : score >= 70 ? 'review' : score >= 40 ? 'risk' : 'critical';
  return { score, level, reasons };
}

export function levelClasses(level: SecurityScore['level']) {
  switch (level) {
    case 'safe': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    case 'review': return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    case 'risk': return 'bg-orange-500/10 text-orange-500 border-orange-500/30';
    case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/30';
  }
}

export function levelLabel(level: SecurityScore['level']) {
  return level === 'safe' ? 'Sicher'
    : level === 'review' ? 'Prüfung empfohlen'
    : level === 'risk' ? 'Erhöhtes Risiko' : 'Kritisch';
}

export async function fetchOverviewData() {
  const [roles, users, userRoles, tenants, uta, requests, temp, audit] = await Promise.all([
    supabase.from('roles').select('id, name, description'),
    supabase.from('user_profiles').select('id, full_name, email, is_active, account_status, department_id'),
    supabase.from('user_roles').select('user_id, role_id'),
    supabase.from('tenants').select('id, code, name, country'),
    supabase.from('user_tenant_access').select('user_id, tenant_id'),
    (supabase as any).from('role_change_requests').select('id, status, urgency').eq('status', 'open'),
    (supabase as any).from('role_temporary_grants').select('id, valid_until, status').eq('status', 'active'),
    (supabase as any).from('role_audit_log').select('id, created_at').order('created_at', { ascending: false }).limit(1),
  ]);
  return {
    roles: (roles.data ?? []) as RoleRow[],
    users: (users.data ?? []) as UserProfile[],
    userRoles: (userRoles.data ?? []) as UserRoleAssignment[],
    tenants: tenants.data ?? [],
    userTenants: uta.data ?? [],
    openRequests: requests.data ?? [],
    activeTempGrants: temp.data ?? [],
    lastAudit: audit.data?.[0] ?? null,
  };
}
