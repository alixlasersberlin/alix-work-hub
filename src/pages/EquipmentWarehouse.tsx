import { Warehouse } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function EquipmentWarehouse() {
  return (
    <Lagergeraete
      filterStatuses={['Bestand', 'Transfer', 'Produktion', 'Hold', 'Sperre BOSS']}
      pageTitle="Warehouse"
      pageSubtitle="Gesamtübersicht aller Geräte im Pool"
      emptyLabel="Keine Geräte im Warehouse erfasst."
      pageIcon={<Warehouse className="w-6 h-6 text-white" />}
    />
  );
}
