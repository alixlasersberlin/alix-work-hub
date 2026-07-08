// Default checklists per appointment kind. Purely presentational data –
// no schema changes required. Modules can persist runs elsewhere later.

export interface ChecklistItem { id: string; label: string; required?: boolean; }
export interface ChecklistTemplate { kind: string; label: string; items: ChecklistItem[]; }

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    kind: 'service', label: 'Service-Einsatz',
    items: [
      { id: 'geraet', label: 'Gerät prüfen', required: true },
      { id: 'sn', label: 'Seriennummer erfasst', required: true },
      { id: 'firmware', label: 'Firmware-Stand dokumentiert' },
      { id: 'fotos', label: 'Fotos vor/nach Einsatz' },
      { id: 'kuehlung', label: 'Kühlung getestet' },
      { id: 'laser', label: 'Laserleistung geprüft' },
      { id: 'unterschrift', label: 'Kundenunterschrift', required: true },
    ],
  },
  {
    kind: 'lieferung', label: 'Lieferung',
    items: [
      { id: 'geladen', label: 'Gerät geladen', required: true },
      { id: 'zubehoer', label: 'Zubehör vollständig' },
      { id: 'handstueck', label: 'Handstücke geprüft' },
      { id: 'unterlagen', label: 'Unterlagen dabei' },
      { id: 'rechnung', label: 'Rechnung dabei' },
      { id: 'lieferschein', label: 'Lieferschein unterschrieben', required: true },
    ],
  },
  {
    kind: 'schulung', label: 'Schulung',
    items: [
      { id: 'teilnehmer', label: 'Teilnehmerliste erstellt', required: true },
      { id: 'ausweise', label: 'Namensschilder / Ausweise' },
      { id: 'unterlagen', label: 'Schulungsunterlagen bereit' },
      { id: 'pruefung', label: 'Prüfung durchgeführt' },
      { id: 'zertifikat', label: 'Zertifikat ausgestellt', required: true },
    ],
  },
  {
    kind: 'sales', label: 'Sales-Termin',
    items: [
      { id: 'praesi', label: 'Präsentation vorbereitet' },
      { id: 'angebot', label: 'Angebot mitgebracht' },
      { id: 'finanzierung', label: 'Finanzierungsoptionen dabei' },
      { id: 'demo', label: 'Demo-Gerät verfügbar' },
      { id: 'follow', label: 'Follow-up geplant', required: true },
    ],
  },
];

export function getChecklistForKind(kind?: string | null): ChecklistTemplate | null {
  if (!kind) return null;
  const k = kind.toLowerCase();
  return CHECKLIST_TEMPLATES.find((c) =>
    k.includes(c.kind) || c.kind.includes(k),
  ) || null;
}
