export const LEAD_ACCESS_ROLES = ['Admin', 'Super Admin'];

export function canAccessSalesLeads(roles: readonly string[]): boolean {
  return roles.some(role => LEAD_ACCESS_ROLES.includes(role));
}

export function isSalesLeadPath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return pathname === '/verkauf/neue-anfrage'
    || pathname === '/verkauf/anfragen'
    || pathname.startsWith('/verkauf/anfragen/');
}