import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MailOpen, MousePointerClick, AlertTriangle, Megaphone } from 'lucide-react';

const kpis = [
  { label: 'Versendete E-Mails', value: '—', icon: Send, hint: 'Letzte 30 Tage' },
  { label: 'Geöffnete E-Mails', value: '—', icon: MailOpen, hint: 'Öffnungsrate folgt' },
  { label: 'Klicks', value: '—', icon: MousePointerClick, hint: 'Link-Tracking folgt' },
  { label: 'Bounces', value: '—', icon: AlertTriangle, hint: 'Hard/Soft kombiniert' },
  { label: 'Kampagnen', value: '—', icon: Megaphone, hint: 'Aktiv & geplant' },
];

export default function MailCenterDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-foreground">Übersicht</h2>
        <p className="text-sm text-muted-foreground">Live-KPIs erscheinen sobald die Datenanbindung aktiv ist.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="card-glow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {k.label}
                </CardTitle>
                <Icon className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-display font-bold text-foreground">{k.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display">Aktivität (Platzhalter)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Die Aktivitätsgrafik wird in einem späteren Schritt an die Tabellen
          <code className="mx-1 px-1 rounded bg-muted">mail_recipients</code>
          und
          <code className="mx-1 px-1 rounded bg-muted">mail_events</code>
          angebunden.
        </CardContent>
      </Card>
    </div>
  );
}
