export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  entwurf: 'Entwurf',
  intern_geplant: 'Intern geplant',
  kundenanfrage_vorbereitet: 'Kundenanfrage vorbereitet',
  bestaetigung_versendet: 'Bestätigung versendet',
  kunde_geoeffnet: 'Kunde hat geöffnet',
  kunde_bestaetigt: 'Kunde bestätigt',
  kunde_abgelehnt: 'Kunde abgelehnt',
  kunde_alternativtermin: 'Alternativtermin gewünscht',
  intern_bestaetigt: 'Intern bestätigt',
  fahrer_zugeteilt: 'Fahrer zugeteilt',
  fahrzeug_zugeteilt: 'Fahrzeug zugeteilt',
  tour_freigegeben: 'Tour freigegeben',
  unterwegs: 'Unterwegs',
  angekommen: 'Angekommen',
  lieferung_begonnen: 'Lieferung begonnen',
  erfolgreich_ausgeliefert: 'Erfolgreich ausgeliefert',
  teilweise_ausgeliefert: 'Teilweise ausgeliefert',
  nicht_angetroffen: 'Kunde nicht angetroffen',
  lieferung_fehlgeschlagen: 'Lieferung fehlgeschlagen',
  verschoben: 'Verschoben',
  storniert: 'Storniert',
  abgeschlossen: 'Abgeschlossen',
};

export const DELIVERY_TYPE_LABELS: Record<string, string> = {
  auslieferung: 'Auslieferung',
  auslieferung_installation: 'Auslieferung + Installation',
  auslieferung_einweisung: 'Auslieferung + Einweisung',
  auslieferung_schulung: 'Auslieferung + Schulung',
  abholung: 'Abholung',
  geraetetausch: 'Gerätetausch',
  ersatzgeraet: 'Ersatzgerät',
  rueckholung: 'Rückholung',
  wartung: 'Wartung',
  reparaturabholung: 'Reparaturabholung',
  servicetermin: 'Servicetermin',
  messe_lieferung: 'Messe-Lieferung',
  interne_transportfahrt: 'Interne Transportfahrt',
};

export const TOUR_STATUS_LABELS: Record<string, string> = {
  entwurf: 'Entwurf',
  geplant: 'Geplant',
  geprueft: 'Geprüft',
  freigegeben: 'Freigegeben',
  aktiv: 'Aktiv',
  abgeschlossen: 'Abgeschlossen',
  archiviert: 'Archiviert',
  storniert: 'Storniert',
};

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  verfuegbar: 'Verfügbar',
  reserviert: 'Reserviert',
  unterwegs: 'Unterwegs',
  in_wartung: 'In Wartung',
  defekt: 'Defekt',
  gesperrt: 'Gesperrt',
};

export const READINESS_LABELS: Record<string, string> = {
  gruen: 'Lieferbereit',
  gelb: 'Teilweise bereit',
  rot: 'Nicht lieferbar',
};

export function readinessClass(r?: string | null) {
  if (r === 'gruen') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (r === 'rot') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}

export function statusClass(s?: string | null) {
  if (!s) return 'bg-muted text-muted-foreground border-border';
  if (['erfolgreich_ausgeliefert', 'abgeschlossen', 'kunde_bestaetigt', 'tour_freigegeben', 'intern_bestaetigt'].includes(s))
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (['lieferung_fehlgeschlagen', 'kunde_abgelehnt', 'storniert', 'nicht_angetroffen'].includes(s))
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (['unterwegs', 'angekommen', 'lieferung_begonnen'].includes(s))
    return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
}
