// Enterprise Mobile Platform — role mapping (mobile personas)
export type EmpPersona = 'technik' | 'vertrieb' | 'dozent' | 'logistik' | 'management' | 'default';

const MAP: Array<{ persona: EmpPersona; roles: string[] }> = [
  { persona: 'management', roles: ['Super Admin', 'Admin', 'Vertriebsleitung', 'Geschäftsleitung'] },
  { persona: 'technik', roles: ['Technik', 'Service', 'Reparaturannahme'] },
  { persona: 'vertrieb', roles: ['Vertrieb', 'Order', 'Auftragsverwaltung'] },
  { persona: 'dozent', roles: ['Dozent', 'Schulung'] },
  { persona: 'logistik', roles: ['Tourenplanung', 'Logistik', 'Versand'] },
];

export function detectPersona(roles: string[]): EmpPersona {
  for (const m of MAP) {
    if (roles.some((r) => m.roles.includes(r))) return m.persona;
  }
  return 'default';
}

export const personaLabel: Record<EmpPersona, string> = {
  technik: 'Servicetechniker',
  vertrieb: 'Vertrieb',
  dozent: 'Dozent',
  logistik: 'Logistik',
  management: 'Geschäftsleitung',
  default: 'Mobile',
};
