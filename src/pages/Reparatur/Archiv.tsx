import { RepairFilteredList } from './_FilteredList';
export default function ArchivPage() {
  return <RepairFilteredList title="Reparaturarchiv" statusFilter={['Ausgeliefert', 'Storniert']} />;
}
