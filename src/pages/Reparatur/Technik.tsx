import { RepairFilteredList } from './_FilteredList';
export default function TechnikPage() {
  return <RepairFilteredList title="Technik-Arbeitsaufträge" statusFilter={['Werkstattannahme abgeschlossen', 'Arbeitsauftrag Technik erstellt', 'In Prüfung', 'Reparatur in Arbeit']} />;
}
