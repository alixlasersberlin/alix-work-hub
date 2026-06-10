import { Repeat } from 'lucide-react';
import { PageHeader, DataCard, PageEmpty } from '@/components/PageShell';

export default function WiederkehrendeZahler() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiederkehrende Zahler"
        subtitle="Kunden mit regelmäßigen Zahlungen (Raten, Abos, periodische Rechnungen)"
        icon={Repeat}
      />
      <DataCard title="Übersicht">
        <PageEmpty icon={Repeat} message="Modul wird in Kürze befüllt." />
      </DataCard>
    </div>
  );
}
