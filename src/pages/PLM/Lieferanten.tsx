import { Factory } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { RELEASE_STATUS, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'supplier_number', label: 'Lieferantennummer', list: true, mono: true },
  { key: 'name', label: 'Name', list: true },
  { key: 'is_manufacturer', label: 'Hersteller', type: 'boolean', list: true },
  { key: 'contact_name', label: 'Ansprechpartner', group: 'Kontakt', list: true },
  { key: 'email', label: 'E-Mail', group: 'Kontakt' },
  { key: 'phone', label: 'Telefon', group: 'Kontakt' },
  { key: 'website', label: 'Website', group: 'Kontakt' },
  { key: 'street', label: 'Straße', group: 'Adresse' },
  { key: 'zip', label: 'PLZ', group: 'Adresse' },
  { key: 'city', label: 'Ort', group: 'Adresse', list: true },
  { key: 'country', label: 'Land', group: 'Adresse' },
  { key: 'iso_certificates', label: 'ISO-Zertifikate (Komma-getrennt)', type: 'tags', group: 'Qualifizierung' },
  { key: 'cert_valid_until', label: 'Zertifikat gültig bis', type: 'date', group: 'Qualifizierung', list: true },
  { key: 'audit_report_url', label: 'Auditbericht (URL)', group: 'Qualifizierung' },
  { key: 'quality_agreement', label: 'Qualitätssicherungsvereinbarung', type: 'boolean', group: 'Qualifizierung' },
  { key: 'nda_signed', label: 'NDA unterzeichnet', type: 'boolean', group: 'Qualifizierung' },
  { key: 'rating', label: 'Bewertung (1-5)', type: 'number', group: 'Qualifizierung', list: true },
  { key: 'release_status', label: 'Freigabestatus', type: 'select', options: RELEASE_STATUS, group: 'Qualifizierung', list: true },
  { key: 'is_active', label: 'Aktiv', type: 'boolean', group: 'Sonstiges' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmLieferanten() {
  return (
    <PlmCrudPage
      table="plm_suppliers"
      title="Lieferanten"
      subtitle="Lieferanten- und Herstellerstamm inkl. ISO-Qualifizierung."
      icon={Factory}
      fields={fields}
      orderBy="name"
      ascending
      defaults={{ is_active: true }}
    />
  );
}
