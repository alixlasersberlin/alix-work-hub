import { Factory } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function EquipmentProduktion() {
  return (
    <Lagergeraete
      filterStatuses={['Produktion']}
      pageTitle="Produktion"
      pageSubtitle={'Lagergeräte mit Status „Produktion"'}
      emptyLabel="Keine Geräte aktuell in Produktion."
      pageIcon={Factory}
      rowAccentClass="bg-blue-500/10 hover:bg-blue-500/15"
    />
  );
}
