import { ShieldAlert } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PlmField } from '@/lib/plm/config';

const SCALE = ['1', '2', '3', '4', '5'];

export const riskFields: PlmField[] = [
  { key: 'risk_number', label: 'Risiko-Nr.', list: true, mono: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', list: true },
  { key: 'assembly_id', label: 'Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code' },
  { key: 'part_id', label: 'Einzelteil', type: 'ref', refTable: 'plm_parts', refLabel: 'name', refExtra: 'part_number' },
  { key: 'category', label: 'Kategorie', type: 'select', options: ['mechanisch', 'elektrisch', 'optisch', 'software', 'biologisch', 'anwendung', 'umgebung', 'prozess'], list: true },

  { key: 'hazard', label: 'Gefährdung', required: true, list: true, group: 'Analyse' },
  { key: 'cause', label: 'Ursache', type: 'textarea', group: 'Analyse' },
  { key: 'effect', label: 'Auswirkung / Schaden', type: 'textarea', group: 'Analyse' },

  { key: 'severity', label: 'Schwere (S) 1–5', type: 'select', options: SCALE, list: true, group: 'Bewertung' },
  { key: 'occurrence', label: 'Auftreten (A) 1–5', type: 'select', options: SCALE, list: true, group: 'Bewertung' },
  { key: 'detection', label: 'Entdeckung (E) 1–5', type: 'select', options: SCALE, list: true, group: 'Bewertung' },

  { key: 'measures', label: 'Risikobeherrschende Maßnahmen', type: 'textarea', group: 'Maßnahmen' },
  { key: 'residual_severity', label: 'Restrisiko S', type: 'select', options: SCALE, group: 'Maßnahmen' },
  { key: 'residual_occurrence', label: 'Restrisiko A', type: 'select', options: SCALE, group: 'Maßnahmen' },
  { key: 'residual_detection', label: 'Restrisiko E', type: 'select', options: SCALE, group: 'Maßnahmen' },
  { key: 'acceptable', label: 'Restrisiko akzeptabel', type: 'boolean', list: true, group: 'Maßnahmen' },

  { key: 'status', label: 'Status', type: 'select', options: ['offen', 'in_bearbeitung', 'bewertet', 'freigegeben', 'geschlossen'], list: true, group: 'Steuerung' },
  { key: 'reviewed_at', label: 'Letzte Bewertung', type: 'date', group: 'Steuerung' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Steuerung' },
];

export default function PlmRisikomanagement() {
  return (
    <PlmCrudPage
      table="plm_risks"
      title="Risikomanagement (ISO 14971)"
      subtitle="Risikoakte je Gerät mit FMEA-Bewertung, Maßnahmen und Restrisiko-Freigabe."
      icon={ShieldAlert}
      fields={riskFields}
      orderBy="created_at"
      defaults={{ severity: '1', occurrence: '1', detection: '1', status: 'offen' }}
    />
  );
}
