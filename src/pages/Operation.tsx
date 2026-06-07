import { Workflow, Mail, FileText, ChevronRight, Database } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';

const tiles = [
  { to: '/operation/email-vorlagen', icon: Mail, title: 'E-Mail Vorlagen', desc: 'Inhalte automatisch versendeter E-Mails bearbeiten.' },
  { to: '/operation/logfiles', icon: FileText, title: 'Logfiles', desc: 'System- und Audit-Logs einsehen.' },
  { to: '/operation/alixsmart-migration', icon: Database, title: 'AlixSmart Migration', desc: 'Import Engine: Verbindung, Dry-Run und Wellen-Import.' },
];

export default function Operation() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Workflow className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Operation</h1>
          <p className="text-muted-foreground text-sm">Operative Abläufe und Tools.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map(t => (
          <Link key={t.to} to={t.to}>
            <Card className="hover:border-primary/60 transition-colors h-full">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <t.icon className="h-6 w-6 text-primary" />
                <CardTitle className="text-lg">{t.title}</CardTitle>
                <ChevronRight className="h-5 w-5 ml-auto text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{t.desc}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
