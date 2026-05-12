import { Truck } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function EquipmentUnterwegs() {
  return (
    <Lagergeraete
      filterStatuses={['Transfer']}
      pageTitle="Unterwegs"
      pageSubtitle={'Lagergeräte mit Status „Transfer"'}
      emptyLabel="Keine Geräte aktuell unterwegs."
      pageIcon={<Truck className="w-6 h-6 text-yellow-500" />}
    />
  );
}
