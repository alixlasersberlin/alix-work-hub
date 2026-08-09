/**
 * Auslieferungsfreigabe (Delivery Approval Workflow)
 * 3-stufiges, verbindliches Freigabeverfahren: Bereitstellung → Buchhaltung → Tourenplanung.
 */

export type ApprovalStage = 'warehouse' | 'accounting' | 'dispatch';
export type StageStatus = 'open' | 'in_progress' | 'approved' | 'blocked';
export type OverallStatus = 'blocked' | 'waiting' | 'released' | 'delivered' | 'completed';

export interface CheckItem {
  key: string;
  label: string;
  group?: string;
  /** Pflicht für die Freigabe */
  required?: boolean;
}

export interface StageDef {
  stage: ApprovalStage;
  order: number;
  title: string;
  responsible: string;
  roles: string[];
  checks: CheckItem[];
}

export const WAREHOUSE_CHECKS: CheckItem[] = [
  { key: 'device_present', label: 'Gerät vorhanden', required: true },
  { key: 'serial_assigned', label: 'Seriennummer vergeben', required: true },
  { key: 'acc_handpiece', label: 'Handstück(e)', group: 'Zubehör', required: true },
  { key: 'acc_cable', label: 'Kabel', group: 'Zubehör', required: true },
  { key: 'acc_pedal', label: 'Pedal', group: 'Zubehör', required: true },
  { key: 'acc_glasses', label: 'Schutzbrillen', group: 'Zubehör', required: true },
  { key: 'doc_manual', label: 'Bedienungsanleitung', group: 'Dokumentation', required: true },
  { key: 'doc_warranty', label: 'Garantieunterlagen', group: 'Dokumentation', required: true },
  { key: 'doc_mdr', label: 'MDR Dokumente vorhanden', group: 'Dokumentation', required: true },
  { key: 'packaging_checked', label: 'Verpackung geprüft', required: true },
  { key: 'photos_done', label: 'Fotos erstellt', required: true },
  { key: 'device_tested', label: 'Gerät getestet', required: true },
  { key: 'acc_scanned', label: 'Zubehör gescannt', required: true },
  { key: 'shipping_label', label: 'Versandetikett erstellt', required: true },
];

export const ACCOUNTING_CHECKS: CheckItem[] = [
  { key: 'invoice_created', label: 'Rechnung erstellt', required: true },
  { key: 'invoice_paid', label: 'Rechnung bezahlt', group: 'Zahlung' },
  { key: 'deposit_received', label: 'Anzahlung eingegangen', group: 'Zahlung' },
  { key: 'rest_paid', label: 'Restzahlung bezahlt', group: 'Zahlung' },
  { key: 'payment_booked', label: 'Zahlung verbucht', group: 'Zahlung', required: true },
  { key: 'financing_complete', label: 'Finanzierung vollständig / genehmigt', group: 'Finanzierung' },
  { key: 'leasing_signed', label: 'Leasingvertrag unterschrieben', group: 'Finanzierung' },
  { key: 'sepa_present', label: 'SEPA-Mandat vorhanden', group: 'Finanzierung' },
  { key: 'credit_check', label: 'Bonitätsprüfung vorhanden (Schufa / Creditreform)', group: 'Finanzierung' },
  { key: 'no_open_claims', label: 'Keine offenen Forderungen / Mahnungen', group: 'Risiko', required: true },
  { key: 'no_return_debits', label: 'Keine offenen Rücklastschriften', group: 'Risiko', required: true },
];

export const DISPATCH_CHECKS: CheckItem[] = [
  { key: 'delivery_date', label: 'Liefertermin vorhanden', required: true },
  { key: 'time_window', label: 'Zeitfenster festgelegt', required: true },
  { key: 'technician', label: 'Techniker eingeplant', group: 'Ressourcen', required: true },
  { key: 'vehicle', label: 'Fahrzeug eingeplant', group: 'Ressourcen', required: true },
  { key: 'route', label: 'Route geplant', group: 'Ressourcen', required: true },
  { key: 'gps_route', label: 'GPS-Route erstellt', group: 'Ressourcen' },
  { key: 'hotel', label: 'Hotel gebucht (falls nötig)', group: 'Ressourcen' },
  { key: 'arrival', label: 'Anfahrt geklärt', group: 'Ressourcen' },
  { key: 'calendar_entry', label: 'Kalendereintrag erstellt', required: true },
  { key: 'customer_confirmed', label: 'Kunde bestätigt', group: 'Kunde', required: true },
  { key: 'confirmed_phone', label: 'Telefonisch bestätigt', group: 'Kunde' },
  { key: 'confirmed_email', label: 'Per E-Mail bestätigt', group: 'Kunde' },
  { key: 'tools', label: 'Werkzeuge vorhanden', group: 'Material' },
  { key: 'spare_parts', label: 'Ersatzteile vorhanden', group: 'Material' },
  { key: 'briefing_planned', label: 'Einweisung geplant', group: 'Schulung' },
  { key: 'nisv_required', label: 'NiSV geprüft', group: 'Schulung' },
  { key: 'training_planned', label: 'Schulung geplant', group: 'Schulung' },
];

export const STAGES: StageDef[] = [
  {
    stage: 'warehouse',
    order: 1,
    title: 'Bereitstellung',
    responsible: 'Lager / Bereitstellung',
    roles: ['Bereitstellung', 'Order', 'Super Admin'],
    checks: WAREHOUSE_CHECKS,
  },
  {
    stage: 'accounting',
    order: 2,
    title: 'Buchhaltung',
    responsible: 'Buchhaltung',
    roles: ['Buchhaltung Admin', 'Buchhaltung EU', 'Buchhaltung CH', 'Finance', 'Super Admin'],
    checks: ACCOUNTING_CHECKS,
  },
  {
    stage: 'dispatch',
    order: 3,
    title: 'Tourenplanung',
    responsible: 'Disposition / Tourenplanung',
    roles: ['Tourenplanung', 'Super Admin'],
    checks: DISPATCH_CHECKS,
  },
];

export const stageDef = (s: ApprovalStage) => STAGES.find((x) => x.stage === s)!;

export const STAGE_FIELDS = (s: ApprovalStage) => ({
  status: `${s}_status`,
  checks: `${s}_checks`,
  comment: `${s}_comment`,
  by: `${s}_by`,
  byName: `${s}_by_name`,
  at: `${s}_at`,
  ip: `${s}_ip`,
  signature: `${s}_signature`,
});

/** Ampelsystem */
export const STATUS_UI: Record<StageStatus, { label: string; dot: string; text: string }> = {
  open: { label: 'Nicht begonnen', dot: 'bg-red-500', text: 'text-red-400' },
  in_progress: { label: 'In Bearbeitung', dot: 'bg-yellow-500', text: 'text-yellow-400' },
  approved: { label: 'Genehmigt', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  blocked: { label: 'Gesperrt', dot: 'bg-red-600', text: 'text-red-500' },
};

export const OVERALL_UI: Record<OverallStatus, { label: string; dot: string; text: string }> = {
  blocked: { label: 'Gesperrt', dot: 'bg-red-500', text: 'text-red-400' },
  waiting: { label: 'Wartet auf Freigaben', dot: 'bg-yellow-500', text: 'text-yellow-400' },
  released: { label: 'Zur Auslieferung freigegeben', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  delivered: { label: 'Ausgeliefert', dot: 'bg-blue-500', text: 'text-blue-400' },
  completed: { label: 'Abgeschlossen', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
};

/** SLA in Stunden: Erinnerung / Leitung / Operations */
export const SLA_HOURS = { reminder: 24, lead: 48, operations: 72 };
