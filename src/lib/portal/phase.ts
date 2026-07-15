// Portal Phase Feature Flag
// Phase 1 = nur Rechnungen + Stammdaten
// Phase 2 = zusätzlich Geräte, Verträge, Tickets (Read + Ticket-Anlage/Antwort)
// Phase 3 = alles Weitere (Bestellungen, Katalog, Angebote, Termine, …)
export const PORTAL_PHASE: number = 2;

const P1 = ['', 'rechnungen', 'meine-daten'];
const P2 = [...P1, 'geraete', 'vertraege', 'tickets'];

export const PHASE_ROUTES = new Set<string>(
  PORTAL_PHASE >= 3
    ? [...P2, 'nachrichten', 'dokumente', 'angebote', 'reparaturen', 'support', 'bewertungen', 'verlauf', 'bestellungen', 'wartungen', 'garantien', 'termine', 'gesundheit', 'katalog', 'warenkorb']
    : PORTAL_PHASE === 2 ? P2 : P1
);

// Rückwärtskompatibel
export const PHASE_1_ROUTES = PHASE_ROUTES;
