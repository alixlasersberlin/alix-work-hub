import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Workflow, Info, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const RULES = [
  { trigger: 'Rechnung erstellt', doc: 'Rechnung.pdf', empfaenger: 'Kunde' },
  { trigger: 'Auftrag bestätigt', doc: 'Angebot.pdf', empfaenger: 'Kunde' },
  { trigger: 'Gerät geliefert', doc: 'Lieferschein.pdf', empfaenger: 'Kunde' },
  { trigger: 'Reparatur abgeschlossen', doc: 'Reparaturbericht.pdf', empfaenger: 'Kunde' },
  { trigger: 'Zertifikat erstellt', doc: 'Schulungszertifikat.pdf', empfaenger: 'Teilnehmer' },
];

export default function DokumentenAutomationen() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Alert>
        <Info className="w-4 h-4" />
        <AlertTitle>Dokumenten-Automationen</AlertTitle>
        <AlertDescription>
          Diese Regeln werden über das bestehende MailCenter-Automationsmodul ausgeführt. Pro Auslöser kann eine E-Mail-Vorlage
          mit dem passenden PDF-Anhang konfiguriert werden. Bestehende Versand- und Genehmigungsprozesse bleiben unverändert.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2"><Workflow className="w-5 h-5" /> Versandregeln</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/mailcenter/automationen">Zu den Automationen <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {RULES.map((r) => (
              <div key={r.trigger} className="p-4 border border-border rounded-md flex flex-wrap items-center gap-3">
                <Badge>{r.trigger}</Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline">{r.doc}</Badge>
                <span className="text-sm text-muted-foreground ml-auto">an {r.empfaenger}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
