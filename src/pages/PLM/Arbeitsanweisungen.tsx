import { BookOpenCheck } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { RELEASE_STATUS, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'instruction_number', label: 'AA-Nr.', list: true, mono: true },
  { key: 'title', label: 'Titel', list: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', list: true },
  { key: 'assembly_id', label: 'Baugruppe', type: 'ref', refTable: 'plm_assemblies', refLabel: 'name', refExtra: 'code', list: true },
  { key: 'version', label: 'Version', group: 'Freigabe', list: true },
  { key: 'revision', label: 'Revision', group: 'Freigabe' },
  { key: 'status', label: 'Status', type: 'select', options: RELEASE_STATUS, group: 'Freigabe', list: true },
  { key: 'file_url', label: 'Datei (URL)', group: 'Inhalt' },
  { key: 'content', label: 'Arbeitsschritte', type: 'textarea', group: 'Inhalt' },
];

export default function PlmArbeitsanweisungen() {
  return (
    <PlmCrudPage
      table="plm_work_instructions"
      title="Arbeitsanweisungen"
      subtitle="Montage- und Prüfanweisungen für die Fertigung."
      icon={BookOpenCheck}
      fields={fields}
      orderBy="instruction_number"
      ascending
    />
  );
}
