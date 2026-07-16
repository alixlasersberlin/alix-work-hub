// Portal Phase Feature Flag
// Phase 1 = nur Rechnungen + Stammdaten
// Phase 2 = zusätzlich Geräte, Verträge, Tickets
// Phase 3 = zusätzlich Angebote, Garantie, Wartungsanfragen, Nachrichten, Dokumente,
//           Benachrichtigungen, Sicherheit (Sub-Phase 2b/2c/2d — Vertragssignatur folgt in 2c)
export const PORTAL_PHASE: number = 3;

const P1 = ['', 'rechnungen', 'meine-daten'];
const P2 = [...P1, 'geraete', 'vertraege', 'tickets'];
const P3 = [
  ...P2,
  'angebote',
  'angebote/:id',
  'garantie',
  'wartungen',
  'nachrichten',
  'nachrichten/:id',
  'dokumente',
  'benachrichtigungen',
  'sicherheit',
];

export const PHASE_ROUTES = new Set<string>(
  PORTAL_PHASE >= 3 ? P3 : PORTAL_PHASE === 2 ? P2 : P1,
);

// Rückwärtskompatibel
export const PHASE_1_ROUTES = PHASE_ROUTES;
