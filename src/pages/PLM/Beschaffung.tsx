import { ShoppingCart } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'part_id', label: 'Einzelteil', type: 'ref', refTable: 'plm_parts', refLabel: 'name', refExtra: 'part_number', list: true, required: true },
  { key: 'supplier_id', label: 'Lieferant', type: 'ref', refTable: 'plm_suppliers', refLabel: 'name', list: true, required: true },
  { key: 'supplier_part_number', label: 'Lieferanten-Art.-Nr.', list: true, mono: true },
  { key: 'price', label: 'Preis', type: 'number', list: true },
  { key: 'currency', label: 'Währung', type: 'select', options: ['EUR', 'CHF', 'USD'], list: true },
  { key: 'moq', label: 'Mindestmenge (MOQ)', type: 'number', list: true },
  { key: 'lead_time_days', label: 'Lieferzeit (Tage)', type: 'number', list: true },
  { key: 'is_preferred', label: 'Vorzugslieferant', type: 'boolean', list: true, group: 'Bewertung' },
  { key: 'approved', label: 'Freigegeben (QM)', type: 'boolean', list: true, group: 'Bewertung' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Bewertung' },
];

export default function PlmBeschaffung() {
  return (
    <PlmCrudPage
      table="plm_part_suppliers"
      title="Beschaffung – Teil/Lieferant"
      subtitle="Bezugsquellen je Einzelteil: Preise, Mindestmengen, Lieferzeiten, Vorzugs- und QM-Freigabe."
      icon={ShoppingCart}
      fields={fields}
      orderBy="created_at"
      defaults={{ currency: 'EUR', is_preferred: false, approved: false }}
    />
  );
}
