// Rollen, für die MFA (TOTP / Authenticator) verpflichtend ist.
// Alle anderen Rollen dürfen MFA freiwillig aktivieren.
export const MFA_REQUIRED_ROLES = [
  'Super Admin',
  'Admin',
  'Geschäftsführung',
  'Finance',
  'QM',
  'QMB',
  'Serviceleitung',
] as const;

export function isMfaMandatory(roles: string[] | null | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => (MFA_REQUIRED_ROLES as readonly string[]).includes(r));
}
