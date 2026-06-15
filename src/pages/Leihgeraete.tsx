import { PackageCheck } from 'lucide-react';
import Lagergeraete from './Lagergeraete';

export default function Leihgeraete() {
  return (
    <Lagergeraete
      filterType="Leihgerät"
      pageTitle="Leihgeräte"
      pageSubtitle="Erfassung und Übersicht aller Leihgeräte"
      addLabel="Neues Leihgerät"
      dialogTitle="Leihgerät"
      emptyLabel="Noch keine Leihgeräte erfasst."
      pageIcon={PackageCheck}
    />
  );
}
