import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TYPES = [
  { name: 'Rechnung', desc: 'Aus production_orders.invoice_pdf_path oder Finance-Rechnungen.' },
  { name: 'Angebot', desc: 'Auftragsbestätigung / Angebot aus orders.' },
  { name: 'Lieferschein', desc: 'Generierter Lieferschein vor Auslieferung.' },
  { name: 'Reparaturbericht', desc: 'Aus repair_orders.work_order_pdf_path.' },
  { name: 'Servicebericht', desc: 'Service-Einsatzbericht.' },
  { name: 'Vertrag', desc: 'Kaufvertrag, Wartungsvertrag, Mietvertrag.' },
  { name: 'Schulungszertifikat', desc: 'Teilnehmer-Zertifikat nach Schulung.' },
  { name: 'Mahnung', desc: 'Zahlungserinnerung / Mahnstufe.' },
];

export default function DokumentenVorlagen() {
  return (
    <div className="space-y-4 animate-fade-in">
      <Alert>
        <Info className="w-4 h-4" />
        <AlertTitle>Dokumenten-Vorlagen</AlertTitle>
        <AlertDescription>
          Die zugrundeliegenden PDF-Templates für Rechnungen, Angebote und Reparaturberichte stammen aus den bestehenden
          Modulen von Alix-Finance (Production, Repair, Finance). Diese Übersicht zeigt, welche Dokumenttypen das MailCenter
          erkennt und automatisch anhängen kann.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Unterstützte Dokumenttypen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            {TYPES.map((t) => (
              <div key={t.name} className="p-4 border border-border rounded-md flex items-start gap-3">
                <Badge className="mt-0.5">{t.name}</Badge>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
