// ALIXWORK — Produktion & Beschaffung (PLM) — Feldkonfiguration
export type PlmFieldType =
  | 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean' | 'ref' | 'tags' | 'image' | 'file';

export interface PlmField {
  key: string;
  label: string;
  type?: PlmFieldType;
  options?: string[];
  refTable?: string;
  refLabel?: string;      // Spalte für die Anzeige
  refExtra?: string;      // zweite Spalte für die Anzeige
  group?: string;
  list?: boolean;         // in der Tabelle anzeigen
  required?: boolean;
  mono?: boolean;
}

export const RELEASE_STATUS = ['entwurf', 'in_bearbeitung', 'technische_pruefung', 'qualitaetspruefung', 'regulatory_pruefung', 'freigegeben', 'gesperrt', 'archiviert'];
export const DRAWING_STATUS = RELEASE_STATUS;
export const CE_STATUS = ['offen', 'in_vorbereitung', 'konform', 'zertifiziert', 'abgelaufen'];
export const MDR_STATUS = ['offen', 'in_vorbereitung', 'eingereicht', 'zertifiziert', 'legacy'];
export const CRITICALITY = ['unkritisch', 'gering', 'mittel', 'hoch', 'sicherheitsrelevant'];
export const CHANGE_KIND = ['ECR', 'ECO'];
export const CHANGE_STATUS = ['beantragt', 'bewertet', 'genehmigt', 'abgelehnt', 'umgesetzt', 'geschlossen'];
export const RISK_LEVEL = ['niedrig', 'mittel', 'hoch', 'kritisch'];
export const INSPECTION_RESULT = ['offen', 'in_pruefung', 'freigegeben', 'abweichung', 'gesperrt', 'rueckgesendet'];
export const PRODUCTION_STATUS = ['geplant', 'material_bereit', 'in_fertigung', 'in_pruefung', 'fertig', 'freigegeben', 'storniert'];
export const PLAN_TYPES = ['wareneingang', 'zwischenpruefung', 'endpruefung', 'validierung', 'wiederholpruefung'];
export const DOC_TYPES = [
  'datenblatt', 'cad', 'step', 'zeichnung_pdf', 'montagezeichnung', 'explosionszeichnung',
  'pruefbericht', 'materialzertifikat', 'konformitaetserklaerung', 'rohs', 'reach',
  'risikoakte', 'ifu', 'label', 'technische_doku', 'sonstiges',
];
export const DRAWING_VIEWS = ['gesamt', 'front', 'rueck', 'draufsicht', 'links', 'rechts', 'detail'];
export const ENTITY_TYPES = ['device', 'assembly', 'part', 'supplier', 'drawing', 'change'];

export function plmLabel(v?: string | null) {
  if (!v) return '—';
  return v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function statusTone(v?: string | null): 'ok' | 'warn' | 'bad' | 'muted' {
  switch (v) {
    case 'freigegeben': case 'zertifiziert': case 'konform': case 'fertig': case 'genehmigt': case 'umgesetzt':
      return 'ok';
    case 'gesperrt': case 'abgelehnt': case 'abweichung': case 'abgelaufen': case 'storniert':
      return 'bad';
    case 'entwurf': case 'archiviert': case 'geschlossen':
      return 'muted';
    default:
      return 'warn';
  }
}
