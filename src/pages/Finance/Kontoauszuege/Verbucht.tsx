import TxListPage from './TxListPage';

export default function VerbuchteZahlungen() {
  return (
    <TxListPage
      title="Bereits verbuchte Zahlungen"
      statuses={['verbucht']}
      description="Verbuchte Bankbuchungen inkl. Zuordnungen und Buchungshistorie. Stornierung nur durch Super Admin."
    />
  );
}
