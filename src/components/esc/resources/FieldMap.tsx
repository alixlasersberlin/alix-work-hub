import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

// Platzhalter-Kartenansicht. Provider-neutral (Google Maps / OSM / Apple)
// – wird in Prompt 7/AI-Dispatcher konkret angebunden.
export function FieldMapPlaceholder() {
  return (
    <Card className="p-8 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <MapPin className="h-6 w-6 text-primary" />
      </div>
      <div className="text-sm font-medium">Außendienst-Karte (Vorbereitung)</div>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        Live-Kartenansicht für Kunden, Techniker, Fahrzeuge, Vorführungen, Installationen und Lieferungen. Die Provider-Anbindung (Google Maps, Apple Maps, HERE, OpenStreetMap) wird über einen austauschbaren Adapter erfolgen. GPS- und Telematik-Feeds sind vorbereitet.
      </p>
    </Card>
  );
}
