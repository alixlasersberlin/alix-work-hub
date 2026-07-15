// Portal Phase Feature Flag
// Phase 1 = nur Rechnungen + Stammdaten sichtbar. Alle anderen Portal-Routen
// werden per <Navigate to="/kunde"/> hart auf das Dashboard zurückgeleitet.
// Änderung: hier auf 2 stellen, sobald Angebote/Verträge/Tickets/Geräte freigegeben werden.
export const PORTAL_PHASE: 1 | 2 | 3 = 1;

export const PHASE_1_ROUTES = new Set<string>([
  '', // /kunde (Dashboard)
  'rechnungen',
  'meine-daten',
]);
