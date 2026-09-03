import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Cpu, Wrench, FileText, CalendarDays, Monitor, LogOut, Truck, Contact, FileSignature, MessageSquare, Radio, Bell, BellRing, Activity, AlarmClock, Sparkles, Ticket, Search, Clock, ArrowLeftRight, ShieldCheck, BarChart3, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const LINKS = [
  { to: '/mobil/sicherheit', icon: Lock, label: 'Sicherheit' },
  { to: '/mobil/datenschutz', icon: ShieldCheck, label: 'Datenschutz' },
  { to: '/mobil/support', icon: LifeBuoy, label: 'Hilfe & Support' },
  { to: '/mobil/admin/release-readiness', icon: Rocket, label: 'Admin · Release Readiness' },
  { to: '/mobil/inbox', icon: MessageSquare, label: 'ALIX INBOX' },
  { to: '/mobil/tickets', icon: Ticket, label: 'Ticket Center' },
  { to: '/mobil/magic-suche', icon: Search, label: 'Magic Search' },
  { to: '/mobil/wiedervorlagen', icon: Clock, label: 'Wiedervorlagen' },
  { to: '/mobil/uebergabe', icon: ArrowLeftRight, label: 'Schichtübergabe' },
  { to: '/mobil/supervisor', icon: ShieldCheck, label: 'Supervisor Cockpit' },
  { to: '/mobil/kpi', icon: BarChart3, label: 'Kennzahlen' },
  { to: '/mobil/systemstatus', icon: Activity, label: 'Systemstatus' },
  { to: '/mobil/admin/command-center', icon: Settings2, label: 'Admin · Command Center' },
  { to: '/mobil/benachrichtigungen', icon: Bell, label: 'Benachrichtigungen' },
  { to: '/mobil/einstellungen/benachrichtigungen', icon: BellRing, label: 'Einstellungen · Benachrichtigungen' },
  { to: '/mobil/push-diagnose', icon: Activity, label: 'Push-Diagnose' },
  { to: '/mobil/admin/eskalationen', icon: AlarmClock, label: 'Admin · Eskalationen' },
  { to: '/mobil/admin/alix-ai', icon: Sparkles, label: 'Admin · ALIX AI' },
  { to: '/mobil/inbox/kanaele', icon: Radio, label: 'Admin · Kommunikationskanäle' },

  { to: '/mobil/adressen', icon: Users, label: 'Kunden & Adressen' },
  { to: '/mobil/kontakte', icon: Contact, label: 'Kontakte / iPhone-Sync' },
  { to: '/verkauf/angebote', icon: FileSignature, label: 'Angebote (bestätigen & wandeln)' },
  { to: '/mobil/suche?q=', icon: Cpu, label: 'Geräte / Seriennummer' },
  { to: '/mobil/suche?q=REP', icon: Wrench, label: 'Service & Reparaturen' },
  { to: '/m/alixdocs', icon: FileText, label: 'Dokumente' },
  { to: '/m/kalender', icon: CalendarDays, label: 'Kalender' },
  { to: '/m/tour', icon: Truck, label: 'Techniker-Einsätze' },
];



export default function MobilMehr() {
  const { profile, signOut } = useAuth();
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold">Mehr</h1>
      <Card className="p-4">
        <div className="text-sm font-semibold">{profile?.full_name || profile?.email}</div>
        <div className="text-xs text-muted-foreground">{profile?.email}</div>
      </Card>

      <div className="space-y-2">
        {LINKS.map((l) => (
          <Link key={l.label} to={l.to}>
            <Card className="p-4 min-h-[60px] flex items-center gap-3 active:bg-muted/40">
              <l.icon className="w-5 h-5 text-primary" />
              <span className="font-medium">{l.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <Button asChild variant="outline" className="w-full h-12">
        <Link to="/?desktop=1"><Monitor className="w-4 h-4 mr-2" /> Zur Desktop-Ansicht</Link>
      </Button>
      <Button variant="ghost" className="w-full h-12 text-destructive" onClick={signOut}>
        <LogOut className="w-4 h-4 mr-2" /> Abmelden
      </Button>
    </div>
  );
}
