import { PackageCheck } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { INSPECTION_RESULT, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'receipt_number', label: 'WE-Nr.', list: true, mono: true },
  { key: 'received_at', label: 'Eingang', type: 'date', list: true },
  { key: 'part_id', label: 'Einzelteil', type: 'ref', refTable: 'plm_parts', refLabel: 'name', refExtra: 'part_number', list: true },
  { key: 'supplier_id', label: 'Lieferant', type: 'ref', refTable: 'plm_suppliers', refLabel: 'name', refExtra: 'supplier_number', list: true },
  { key: 'quantity', label: 'Menge', type: 'number', list: true },
  { key: 'unit', label: 'Einheit' },
  { key: 'batch_number', label: 'Chargennummer', group: 'Rückverfolgbarkeit', list: true },
  { key: 'lot_number', label: 'Losnummer', group: 'Rückverfolgbarkeit' },
  { key: 'serial_numbers', label: 'Seriennummern (Komma-getrennt)', type: 'tags', group: 'Rückverfolgbarkeit' },
  { key: 'inspection_plan_id', label: 'Prüfplan', type: 'ref', refTable: 'plm_inspection_plans', refLabel: 'name', refExtra: 'plan_number', group: 'Prüfung' },
  { key: 'inspection_result', label: 'Prüfergebnis', type: 'select', options: INSPECTION_RESULT, group: 'Prüfung', list: true },
  { key: 'deviation', label: 'Abweichung', type: 'textarea', group: 'Prüfung' },
  { key: 'blocked', label: 'Gesperrt', type: 'boolean', group: 'Prüfung', list: true },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmWareneingang() {
  return (
    <PlmCrudPage
      table="plm_goods_receipts"
      title="Wareneingang & Prüfung"
      subtitle="Wareneingangsprüfung mit Chargen-, Los- und Seriennummernverfolgung."
      icon={PackageCheck}
      fields={fields}
      orderBy="received_at"
      defaults={{ inspection_result: 'offen', unit: 'Stk' }}
    />
  );
}
