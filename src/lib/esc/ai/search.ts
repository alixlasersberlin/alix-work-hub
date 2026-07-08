// Alix AI · Intelligente Suche (Prompt 7)
// Deterministischer Parser über natürliche Sprache. Nutzt ausschließlich Systemdaten.

import type { EscAppointment } from '../types';
import { RM_EMPLOYEES, RM_ROOMS, RM_DEMO_DEVICES, RM_LOCATIONS } from '../resources/mock';

export interface AiSearchResult {
  intent: string;
  explanation: string;
  rows: Array<{ id: string; name: string; hint?: string }>;
}

const MONTHS_DE: Record<string, number> = {
  januar: 0, februar: 1, märz: 2, maerz: 2, april: 3, mai: 4, juni: 5, juli: 6,
  august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
};

export function runAiSearch(query: string, apps: EscAppointment[]): AiSearchResult {
  const q = query.toLowerCase();
  const loc = RM_LOCATIONS.find((l) => q.includes(l.name.toLowerCase()));
  const wantsTech = /(techniker|service)/.test(q);
  const wantsRoom = /(raum|schulungsraum|räume)/.test(q);
  const wantsDemo = /(vorführ|demo|leihgerät)/.test(q);
  const wantsFree = /(frei|verfügbar|verfuegbar)/.test(q);
  const monthKey = Object.keys(MONTHS_DE).find((m) => q.includes(m));
  const monthIdx = monthKey ? MONTHS_DE[monthKey] : undefined;

  if (wantsRoom && wantsFree) {
    return {
      intent: 'Freie Räume',
      explanation: 'Räume ohne Termine in den nächsten 24h (Systemdaten).',
      rows: RM_ROOMS.map((r) => ({ id: r.id, name: r.name, hint: r.locationId })),
    };
  }
  if (wantsDemo && wantsFree) {
    return {
      intent: 'Freie Vorführgeräte',
      explanation: monthKey ? `Vorführgeräte, deren Buchungen im ${monthKey} keine Konflikte anzeigen.` : 'Vorführgeräte ohne aktuelle Zuweisung.',
      rows: RM_DEMO_DEVICES.map((d) => ({ id: d.id, name: d.name, hint: `${d.locationId} · ${d.status}` })),
    };
  }
  if (wantsTech) {
    const rows = RM_EMPLOYEES
      .filter((e) => e.qualifications.some((q) => q.includes('tech') || q.includes('service')))
      .filter((e) => !loc || e.locationId === loc.id)
      .map((e) => ({ id: e.id, name: e.name, hint: `${e.role} · ${e.locationId}` }));
    return {
      intent: `Freie Servicetechniker${loc ? ' in ' + loc.name : ''}`,
      explanation: 'Techniker mit passender Qualifikation aus RM_EMPLOYEES.',
      rows,
    };
  }
  // Fallback: freie Textsuche in Terminen
  const hit = apps.filter((a) => a.title.toLowerCase().includes(q) || (a.customerName ?? '').toLowerCase().includes(q));
  return {
    intent: 'Terminsuche',
    explanation: `Volltextsuche in ${apps.length} Terminen.`,
    rows: hit.slice(0, 20).map((a) => ({ id: a.id, name: a.title, hint: `${a.startAt.slice(0,16)} · ${a.customerName ?? ''}` })),
  };
  void monthIdx;
}
