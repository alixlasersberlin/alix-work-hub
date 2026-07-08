export type EcpRole =
  | 'kunde'
  | 'haendler'
  | 'vertriebspartner'
  | 'servicepartner'
  | 'schulungsteilnehmer'
  | 'lieferant'
  | 'admin';

export const ROLE_LABELS: Record<EcpRole, string> = {
  kunde: 'Kunde',
  haendler: 'Händler',
  vertriebspartner: 'Vertriebspartner',
  servicepartner: 'Servicepartner',
  schulungsteilnehmer: 'Schulungsteilnehmer',
  lieferant: 'Lieferant',
  admin: 'Administrator',
};

const KEY = 'ecp:role:v1';
export function getEcpRole(): EcpRole {
  const v = (localStorage.getItem(KEY) as EcpRole) || 'kunde';
  return v;
}
export function setEcpRole(r: EcpRole) {
  localStorage.setItem(KEY, r);
}

export function canSee(role: EcpRole, feature: string): boolean {
  const rules: Record<string, EcpRole[]> = {
    dealer: ['haendler', 'vertriebspartner', 'admin'],
    servicepartner: ['servicepartner', 'admin'],
    supplier: ['lieferant', 'admin'],
    admin: ['admin'],
    trainings: ['kunde', 'schulungsteilnehmer', 'haendler', 'admin'],
    invoices: ['kunde', 'haendler', 'admin'],
    quotes: ['kunde', 'haendler', 'vertriebspartner', 'admin'],
    devices: ['kunde', 'servicepartner', 'admin'],
    tickets: ['kunde', 'haendler', 'servicepartner', 'admin'],
  };
  return !rules[feature] || rules[feature].includes(role);
}
