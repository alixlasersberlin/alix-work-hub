import { RepairFilteredList } from './_FilteredList';
export default function WerkstattannahmePage() {
  return <RepairFilteredList title="Werkstattannahme" statusFilter={['Neu', 'In Werkstatt']} />;
}
