import { AlertTriangle } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function EquipmentHold() {
  return (
    <Lagergeraete
      filterStatuses={['Hold', 'Sperre BOSS']}
      pageTitle="Hold"
      pageSubtitle={'Lagergeräte mit Status „Hold" oder „Sperre BOSS"'}
      emptyLabel="Keine Geräte aktuell in Hold."
      pageIcon={AlertTriangle}
      rowAccentClass="bg-red-500/10 hover:bg-red-500/15"
    />
  );
}
