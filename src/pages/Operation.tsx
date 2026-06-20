import { Workflow, Mail, FileText, ChevronRight, Database, MessageSquare, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { useAuth } from '@/hooks/useAuth';

const tiles = [
  { to: '/operation/email-vorlagen', icon: Mail, title: 'E-Mail Vorlagen', desc: 'Inhalte automatisch versendeter E-Mails bearbeiten.' },
  { to: '/operation/sms-konfiguration', icon: MessageSquare, title: 'SMS Konfiguration', desc: 'Twilio-Verbindung prüfen und SMS-Vorlagen verwalten.' },
  { to: '/operation/logfiles', icon: FileText, title: 'Logfiles', desc: 'System- und Audit-Logs einsehen.' },
  { to: '/operation/alixsmart-migration', icon: Database, title: 'AlixSmart Migration', desc: 'Import Engine: Verbindung, Dry-Run und Wellen-Import.' },
];

const SECURITY_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung'];

export default function Operation() {
  const { hasAnyRole } = useAuth();
  const allTiles = [
    ...tiles,
    ...(hasAnyRole(SECURITY_ROLES)
      ? [{
          to: '/operation/security-center',
          icon: Shield,
          title: 'Alix Security Center',
          desc: 'Enterprise-Sicherheitsüberwachung: Logins, Sitzungen, Geräte, IPs, Warnungen, Security Score.',
        }]
      : []),
  ];
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        icon={Workflow}
        title="Operation"
        subtitle="Operative Abläufe und Tools."
        noBreadcrumbs
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allTiles.map(t => (
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
