import { RepairFilteredList } from './_FilteredList';
export default function WerkstattAnnahmePage() {
  return <RepairFilteredList title="Werkstattannahme" statusFilter={['Gerät / Teil eingetroffen', 'Werkstattannahme offen']} />;
}
