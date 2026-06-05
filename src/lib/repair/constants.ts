export const REPAIR_STATUSES = [
  'Reparatur angelegt',
  'Gerät / Teil wird eingeholt',
  'Gerät / Teil eingetroffen',
  'Werkstattannahme offen',
  'Werkstattannahme abgeschlossen',
  'Arbeitsauftrag Technik erstellt',
  'In Prüfung',
  'Ersatzteile benötigt',
  'Ersatzteile bestellt',
  'Reparatur in Arbeit',
  'Reparatur abgeschlossen',
  'Übergabe an Finance',
  'Rechnung erstellt',
  'Übergabe an Tourenplanung',
  'Auslieferung geplant',
  'Ausgeliefert',
  'Abgeschlossen',
  'Storniert',
] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const REPAIR_PRIORITIES = ['Normal', 'Eilig', 'Garantie', 'Kulanz', 'Kostenpflichtig'] as const;
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number];

export const STATUS_BADGE_CLASS: Record<string, string> = {
  'Reparatur angelegt': 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
  'Gerät / Teil wird eingeholt': 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
  'Gerät / Teil eingetroffen': 'bg-teal-500/20 text-teal-400 border border-teal-500/40',
  'Werkstattannahme offen': 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
  'Werkstattannahme abgeschlossen': 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  'Arbeitsauftrag Technik erstellt': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
  'In Prüfung': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
  'Ersatzteile benötigt': 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  'Ersatzteile bestellt': 'bg-orange-500/20 text-orange-200 border border-orange-500/40',
  'Reparatur in Arbeit': 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
  'Reparatur abgeschlossen': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  'Übergabe an Finance': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  'Rechnung erstellt': 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40',
  'Übergabe an Tourenplanung': 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  'Auslieferung geplant': 'bg-sky-500/20 text-sky-200 border border-sky-500/40',
  'Ausgeliefert': 'bg-green-500/20 text-green-300 border border-green-500/40',
  'Abgeschlossen': 'bg-green-600/20 text-green-200 border border-green-600/40',
  'Storniert': 'bg-red-500/20 text-red-300 border border-red-500/40',
};
