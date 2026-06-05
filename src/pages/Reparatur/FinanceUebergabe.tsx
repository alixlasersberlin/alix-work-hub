import { RepairFilteredList } from './_FilteredList';
export default function FinancePage() {
  return <RepairFilteredList title="Übergaben Finance" statusFilter={['Reparatur abgeschlossen', 'Übergabe an Finance', 'Rechnung erstellt']} />;
}
