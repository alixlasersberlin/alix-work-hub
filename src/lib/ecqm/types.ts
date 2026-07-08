// ECQM – Enterprise Compliance & Quality Management types
export type EcqmStatus = "entwurf" | "pruefung" | "freigegeben" | "archiviert" | "abgelaufen";
export type EcqmTrafficLight = "gruen" | "gelb" | "rot";
export type EcqmSeverity = "niedrig" | "mittel" | "hoch" | "kritisch";

export interface EcqmBase {
  id: string;
  tenant?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface EcqmDocument extends EcqmBase {
  number: string;
  title: string;
  type: "SOP" | "Arbeitsanweisung" | "Prozess" | "Formblatt" | "Checkliste" |
        "Qualitätsrichtlinie" | "Validierung" | "Prüfprotokoll" | "Risikoakte" |
        "Technische Doku" | "Herstellererklärung" | "MDR" | "ISO";
  version: string;
  status: EcqmStatus;
  owner: string;
  approver?: string;
  validFrom?: string;
  validUntil?: string;
  category?: string;
  linkedProcesses?: string[];
  linkedTrainings?: string[];
  readReceipts?: { user: string; ts: string }[];
  history?: { version: string; ts: string; by: string; note?: string }[];
}

export interface EcqmProcess extends EcqmBase {
  code: string;
  name: string;
  type: "Kern" | "Führung" | "Unterstützung";
  description?: string;
  owner: string;
  sopIds?: string[];
  kpis?: string[];
  risks?: string[];
}

export interface EcqmCapa extends EcqmBase {
  number: string;
  trigger: "Audit" | "Reklamation" | "Interner Fehler" | "Risiko" | "Sonstiges";
  description: string;
  rootCause?: string;
  immediate?: string;
  corrective?: string;
  preventive?: string;
  owner: string;
  due?: string;
  effectivenessCheck?: string;
  status: "offen" | "in Arbeit" | "wirksam geprüft" | "geschlossen";
  auditId?: string;
  attachments?: { name: string; url?: string }[];
}

export interface EcqmComplaint extends EcqmBase {
  number: string;
  source: "Kunde" | "Intern" | "Lieferant" | "Produkt" | "Service" | "Schulung";
  description: string;
  customerRef?: string;
  deviceRef?: string;
  serviceRef?: string;
  batch?: string;
  status: "offen" | "in Bearbeitung" | "geschlossen";
  capaId?: string;
  severity: EcqmSeverity;
}

export interface EcqmRisk extends EcqmBase {
  number: string;
  category: string;
  description: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  actions?: string;
  residual?: number;
  owner: string;
  status: "offen" | "in Behandlung" | "akzeptiert" | "abgeschlossen";
}

export interface EcqmAudit extends EcqmBase {
  number: string;
  title: string;
  type: "Intern" | "Lieferant" | "Extern" | "Behörde" | "ISO" | "MDR";
  scheduledFor: string;
  auditor: string;
  status: "geplant" | "laufend" | "abgeschlossen";
  findings?: { id: string; note: string; severity: EcqmSeverity; capaId?: string }[];
  checklist?: { id: string; item: string; ok?: boolean; note?: string }[];
}

export interface EcqmSupplier extends EcqmBase {
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  approved: boolean;
  isoCert?: string;
  contracts?: string[];
  lastAudit?: string;
  performance?: number; // 0-100
  complaints?: number;
  risks?: string[];
}

export interface EcqmChange extends EcqmBase {
  number: string;
  scope: "Software" | "Gerät" | "Prozess" | "Dokument" | "Lieferant" | "Produkt";
  description: string;
  impact: EcqmSeverity;
  risk: EcqmSeverity;
  status: "beantragt" | "bewertet" | "freigegeben" | "abgelehnt" | "umgesetzt";
  approvals?: { role: string; user: string; ts: string; decision: "ok" | "nein" }[];
}

export interface EcqmTrainingRecord extends EcqmBase {
  employee: string;
  training: string;
  completedAt?: string;
  expiresAt?: string;
  mandatory: boolean;
  status: "offen" | "absolviert" | "abgelaufen";
  proofUrl?: string;
}

export interface EcqmQualification {
  employee: string;
  qualifications: { name: string; validUntil?: string; status: "gültig" | "ablaufend" | "abgelaufen" }[];
}

export interface EcqmApproval extends EcqmBase {
  targetType: "Dokument" | "SOP" | "Change" | "CAPA";
  targetId: string;
  step: number;
  role: string;
  approver?: string;
  decision?: "ok" | "nein";
  decidedAt?: string;
  signature?: string; // future e-signature
  status: "offen" | "freigegeben" | "abgelehnt";
}

export interface EcqmAuditLogEntry {
  id: string;
  ts: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
}
