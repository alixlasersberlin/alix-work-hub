import { Hammer } from 'lucide-react';
import { PlmCrudPage } from '@/components/plm/PlmCrudPage';
import { PRODUCTION_STATUS, PlmField } from '@/lib/plm/config';

const fields: PlmField[] = [
  { key: 'order_number', label: 'Auftragsnummer', list: true, mono: true },
  { key: 'device_id', label: 'Gerät', type: 'ref', refTable: 'plm_devices', refLabel: 'name', refExtra: 'article_number', list: true },
  { key: 'quantity', label: 'Menge', type: 'number', list: true },
  { key: 'status', label: 'Status', type: 'select', options: PRODUCTION_STATUS, list: true },
  { key: 'planned_start', label: 'Start geplant', type: 'date', group: 'Termine', list: true },
  { key: 'planned_end', label: 'Ende geplant', type: 'date', group: 'Termine', list: true },
  { key: 'actual_start', label: 'Start tatsächlich', type: 'date', group: 'Termine' },
  { key: 'actual_end', label: 'Ende tatsächlich', type: 'date', group: 'Termine' },
  { key: 'batch_number', label: 'Chargennummer', group: 'Rückverfolgbarkeit', list: true },
  { key: 'serial_numbers', label: 'Seriennummern (Komma-getrennt)', type: 'tags', group: 'Rückverfolgbarkeit' },
  { key: 'notes', label: 'Notizen', type: 'textarea', group: 'Sonstiges' },
];

export default function PlmProduktionsauftraege() {
  return (
    <PlmCrudPage
      table="plm_production_orders"
      title="Produktionsaufträge"
      subtitle="Fertigungsaufträge mit Chargen- und Seriennummernvergabe."
      icon={Hammer}
      fields={fields}
      orderBy="created_at"
      defaults={{ status: 'geplant', quantity: 1 }}
    />
  );
}
