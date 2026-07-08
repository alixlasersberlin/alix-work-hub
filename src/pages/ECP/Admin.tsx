import { Card } from '@/components/ui/card';
import { mockAdminKpis } from '@/lib/ecp/mock';
import { listEcpAudit } from '@/lib/ecp/audit';

const K = mockAdminKpis;
const KPIS = [
  { label: 'Aktive Kunden', value: K.activeCustomers },
  { label: 'Aktive Händler', value: K.activeDealers },
  { label: 'Aktive Servicepartner', value: K.activeServicePartners },
  { label: 'Offene Tickets', value: K.openTickets },
  { label: 'Serviceanfragen', value: K.serviceRequests },
  { label: 'Portalzugriffe (7d)', value: K.logins7d },
  { label: 'Downloads (7d)', value: K.downloads7d },
];

export default function EcpAdmin() {
  const audit = listEcpAudit().slice(-20).reverse();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label} className="p-3">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold">{k.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-3">
        <div className="text-sm font-medium mb-2">Audit (letzte 20)</div>
        {audit.length === 0 ? (
          <div className="text-xs text-muted-foreground">Noch keine Aktivitäten.</div>
        ) : (
          <ul className="text-xs space-y-1">
            {audit.map((a) => (
              <li key={a.id} className="flex justify-between border-b border-border/50 py-1">
                <span>{a.action}</span>
                <span className="text-muted-foreground">{new Date(a.ts).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-3 text-xs text-muted-foreground">
        Vorbereitung: KI-Chat, KI-Support, KI-Dokumentensuche, KI-Wissensdatenbank, Übersetzung, Voice.
        Zukunft: Ersatzteilshop, Online-Bezahlung, Finanzierung, Leasing, Garantieverlängerung,
        Fernwartung, Remote-Diagnose, Geräte-Monitoring, IoT, Predictive Maintenance.
      </Card>
    </div>
  );
}
