import TxListPage from './TxListPage';

export default function OffeneZuordnungen() {
  return (
    <TxListPage
      title="Offene Zuordnungen"
      statuses={['offen', 'vorschlag', 'sicher', 'zurueckgestellt', 'dublette']}
      description="Buchungen, die noch nicht verbucht sind – manuell zuordnen, zurückstellen oder ignorieren."
    />
  );
}
