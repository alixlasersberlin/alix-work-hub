import { GitPullRequestArrow } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { CHANGE_KIND, CHANGE_STATUS, RISK_LEVEL, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'change_number', label: 'Nummer', list: true, mono: true },
  { key: 'change_kind', label: 'Art', type: 'select', options: CHANGE_KIND, list: true },
  { key: 'title', label: 'Titel', list: true },
  { key: 'status', label: 'Status', type: 'select', options: CHANGE_STATUS, list: true },
  { key: 'risk_level', label: 'Risiko', type: 'select', options: RISK_LEVEL, list: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', group: 'Bezug', list: true },
  { key: 'assembly_id', label: 'Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code', group: 'Bezug' },
  { key: 'part_id', label: 'Einzelteil', type: 'ref', refTable: 'plm_parts', refLabel: 'name', refExtra: 'part_number', group: 'Bezug' },
  { key: 'old_revision', label: 'Revision alt', group: 'Bezug' },
  { key: 'new_revision', label: 'Revision neu', group: 'Bezug' },
  { key: 'description', label: 'Beschreibung', type: 'textarea', group: 'Inhalt' },
  { key: 'reason', label: 'Begründung', type: 'textarea', group: 'Inhalt' },
  { key: 'risk_assessment', label: 'Risikobewertung', type: 'textarea', group: 'Inhalt' },
  { key: 'effective_date', label: 'Wirksam ab', type: 'date', group: 'Freigabe', list: true },
];

export default function PlmAenderungen() {
  return (
    <PlmCrudPage
      table="plm_changes"
      title="Änderungsmanagement (ECR/ECO)"
      subtitle="Änderungsanträge und Änderungsaufträge mit Risikobewertung und QM-Freigabe."
      icon={GitPullRequestArrow}
      fields={fields}
      orderBy="created_at"
      defaults={{ status: 'beantragt', change_kind: 'ECR' }}
    />
  );
}
