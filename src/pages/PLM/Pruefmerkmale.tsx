import { Ruler } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'position_no', label: 'Pos.', type: 'number', list: true },
  { key: 'plan_id', label: 'Prüfplan', type: 'ref', refTable: 'plm_inspection_plans', refLabel: 'name', refExtra: 'plan_number', list: true },
  { key: 'characteristic', label: 'Prüfmerkmal', list: true },
  { key: 'method', label: 'Prüfmethode', list: true },
  { key: 'gauge', label: 'Prüfmittel', list: true },
  { key: 'nominal', label: 'Sollwert', list: true },
  { key: 'tolerance_min', label: 'Toleranz min', type: 'number' },
  { key: 'tolerance_max', label: 'Toleranz max', type: 'number' },
  { key: 'unit', label: 'Einheit' },
  { key: 'is_critical', label: 'Kritisches Merkmal', type: 'boolean', list: true },
];

export default function PlmPruefmerkmale() {
  return (
    <PlmCrudPage
      table="plm_inspection_items"
      title="Prüfmerkmale"
      subtitle="Merkmale, Methoden, Prüfmittel und Toleranzen je Prüfplan."
      icon={Ruler}
      fields={fields}
      orderBy="position_no"
      ascending
    />
  );
}
