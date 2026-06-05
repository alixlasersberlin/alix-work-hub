import { RepairFilteredList } from './_FilteredList';
export default function TechnikPage() {
  return <RepairFilteredList title="Technik-Arbeitsaufträge" statusFilter={['In Werkstatt', 'In Diagnose', 'In Reparatur']} />;
}
