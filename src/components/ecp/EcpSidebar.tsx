import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Cpu, Wrench, Ticket, GraduationCap, FileText, Receipt, FileSignature, MessageSquare, Download, User, MapPin, Users, Store, Truck, ShieldCheck, Search, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canSee } from '@/lib/ecp/roles';
import { useEcpRole } from '@/hooks/ecp/useEcpRole';

const NAV = [
  { to: '/ecp', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ecp/termine', icon: Calendar, label: 'Termine' },
  { to: '/ecp/geraete', icon: Cpu, label: 'Geräte', gate: 'devices' },
  { to: '/ecp/service', icon: Wrench, label: 'Service' },
  { to: '/ecp/tickets', icon: Ticket, label: 'Tickets', gate: 'tickets' },
  { to: '/ecp/schulungen', icon: GraduationCap, label: 'Schulungen', gate: 'trainings' },
  { to: '/ecp/dokumente', icon: FileText, label: 'Dokumente' },
  { to: '/ecp/rechnungen', icon: Receipt, label: 'Rechnungen', gate: 'invoices' },
  { to: '/ecp/angebote', icon: FileSignature, label: 'Angebote', gate: 'quotes' },
  { to: '/ecp/nachrichten', icon: MessageSquare, label: 'Nachrichten' },
  { to: '/ecp/downloads', icon: Download, label: 'Downloads' },
  { to: '/ecp/standorte', icon: MapPin, label: 'Standorte' },
  { to: '/ecp/ansprechpartner', icon: Users, label: 'Ansprechpartner' },
  { to: '/ecp/haendler', icon: Store, label: 'Händlerportal', gate: 'dealer' },
  { to: '/ecp/servicepartner', icon: Wrench, label: 'Servicepartner', gate: 'servicepartner' },
  { to: '/ecp/lieferant', icon: Truck, label: 'Lieferantenportal', gate: 'supplier' },
  { to: '/ecp/suche', icon: Search, label: 'Suche' },
  { to: '/ecp/benachrichtigungen', icon: Bell, label: 'Benachrichtigungen' },
  { to: '/ecp/profil', icon: User, label: 'Profil' },
  { to: '/ecp/admin', icon: ShieldCheck, label: 'Admin', gate: 'admin' },
];

export default function EcpSidebar() {
  const { role } = useEcpRole();
  const items = NAV.filter((n) => !n.gate || canSee(role, n.gate as string));
  return (
    <nav className="space-y-1">
      {items.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )
          }
        >
          <n.icon className="h-4 w-4" />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
