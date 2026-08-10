import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PlmField } from '@/lib/plm/config';
import { MFR_APPROVAL, MFR_AUDIT_STATUS } from '@/lib/plm/manufacturers';

export const manufacturerFields: PlmField[] = [
  { key: 'manufacturer_code', label: 'Herstellercode', list: true, mono: true },
  { key: 'name', label: 'Firmenname', list: true, required: true },
  { key: 'short_name', label: 'Kurzname', list: true },
  { key: 'logo_url', label: 'Firmenlogo (Upload)', type: 'image', list: true },
  { key: 'country', label: 'Land', list: true },
  { key: 'street', label: 'Straße', group: 'Adresse' },
  { key: 'zip', label: 'PLZ', group: 'Adresse' },
  { key: 'city', label: 'Ort', group: 'Adresse' },
  { key: 'phone', label: 'Telefon', group: 'Kontakt' },
  { key: 'email', label: 'E-Mail', group: 'Kontakt' },
  { key: 'website', label: 'Website', group: 'Kontakt' },
  { key: 'contact_name', label: 'Ansprechpartner', group: 'Kontakt', list: true },
  { key: 'contact_position', label: 'Position Ansprechpartner', group: 'Kontakt' },

  { key: 'iso_9001', label: 'ISO 9001', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'iso_13485', label: 'ISO 13485', type: 'boolean', group: 'Qualitätsmanagement', list: true },
  { key: 'iso_22716', label: 'ISO 22716', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'iso_14001', label: 'ISO 14001', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'iso_45001', label: 'ISO 45001', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'rohs', label: 'RoHS', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'reach', label: 'REACH', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'ce', label: 'CE', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'fda', label: 'FDA', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'ul', label: 'UL', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'iec', label: 'IEC', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'cb_report', label: 'CB Report', type: 'boolean', group: 'Qualitätsmanagement' },
  { key: 'cert_valid_until', label: 'Zertifikate gültig bis', type: 'date', group: 'Qualitätsmanagement', list: true },

  { key: 'audit_status', label: 'Auditstatus', type: 'select', options: MFR_AUDIT_STATUS, group: 'Audit' },
  { key: 'audit_date', label: 'Auditdatum', type: 'date', group: 'Audit' },
  { key: 'next_audit_date', label: 'Nächstes Audit', type: 'date', group: 'Audit', list: true },

  { key: 'approval_status', label: 'Lieferantenfreigabe', type: 'select', options: MFR_APPROVAL, group: 'Freigabe', list: true },
  { key: 'is_critical', label: 'Kritischer Hersteller', type: 'boolean', group: 'Freigabe' },
  { key: 'is_active', label: 'Aktiv', type: 'boolean', group: 'Freigabe' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmHersteller() {
  const navigate = useNavigate();
  return (
    <PlmCrudPage
      table="plm_manufacturers"
      title="Hersteller (MFR)"
      subtitle="Zentrale Herstellerdatenbank mit Zertifikaten, Audits, Freigaben und Dokumenten. Zeile anklicken öffnet die Herstellerkarte."
      icon={Building2}
      fields={manufacturerFields}
      orderBy="name"
      ascending
      defaults={{ is_active: true, approval_status: 'bedingt_freigegeben' }}
      onRowClick={(row) => navigate(`/produktion/hersteller/${row.id}`)}
    />
  );
}
