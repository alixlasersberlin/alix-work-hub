import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Calendar, Ticket, Wrench, ShieldCheck, GraduationCap, Receipt, FileSignature, FileText, MessageSquare, Bell } from 'lucide-react';
import { useEcpRole } from '@/hooks/ecp/useEcpRole';
import { ROLE_LABELS } from '@/lib/ecp/roles';

const WIDGETS = [
  { to: '/ecp/termine', label: 'Nächste Termine', value: '3', icon: Calendar },
  { to: '/ecp/tickets', label: 'Offene Tickets', value: '2', icon: Ticket },
  { to: '/ecp/service', label: 'Serviceanfragen', value: '1', icon: Wrench },
  { to: '/ecp/geraete', label: 'Garantie aktiv', value: '5', icon: ShieldCheck },
  { to: '/ecp/schulungen', label: 'Schulungen', value: '2', icon: GraduationCap },
  { to: '/ecp/rechnungen', label: 'Offene Rechnungen', value: '1', icon: Receipt },
  { to: '/ecp/angebote', label: 'Angebote', value: '2', icon: FileSignature },
  { to: '/ecp/dokumente', label: 'Neue Dokumente', value: '4', icon: FileText },
  { to: '/ecp/nachrichten', label: 'Nachrichten', value: '3', icon: MessageSquare },
  { to: '/ecp/benachrichtigungen', label: 'Meldungen', value: '5', icon: Bell },
];

export default function EcpDashboard() {
  const { role } = useEcpRole();
  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="text-xs text-muted-foreground">Willkommen</div>
        <div className="text-lg font-semibold">Ihr {ROLE_LABELS[role]}-Bereich</div>
        <div className="text-xs text-muted-foreground mt-1">Alle Ihre Daten aus AlixWorks – zentral und mandantensicher.</div>
      </Card>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {WIDGETS.map((w) => (
          <Link to={w.to} key={w.to}>
            <Card className="p-3 hover:border-primary/50 transition-colors h-full">
              <w.icon className="h-5 w-5 text-primary" />
              <div className="mt-2 text-xs text-muted-foreground">{w.label}</div>
              <div className="text-2xl font-semibold">{w.value}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
