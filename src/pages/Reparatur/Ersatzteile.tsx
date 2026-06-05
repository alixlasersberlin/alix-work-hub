import { RepairFilteredList } from './_FilteredList';
export default function ErsatzteilePage() {
  return <RepairFilteredList title="Offener Ersatzteilbedarf" statusFilter={['Ersatzteile benötigt', 'Ersatzteile bestellt']} />;
}
