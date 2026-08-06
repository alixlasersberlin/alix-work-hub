import { Boxes } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { RELEASE_STATUS, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'code', label: 'Baugruppennummer', list: true, mono: true },
  { key: 'name', label: 'Bezeichnung', list: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', list: true },
  { key: 'parent_id', label: 'Übergeordnete Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code', list: true },
  { key: 'version', label: 'Version', group: 'Versionen', list: true },
  { key: 'revision', label: 'Revision', group: 'Versionen' },
  { key: 'release_status', label: 'Freigabestatus', type: 'select', options: RELEASE_STATUS, group: 'Freigabe', list: true },
  { key: 'sort_order', label: 'Sortierung', type: 'number', group: 'Sonstiges' },
  { key: 'image_url', label: 'Bild (URL)', group: 'Sonstiges' },
  { key: 'description', label: 'Beschreibung', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmBaugruppen() {
  return (
    <PlmCrudPage
      table="plm_assemblies"
      title="Baugruppen"
      subtitle="Hierarchische Baugruppen und Unterbaugruppen je Gerät."
      icon={Boxes}
      fields={fields}
      orderBy="code"
      ascending
    />
  );
}
