import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Truck, Cpu, DoorOpen, Map, Gauge, ArrowRight, ListChecks, MapPin } from 'lucide-react';
import { LiveAvailability } from '@/components/esc/resources/LiveAvailability';
import { RmQuickActions } from '@/components/esc/resources/RmQuickActions';

const TILES = [
  { to: '/esc/rm/mitarbeiter', label: 'Mitarbeiter', icon: Users, desc: 'Qualifikationen, Schichten, Standort, Vertretung' },
  { to: '/esc/rm/fahrzeuge',   label: 'Fahrzeuge',   icon: Truck, desc: 'Flotte, TÜV, Wartung, Fahrer, GPS' },
  { to: '/esc/rm/geraete',     label: 'Vorführgeräte', icon: Cpu, desc: 'BlueIce, SHARK, AESTHERA, HIFU, EMS …' },
  { to: '/esc/rm/raeume',      label: 'Räume',       icon: DoorOpen, desc: 'Schulung, Konferenz, Showroom, Ausstattung' },
  { to: '/esc/rm/aussendienst', label: 'Außendienst', icon: Map, desc: 'Kartenansicht Kunden/Techniker/Lieferungen' },
  { to: '/esc/rm/kapazitaeten', label: 'Kapazitäten', icon: Gauge, desc: 'Heatmap, Woche/Monat/Quartal, Live-Auslastung' },
  { to: '/esc/rm/einsatzplanung', label: 'Einsatzplanung', icon: ListChecks, desc: 'Drag & Drop Disposition, Konfliktprüfung' },
  { to: '/esc/rm/standorte',   label: 'Standorte',   icon: MapPin, desc: 'Standorte anlegen, bearbeiten, löschen (systemweit)' },
];

export default function RmHub() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Ressourcen &amp; Disposition</h1>
        <p className="text-xs text-muted-foreground">Zentrale Planung für Mitarbeiter, Fahrzeuge, Geräte, Räume und Außendienst.</p>
      </div>
      <RmQuickActions />
      <LiveAvailability />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="hover:border-primary/60 transition h-full">
              <CardHeader className="pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><t.icon className="h-4 w-4 text-primary" />{t.label}</CardTitle>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">{t.desc}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
