import { ClipboardCheck } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PLAN_TYPES, RELEASE_STATUS, PlmField } from '@/lib/plm/config';

const planFields: PlmField[] = [
  { key: 'plan_number', label: 'Plan-Nr.', list: true, mono: true },
  { key: 'name', label: 'Bezeichnung', list: true },
  { key: 'plan_type', label: 'Prüfart', type: 'select', options: PLAN_TYPES, list: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', list: true },
  { key: 'assembly_id', label: 'Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code' },
  { key: 'part_id', label: 'Einzelteil', type: 'ref', refTable: 'plm_parts', refLabel: 'name', refExtra: 'part_number', list: true },
  { key: 'version', label: 'Version', group: 'Freigabe' },
  { key: 'status', label: 'Status', type: 'select', options: RELEASE_STATUS, group: 'Freigabe', list: true },
  { key: 'qs_responsible', label: 'QS-Verantwortlich', group: 'Freigabe', list: true },
  { key: 'description', label: 'Beschreibung', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmPruefplaene() {
  return (
    <PlmCrudPage
      table="plm_inspection_plans"
      title="Prüfpläne"
      subtitle="Prüfpläne für Wareneingang, Zwischen- und Endprüfung."
      icon={ClipboardCheck}
      fields={planFields}
      orderBy="plan_number"
      ascending
    />
  );
}
