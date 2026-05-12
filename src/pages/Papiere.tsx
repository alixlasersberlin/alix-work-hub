import { FileText, FileSignature, Receipt, FileCheck2, Files, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';

const tiles = [
  { title: 'Angebote', description: 'Alle erstellten Angebote', icon: FileText, to: '/verkauf/angebote' },
  { title: 'Auftragsbestätigungen', description: 'Bestätigte Aufträge', icon: FileCheck2, to: '/auftraege' },
  { title: 'Lieferscheine', description: 'Lieferdokumente', icon: Truck, to: '/geliefert' },
  { title: 'Rechnungen', description: 'Ausgangsrechnungen', icon: Receipt, to: '/finance/rechnungen' },
  { title: 'Anzahlungsrechnungen', description: 'Offene Anzahlungen', icon: FileSignature, to: '/verkauf/anzahlungsrechnung' },
  { title: 'Gutschriften', description: 'Erstellte Gutschriften', icon: Files, to: '/verkauf/gutschriften' },
];

export default function Papiere() {
  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">VERSAND</h1>
        <p className="text-muted-foreground">Übersicht aller Geschäftsdokumente</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to}>
              <Card className="p-6 h-full transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10 cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg text-foreground">{t.title}</h3>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
