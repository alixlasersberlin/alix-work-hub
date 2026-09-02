// MAGIC STATUS – Statusmodell & Workflow-Definitionen
// Suchen. Ändern. Ausführen.

export type MagicRequirement =
  | 'serial'
  | 'tech_check'
  | 'documentation'
  | 'shipping_address'
  | 'payment_release'
  | 'deposit'
  | 'supplier_order'
  | 'delivery_date'
  | 'tracking'
  | 'handover';

export const REQUIREMENT_LABEL: Record<MagicRequirement, string> = {
  serial: 'Seriennummer vorhanden',
  tech_check: 'Technische Prüfung bestanden',
  documentation: 'Dokumentation vollständig',
  shipping_address: 'Lieferadresse vorhanden',
  payment_release: 'Zahlungsfreigabe vorhanden',
  deposit: 'Anzahlung erhalten',
  supplier_order: 'Lieferantenbestellung vorhanden',
  delivery_date: 'Liefertermin gesetzt',
  tracking: 'Trackingnummer vorhanden',
  handover: 'Übergabe / Abnahme erledigt',
};

export type MagicRole =
  | 'Vertrieb' | 'Buchhaltung' | 'Beschaffung' | 'Technik' | 'Logistik' | 'Admin' | 'Super Admin';

export interface MagicStatusDef {
  key: string;
  label: string;
  group: 'AUFTRAG' | 'BESCHAFFUNG' | 'PRODUKTION' | 'PRÜFUNG' | 'VERSAND' | 'INBETRIEBNAHME' | 'ABSCHLUSS' | 'SONDER';
  tone: 'slate' | 'amber' | 'sky' | 'violet' | 'emerald' | 'rose';
  requires: MagicRequirement[];
  /** Automationen, die beim Ausführen laufen (Beschreibung + interner Key) */
  actions: { key: string; label: string }[];
  /** empfohlener Folgestatus */
  next?: string;
  /** Rollen, die diesen Status setzen dürfen (leer = alle mit Modulzugriff) */
  roles?: MagicRole[];
}

export const MAGIC_STATUSES: MagicStatusDef[] = [
  { key: 'neuer_auftrag', label: 'NEUER AUFTRAG', group: 'AUFTRAG', tone: 'slate', requires: [], actions: [{ key: 'timeline', label: 'Timeline aktualisieren' }], next: 'auftrag_geprueft', roles: ['Vertrieb', 'Admin', 'Super Admin'] },
  { key: 'auftrag_geprueft', label: 'AUFTRAG GEPRÜFT', group: 'AUFTRAG', tone: 'slate', requires: [], actions: [{ key: 'timeline', label: 'Timeline aktualisieren' }, { key: 'notify_sales', label: 'Vertrieb informieren' }], next: 'anzahlung_offen', roles: ['Vertrieb', 'Admin', 'Super Admin'] },
  { key: 'anzahlung_offen', label: 'ANZAHLUNG OFFEN', group: 'AUFTRAG', tone: 'amber', requires: [], actions: [{ key: 'payment_status', label: 'Zahlungsstatus aktualisieren' }], next: 'anzahlung_erhalten', roles: ['Buchhaltung', 'Admin', 'Super Admin'] },
  { key: 'anzahlung_erhalten', label: 'ANZAHLUNG ERHALTEN', group: 'AUFTRAG', tone: 'emerald', requires: ['deposit'], actions: [
    { key: 'payment_status', label: 'Zahlungsstatus aktualisieren' },
    { key: 'notify_sales', label: 'Vertrieb informieren' },
    { key: 'order_release', label: 'Bestellfreigabe erzeugen' },
    { key: 'prepare_supplier_order', label: 'Lieferantenbestellung vorbereiten' },
    { key: 'timeline', label: 'Timeline aktualisieren' },
  ], next: 'bestellung_ausgeloest', roles: ['Buchhaltung', 'Admin', 'Super Admin'] },
  { key: 'bestellung_ausgeloest', label: 'BESTELLUNG AUSGELÖST', group: 'BESCHAFFUNG', tone: 'sky', requires: [], actions: [{ key: 'timeline', label: 'Timeline aktualisieren' }], next: 'beim_lieferanten_bestellt', roles: ['Beschaffung', 'Admin', 'Super Admin'] },
  { key: 'beim_lieferanten_bestellt', label: 'BEIM LIEFERANTEN BESTELLT', group: 'BESCHAFFUNG', tone: 'sky', requires: ['supplier_order', 'delivery_date'], actions: [
    { key: 'link_supplier', label: 'Lieferant verknüpfen' },
    { key: 'save_order_date', label: 'Bestelldatum speichern' },
    { key: 'reminder_delivery', label: 'Reminder für Liefertermin erzeugen' },
  ], next: 'in_produktion', roles: ['Beschaffung', 'Admin', 'Super Admin'] },
  { key: 'in_produktion', label: 'IN PRODUKTION', group: 'PRODUKTION', tone: 'violet', requires: ['supplier_order'], actions: [{ key: 'production_status', label: 'Produktionsstatus aktualisieren' }], next: 'produktion_abgeschlossen', roles: ['Beschaffung', 'Technik', 'Admin', 'Super Admin'] },
  { key: 'produktion_abgeschlossen', label: 'PRODUKTION ABGESCHLOSSEN', group: 'PRODUKTION', tone: 'violet', requires: ['supplier_order'], actions: [
    { key: 'production_status', label: 'Produktionsstatus aktualisieren' },
    { key: 'check_serial', label: 'Seriennummer prüfen' },
    { key: 'create_tech_check', label: 'Technische Prüfung erstellen' },
    { key: 'next_task', label: 'Nächste Aufgabe erzeugen' },
  ], next: 'ware_unterwegs', roles: ['Beschaffung', 'Technik', 'Admin', 'Super Admin'] },
  { key: 'ware_unterwegs', label: 'WARE UNTERWEGS', group: 'BESCHAFFUNG', tone: 'sky', requires: [], actions: [{ key: 'device_transit', label: 'Gerät auf „Unterwegs" setzen' }, { key: 'timeline', label: 'Timeline aktualisieren' }], next: 'ware_eingegangen', roles: ['Beschaffung', 'Logistik', 'Admin', 'Super Admin'] },
  { key: 'ware_eingegangen', label: 'WARE EINGEGANGEN', group: 'BESCHAFFUNG', tone: 'emerald', requires: [], actions: [
    { key: 'goods_receipt', label: 'Wareneingang erfassen' },
    { key: 'stock_update', label: 'Lagerbestand aktualisieren' },
    { key: 'create_incoming_check', label: 'Wareneingangsprüfung erzeugen' },
    { key: 'notify_procurement', label: 'Beschaffung informieren' },
  ], next: 'warenpruefung', roles: ['Logistik', 'Beschaffung', 'Admin', 'Super Admin'] },
  { key: 'warenpruefung', label: 'WARENPRÜFUNG', group: 'PRÜFUNG', tone: 'amber', requires: [], actions: [{ key: 'create_incoming_check', label: 'Prüfcheckliste starten' }], next: 'technische_pruefung', roles: ['Technik', 'Logistik', 'Admin', 'Super Admin'] },
  { key: 'technische_pruefung', label: 'TECHNISCHE PRÜFUNG', group: 'PRÜFUNG', tone: 'amber', requires: [], actions: [{ key: 'create_tech_check', label: 'Technische Checkliste starten' }], next: 'seriennummer_offen', roles: ['Technik', 'Admin', 'Super Admin'] },
  { key: 'seriennummer_offen', label: 'SERIENNUMMER OFFEN', group: 'PRÜFUNG', tone: 'amber', requires: [], actions: [{ key: 'next_task', label: 'Aufgabe „Seriennummer vergeben" erzeugen' }], next: 'seriennummer_vergeben', roles: ['Technik', 'Admin', 'Super Admin'] },
  { key: 'seriennummer_vergeben', label: 'SERIENNUMMER VERGEBEN', group: 'PRÜFUNG', tone: 'emerald', requires: ['serial'], actions: [
    { key: 'device_file', label: 'Geräteakte erstellen/aktualisieren' },
    { key: 'link_order', label: 'Gerät mit Auftrag verbinden' },
    { key: 'link_customer', label: 'Gerät mit Kundenkonto verbinden' },
    { key: 'warranty', label: 'Garantie-Datensatz vorbereiten' },
    { key: 'service_file', label: 'Service- & Wartungsakte anlegen' },
    { key: 'portal', label: 'Kundenportal aktualisieren' },
  ], next: 'dokumentation_offen', roles: ['Technik', 'Admin', 'Super Admin'] },
  { key: 'dokumentation_offen', label: 'DOKUMENTATION OFFEN', group: 'PRÜFUNG', tone: 'amber', requires: [], actions: [{ key: 'next_task', label: 'Aufgabe „Dokumentation" erzeugen' }], next: 'auslieferung_vorbereiten', roles: ['Technik', 'Logistik', 'Admin', 'Super Admin'] },
  { key: 'auslieferung_vorbereiten', label: 'AUSLIEFERUNG VORBEREITEN', group: 'VERSAND', tone: 'sky', requires: ['serial', 'shipping_address'], actions: [
    { key: 'check_all', label: 'Vollständigkeitsprüfung durchführen' },
    { key: 'delivery_note', label: 'Lieferschein bereitstellen' },
    { key: 'handover_protocol', label: 'Übergabeprotokoll bereitstellen' },
  ], next: 'versandbereit', roles: ['Logistik', 'Admin', 'Super Admin'] },
  { key: 'versandbereit', label: 'VERSANDBEREIT', group: 'VERSAND', tone: 'emerald', requires: ['serial', 'tech_check', 'documentation', 'shipping_address', 'payment_release'], actions: [
    { key: 'device_file', label: 'Geräteakte aktualisieren' },
    { key: 'delivery_status', label: 'Lieferstatus aktualisieren' },
    { key: 'portal', label: 'Kundenportal aktualisieren' },
    { key: 'next_task', label: 'Nächste Aufgabe erstellen' },
  ], next: 'versendet', roles: ['Logistik', 'Admin', 'Super Admin'] },
  { key: 'versendet', label: 'VERSENDET', group: 'VERSAND', tone: 'sky', requires: ['serial', 'tracking'], actions: [
    { key: 'portal', label: 'Kundenportal + Tracking aktualisieren' },
    { key: 'notify_customer', label: 'Kundeninformation vorbereiten' },
    { key: 'delivery_status', label: 'Lieferstatus ändern' },
    { key: 'next_task', label: 'Aufgabe zur Lieferkontrolle erzeugen' },
  ], next: 'in_auslieferung', roles: ['Logistik', 'Admin', 'Super Admin'] },
  { key: 'in_auslieferung', label: 'IN AUSLIEFERUNG', group: 'VERSAND', tone: 'sky', requires: ['serial'], actions: [{ key: 'delivery_status', label: 'Lieferstatus aktualisieren' }, { key: 'portal', label: 'Kundenportal aktualisieren' }], next: 'ausgeliefert', roles: ['Logistik', 'Admin', 'Super Admin'] },
  { key: 'ausgeliefert', label: 'AUSGELIEFERT', group: 'INBETRIEBNAHME', tone: 'emerald', requires: ['serial'], actions: [
    { key: 'delivery_date_save', label: 'Lieferdatum speichern' },
    { key: 'warranty', label: 'Garantiestart prüfen' },
    { key: 'device_at_customer', label: 'Gerätestatus „beim Kunden" setzen' },
    { key: 'service_file', label: 'Serviceakte aktivieren / Wartungsfristen berechnen' },
    { key: 'portal', label: 'Kundenportal aktualisieren' },
  ], next: 'installation_offen', roles: ['Logistik', 'Technik', 'Admin', 'Super Admin'] },
  { key: 'installation_offen', label: 'INSTALLATION OFFEN', group: 'INBETRIEBNAHME', tone: 'amber', requires: ['serial'], actions: [{ key: 'next_task', label: 'Installationsaufgabe erzeugen' }], next: 'installiert', roles: ['Technik', 'Admin', 'Super Admin'] },
  { key: 'installiert', label: 'INSTALLIERT', group: 'INBETRIEBNAHME', tone: 'emerald', requires: ['serial'], actions: [{ key: 'commissioning', label: 'Inbetriebnahmedatum speichern' }, { key: 'device_file', label: 'Geräteakte aktualisieren' }], next: 'einweisung_offen', roles: ['Technik', 'Admin', 'Super Admin'] },
  { key: 'einweisung_offen', label: 'EINWEISUNG OFFEN', group: 'INBETRIEBNAHME', tone: 'amber', requires: [], actions: [{ key: 'next_task', label: 'Einweisungsaufgabe erzeugen' }], next: 'eingewiesen', roles: ['Technik', 'Vertrieb', 'Admin', 'Super Admin'] },
  { key: 'eingewiesen', label: 'EINGEWIESEN', group: 'INBETRIEBNAHME', tone: 'emerald', requires: [], actions: [{ key: 'training_record', label: 'Einweisungsprotokoll ablegen' }, { key: 'academy', label: 'Academy-Zugang prüfen' }], next: 'abnahme_offen', roles: ['Technik', 'Vertrieb', 'Admin', 'Super Admin'] },
  { key: 'abnahme_offen', label: 'ABNAHME OFFEN', group: 'ABSCHLUSS', tone: 'amber', requires: [], actions: [{ key: 'next_task', label: 'Abnahmeaufgabe erzeugen' }], next: 'abgenommen', roles: ['Technik', 'Vertrieb', 'Admin', 'Super Admin'] },
  { key: 'abgenommen', label: 'ABGENOMMEN', group: 'ABSCHLUSS', tone: 'emerald', requires: ['serial'], actions: [{ key: 'handover_protocol', label: 'Abnahmeprotokoll ablegen' }, { key: 'timeline', label: 'Timeline aktualisieren' }], next: 'auftrag_abgeschlossen', roles: ['Technik', 'Vertrieb', 'Admin', 'Super Admin'] },
  { key: 'auftrag_abgeschlossen', label: 'AUFTRAG ABGESCHLOSSEN', group: 'ABSCHLUSS', tone: 'emerald', requires: ['serial', 'documentation', 'payment_release', 'handover'], actions: [
    { key: 'archive', label: 'Auftrag archivieren (weiterhin suchbar)' },
    { key: 'service_file', label: 'Serviceakte final aktivieren' },
  ], roles: ['Admin', 'Super Admin'] },
  { key: 'storniert', label: 'STORNIERT', group: 'SONDER', tone: 'rose', requires: [], actions: [{ key: 'cancel', label: 'Auftrag stornieren & Folgeprozesse stoppen' }], roles: ['Admin', 'Super Admin'] },
  { key: 'gesperrt', label: 'GESPERRT', group: 'SONDER', tone: 'rose', requires: [], actions: [{ key: 'block', label: 'Auftrag sperren' }], roles: ['Admin', 'Super Admin'] },
  { key: 'servicefall', label: 'SERVICEFALL', group: 'SONDER', tone: 'rose', requires: [], actions: [{ key: 'create_ticket', label: 'Serviceticket erzeugen' }], roles: ['Technik', 'Admin', 'Super Admin'] },
];

export const STATUS_BY_KEY: Record<string, MagicStatusDef> =
  Object.fromEntries(MAGIC_STATUSES.map((s) => [s.key, s]));

export const TONE_CLASS: Record<MagicStatusDef['tone'], string> = {
  slate: 'bg-muted text-muted-foreground border-border',
  amber: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

export function statusLabel(key?: string | null) {
  if (!key) return 'OHNE MAGIC STATUS';
  return STATUS_BY_KEY[key]?.label ?? key.toUpperCase();
}

export function statusTone(key?: string | null): MagicStatusDef['tone'] {
  return (key && STATUS_BY_KEY[key]?.tone) || 'slate';
}

/** Rollen-Mapping AlixWork → Magic-Rollen */
export function magicRolesForUser(roles: string[]): MagicRole[] {
  const out = new Set<MagicRole>();
  for (const r of roles) {
    if (r === 'Super Admin') { out.add('Super Admin'); out.add('Admin'); }
    if (r === 'Admin' || r === 'Geschäftsführung') out.add('Admin');
    if (/vertrieb|verkauf|sachbearbeitung|auftragsverwaltung|order/i.test(r)) out.add('Vertrieb');
    if (/buchhaltung|finance/i.test(r)) out.add('Buchhaltung');
    if (/bestellwesen|beschaffung|einkauf|produktion/i.test(r)) out.add('Beschaffung');
    if (/technik|service|qm|medical/i.test(r)) out.add('Technik');
    if (/lager|touren|logistik|versand/i.test(r)) out.add('Logistik');
  }
  return Array.from(out);
}
