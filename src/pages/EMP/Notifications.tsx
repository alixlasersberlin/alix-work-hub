import { Card } from '@/components/ui/card';
import { Bell } from 'lucide-react';

const MOCK = [
  { t: 'Neuer Termin', s: 'Klinik Nord bestätigt', ts: 'vor 5 min' },
  { t: 'Ticket', s: 'Reklamation #4711', ts: 'vor 32 min' },
  { t: 'Erinnerung', s: 'Servicebericht ausstehend', ts: 'heute' },
];

export default function EmpNotifications() {
  return (
    <div className="space-y-2">
      {MOCK.map((n, idx) => (
        <Card key={idx} className="p-3 flex items-start gap-3">
          <Bell className="h-4 w-4 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium">{n.t}</div>
            <div className="text-xs text-muted-foreground">{n.s}</div>
          </div>
          <div className="text-[10px] text-muted-foreground">{n.ts}</div>
        </Card>
      ))}
    </div>
  );
}
