// MFA-Politik: MFA ist für ALLE Rollen verpflichtend.
// Einzige Ausnahme: "Lieferant Jerry" (externer Lieferantenzugang).
export const MFA_EXEMPT_ROLES = ['Lieferant Jerry'] as const;

// Beibehalten für UI-Anzeige (Sicherheit-Seite zeigt diese Liste an).
export const MFA_REQUIRED_ROLES = ['Alle Rollen außer Lieferant Jerry'] as const;

export function isMfaMandatory(roles: string[] | null | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  // MFA Pflicht, sobald der User mindestens eine Rolle hat, die NICHT exempt ist.
  return roles.some((r) => !(MFA_EXEMPT_ROLES as readonly string[]).includes(r));
}
