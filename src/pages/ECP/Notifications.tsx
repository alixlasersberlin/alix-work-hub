import { Card } from '@/components/ui/card';
import { Bell } from 'lucide-react';

const MOCK = [
  { t: 'Neuer Termin', s: 'Wartung 10.07. bestätigt', ts: 'heute' },
  { t: 'Ticket-Update', s: 'Rückmeldung von Service Team', ts: 'gestern' },
  { t: 'Neue Rechnung', s: '#inv-2026-0142 verfügbar', ts: '3 Tage' },
];

export default function EcpNotifications() {
  return (
    <div className="space-y-2">
      {MOCK.map((n, idx) => (
        <Card key={idx} className="p-3 flex items-start gap-3">
          <Bell className="h-4 w-4 text-primary mt-0.5" />
          <div className="flex-1"><div className="text-sm font-medium">{n.t}</div><div className="text-xs text-muted-foreground">{n.s}</div></div>
          <div className="text-[10px] text-muted-foreground">{n.ts}</div>
        </Card>
      ))}
    </div>
  );
}
