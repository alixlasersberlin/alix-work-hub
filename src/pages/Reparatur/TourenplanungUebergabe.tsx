import { RepairFilteredList } from './_FilteredList';
export default function TourenPage() {
  return <RepairFilteredList title="Übergaben Tourenplanung" statusFilter={['Übergabe an Tourenplanung', 'Auslieferung geplant']} />;
}
