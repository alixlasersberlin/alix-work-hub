// Alle Status entsprechen exakt den Werten, die in repair_orders.repair_status landen.
// Der Trigger log_repair_status_change defaultet auf "Neu", wenn nichts gesetzt ist.
export const REPAIR_STATUSES = [
  'Neu',
  'In Werkstatt',
  'In Diagnose',
  'Warte auf Ersatzteile',
  'In Reparatur',
  'Reparatur abgeschlossen',
  'An Finance übergeben',
  'An Tourenplanung übergeben',
  'Ausgeliefert',
  'Storniert',
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const STATUS_BADGE_CLASS: Record<string, string> = {
  'Neu': 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  'In Werkstatt': 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  'In Diagnose': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
  'Warte auf Ersatzteile': 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  'In Reparatur': 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
  'Reparatur abgeschlossen': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  'An Finance übergeben': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  'An Tourenplanung übergeben': 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  'Ausgeliefert': 'bg-green-500/20 text-green-300 border border-green-500/40',
  'Storniert': 'bg-red-500/20 text-red-300 border border-red-500/40',
};

export const PART_ORDER_STATUSES = ['offen', 'bestellt', 'erhalten', 'storniert'] as const;
