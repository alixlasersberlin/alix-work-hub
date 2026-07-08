import { Card } from '@/components/ui/card';
import { mockLocations } from '@/lib/ecp/mock';
import { MapPin } from 'lucide-react';

export default function EcpLocations() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {mockLocations.map((l) => (
        <Card key={l.id} className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium"><MapPin className="h-4 w-4 text-primary" />{l.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{l.address}</div>
          <div className="text-xs text-muted-foreground mt-1">{l.devices} Geräte · standortbezogene Termine & Ansprechpartner</div>
        </Card>
      ))}
    </div>
  );
}
