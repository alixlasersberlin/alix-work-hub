import { Link } from 'react-router-dom';
import {
  ShoppingCart, CheckCircle2, AlertTriangle, Factory, ShieldCheck,
  Package, Boxes, Inbox, ListOrdered, Receipt,
} from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';

const TILES = [
  { path: '/order/frei-bestellung', label: 'Bestellung möglich', desc: 'Aufträge, die jetzt bestellt werden können.', icon: CheckCircle2 },
  { path: '/order/reklamation', label: 'Bestellung Reklamation', desc: 'Reklamationsbestellungen verwalten.', icon: AlertTriangle },
  { path: '/order', label: 'Factory Orders', desc: 'Alle Werks-/Produktionsbestellungen.', icon: Factory },
  { path: '/order/freigabe', label: 'Freigabe', desc: 'Super-Admin Freigabe-Queue.', icon: ShieldCheck },
  { path: '/bestellwesen/ersatzteile', label: 'Ersatzteil-Bestellvorschläge', desc: 'Automatische Vorschläge für Ersatzteile.', icon: Package },
  { path: '/ersatzteilmanagement', label: 'Ersatzteilmanagement', desc: 'Bestände und Stammdaten für Ersatzteile.', icon: Boxes },
  { path: '/production/order-in', label: 'Order In', desc: 'Eingehende Lieferanten-Bestellungen.', icon: Inbox },
  { path: '/production', label: 'Produktions-Liste', desc: 'Übersicht aller Production Orders.', icon: ListOrdered },
  { path: '/production/fertig', label: 'Fertig produziert', desc: 'Abgeschlossene Produktionen.', icon: CheckCircle2 },
  { path: '/production/factory-invoice', label: 'Factory Invoice', desc: 'Lieferantenrechnungen.', icon: Receipt },
];

export default function BestellwesenOverview() {
  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={ShoppingCart}
        title="Bestellwesen"
        subtitle="Zentrale Übersicht aller Bestell- und Produktionsmodule."
        noBreadcrumbs
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {TILES.map(({ path, label, desc, icon: Icon }) => (
          <Link key={path} to={path} className="group">
            <Card className="p-5 h-full card-glow border-border hover:border-primary/60 transition-all hover:-translate-y-0.5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
