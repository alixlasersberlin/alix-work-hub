import { FileCheck2 } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { DOC_TYPES, RELEASE_STATUS, ENTITY_TYPES, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'document_number', label: 'Dok.-Nr.', list: true, mono: true },
  { key: 'title', label: 'Titel', list: true },
  { key: 'doc_type', label: 'Dokumentart', type: 'select', options: DOC_TYPES, list: true },
  { key: 'entity_type', label: 'Bezugsobjekt', type: 'select', options: ENTITY_TYPES, list: true },
  { key: 'entity_id', label: 'Bezugs-ID', group: 'Bezug' },
  { key: 'version', label: 'Version', group: 'Versionen', list: true },
  { key: 'revision', label: 'Revision', group: 'Versionen' },
  { key: 'release_status', label: 'Freigabestatus', type: 'select', options: RELEASE_STATUS, group: 'Freigabe', list: true },
  { key: 'valid_until', label: 'Gültig bis', type: 'date', group: 'Freigabe', list: true },
  { key: 'file_url', label: 'Datei (Upload)', type: 'file', group: 'Datei' },
  { key: 'file_path', label: 'Speicherpfad', group: 'Datei' },
  { key: 'mime_type', label: 'MIME-Typ', group: 'Datei' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmDokumente() {
  return (
    <PlmCrudPage
      table="plm_documents"
      title="Technische Dokumentation"
      subtitle="Datenblätter, CAD/STEP, Zertifikate, Risikoakten und MDR-Unterlagen."
      icon={FileCheck2}
      fields={fields}
      orderBy="created_at"
    />
  );
}
