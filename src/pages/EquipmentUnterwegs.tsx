import { Truck } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function EquipmentUnterwegs() {
  return (
    <Lagergeraete
      filterStatuses={['Transfer']}
      pageTitle="Unterwegs"
      pageSubtitle={'Lagergeräte mit Status „Transfer"'}
      emptyLabel="Keine Geräte aktuell unterwegs."
      pageIcon={Truck}
      rowAccentClass="bg-yellow-500/10 hover:bg-yellow-500/15"
    />
  );
}
