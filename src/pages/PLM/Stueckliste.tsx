import { ListTree } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'position_no', label: 'Pos.', type: 'number', list: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', list: true },
  { key: 'assembly_id', label: 'Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code', list: true },
  { key: 'child_assembly_id', label: 'Unterbaugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code', list: true },
  { key: 'part_id', label: 'Einzelteil', type: 'ref', refTable: 'plm_parts', refLabel: 'name', refExtra: 'part_number', list: true },
  { key: 'quantity', label: 'Menge', type: 'number', list: true },
  { key: 'unit', label: 'Einheit', list: true },
  { key: 'install_position', label: 'Einbauposition', group: 'Details' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Details' },
];

export default function PlmStueckliste() {
  return (
    <PlmCrudPage
      table="plm_bom_items"
      title="Stückliste (BOM)"
      subtitle="Mehrstufige Stückliste: Gerät → Baugruppe → Unterbaugruppe → Einzelteil."
      icon={ListTree}
      fields={fields}
      orderBy="position_no"
      ascending
      defaults={{ unit: 'Stk' }}
    />
  );
}
