import { RepairFilteredList } from './_FilteredList';
export default function ErsatzteilePage() {
  return <RepairFilteredList title="Ersatzteilbedarf" statusFilter={['Warte auf Ersatzteile']} />;
}
