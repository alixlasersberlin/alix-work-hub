import { PackageCheck } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function EquipmentAusgeliefert() {
  return (
    <Lagergeraete
      filterStatuses={['Ausgeliefert']}
      pageTitle="Ausgeliefert"
      pageSubtitle={'Lagergeräte mit Status „Ausgeliefert"'}
      emptyLabel="Noch keine Geräte als ausgeliefert markiert."
      pageIcon={PackageCheck}
      rowAccentClass="bg-blue-500/10 hover:bg-blue-500/15"
    />
  );
}
