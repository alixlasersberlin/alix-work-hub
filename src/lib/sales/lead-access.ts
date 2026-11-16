export const LEAD_ACCESS_ROLES = ['Super Admin'];
export const INQUIRY_READ_ROLE = 'Verkaufsanfragen lesen';
export const INQUIRY_READ_ROLES = [...LEAD_ACCESS_ROLES, INQUIRY_READ_ROLE];

export function canReadSalesInquiries(roles: readonly string[]): boolean {
  return roles.some(role => INQUIRY_READ_ROLES.includes(role));
}

export function canAccessSalesInquiryPath(roles: readonly string[], path: string): boolean {
  if (canAccessSalesLeads(roles)) return true;
  const pathname = path.split(/[?#]/)[0];
  const readPath = pathname === '/verkauf/anfragen'
    || /^\/verkauf\/anfragen\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);
  return readPath && canReadSalesInquiries(roles);
}

export function canAccessSalesLeads(roles: readonly string[]): boolean {
  return roles.some(role => LEAD_ACCESS_ROLES.includes(role));
}

export function isSalesLeadPath(path: string): boolean {
  const pathname = path.split(/[?#]/)[0];
  return pathname === '/verkauf/neue-anfrage'
    || pathname === '/verkauf/anfragen'
    || pathname.startsWith('/verkauf/anfragen/');
}