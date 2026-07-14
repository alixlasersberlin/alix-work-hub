/**
 * Farb- und Statuszuordnung für AlixWork-Kalender-Termine.
 * Farben werden nie als einziges Erkennungsmerkmal genutzt – immer mit Symbol/Text kombinieren.
 */
export type EventTypeKey =
  | 'sales' | 'service' | 'lieferung' | 'schulung' | 'nisv_virtuell' | 'nisv_praesenz'
  | 'nisv_pruefung' | 'mediapaket' | 'wartung' | 'reparatur' | 'kundentermin'
  | 'videokonferenz' | 'telefontermin' | 'intern' | 'geschaeftsfuehrung'
  | 'aussendienst' | 'abholung' | 'installation' | 'nachfass' | 'ticket'
  | 'auftrag' | 'frist' | 'wiedervorlage' | 'urlaub' | 'krankheit' | 'abwesenheit' | 'eskalation' | 'sonstiges';

export const EVENT_TYPE_COLORS: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  sales:              { bg: 'bg-blue-500/15',    fg: 'text-blue-400',    border: 'border-blue-500/40',    label: 'Sales' },
  service:            { bg: 'bg-red-500/15',     fg: 'text-red-400',     border: 'border-red-500/40',     label: 'Service' },
  lieferung:          { bg: 'bg-orange-500/15',  fg: 'text-orange-400',  border: 'border-orange-500/40',  label: 'Lieferung' },
  schulung:           { bg: 'bg-emerald-500/15', fg: 'text-emerald-400', border: 'border-emerald-500/40', label: 'Schulung' },
  nisv_virtuell:      { bg: 'bg-violet-500/15',  fg: 'text-violet-400',  border: 'border-violet-500/40',  label: 'NiSV virtuell' },
  nisv_praesenz:      { bg: 'bg-purple-600/15',  fg: 'text-purple-400',  border: 'border-purple-600/40',  label: 'NiSV Präsenz' },
  nisv_pruefung:      { bg: 'bg-fuchsia-500/15', fg: 'text-fuchsia-400', border: 'border-fuchsia-500/40', label: 'NiSV Prüfung' },
  mediapaket:         { bg: 'bg-teal-500/15',    fg: 'text-teal-400',    border: 'border-teal-500/40',    label: 'Mediapaket' },
  wartung:            { bg: 'bg-yellow-500/15',  fg: 'text-yellow-400',  border: 'border-yellow-500/40',  label: 'Wartung' },
  reparatur:          { bg: 'bg-amber-500/15',   fg: 'text-amber-400',   border: 'border-amber-500/40',   label: 'Reparatur' },
  geschaeftsfuehrung: { bg: 'bg-amber-600/15',   fg: 'text-amber-300',   border: 'border-amber-600/40',   label: 'Geschäftsführung' },
  eskalation:         { bg: 'bg-rose-700/20',    fg: 'text-rose-300',    border: 'border-rose-600/50',    label: 'Eskalation' },
  urlaub:             { bg: 'bg-sky-500/15',     fg: 'text-sky-400',     border: 'border-sky-500/40',     label: 'Urlaub' },
  krankheit:          { bg: 'bg-slate-500/15',   fg: 'text-slate-300',   border: 'border-slate-500/40',   label: 'Krankheit' },
  intern:             { bg: 'bg-slate-500/15',   fg: 'text-slate-300',   border: 'border-slate-500/40',   label: 'Intern' },
  sonstiges:          { bg: 'bg-neutral-500/15', fg: 'text-neutral-300', border: 'border-neutral-500/40', label: 'Termin' },
};

export function classifyEventKind(raw?: string | null): string {
  const s = (raw || '').toLowerCase();
  if (!s) return 'sonstiges';
  if (s.includes('sales')) return 'sales';
  if (s.includes('nisv') && s.includes('prüf')) return 'nisv_pruefung';
  if (s.includes('nisv') && s.includes('virt')) return 'nisv_virtuell';
  if (s.includes('nisv')) return 'nisv_praesenz';
  if (s.includes('media')) return 'mediapaket';
  if (s.includes('lief')) return 'lieferung';
  if (s.includes('service')) return 'service';
  if (s.includes('wartung')) return 'wartung';
  if (s.includes('reparatur')) return 'reparatur';
  if (s.includes('schulung')) return 'schulung';
  if (s.includes('geschäft') || s.includes('gf')) return 'geschaeftsfuehrung';
  if (s.includes('urlaub')) return 'urlaub';
  if (s.includes('krank')) return 'krankheit';
  if (s.includes('eskal')) return 'eskalation';
  return 'sonstiges';
}

export function eventStyle(raw?: string | null) {
  const k = classifyEventKind(raw);
  return EVENT_TYPE_COLORS[k] || EVENT_TYPE_COLORS.sonstiges;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  planned: 'Geplant',
  invited: 'Einladung versendet',
  confirmed: 'Bestätigt',
  customer_confirmed: 'Kunde bestätigt',
  staff_confirmed: 'Mitarbeiter bestätigt',
  reschedule_requested: 'Änderung angefragt',
  rescheduled: 'Verschoben',
  cancelled: 'Abgesagt',
  no_show: 'Nicht erschienen',
  completed: 'Erledigt',
  in_progress: 'Läuft',
};
