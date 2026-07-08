import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';

interface Item { id: string; time: string; title: string; where?: string; }

const MOCK_TODAY: Item[] = [
  { id: 'a1', time: '08:30', title: 'Service Laser MedX', where: 'Praxis Dr. Berger · München' },
  { id: 'a2', time: '11:00', title: 'Auslieferung Vorführgerät', where: 'Klinik Nord · Hamburg' },
  { id: 'a3', time: '14:00', title: 'Schulung Basics', where: 'Alix Campus · Berlin' },
];

export default function EmpCalendar() {
  const [items] = useState(MOCK_TODAY);

  return (
    <Tabs defaultValue="tag" className="space-y-3">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="tag">Tag</TabsTrigger>
        <TabsTrigger value="agenda">Agenda</TabsTrigger>
        <TabsTrigger value="woche">Woche</TabsTrigger>
      </TabsList>
      <TabsContent value="tag" className="space-y-2">
        {items.map((it) => (
          <Link to={`/emp/termin/${it.id}`} key={it.id}>
            <Card className="p-3 hover:border-primary/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {it.time}
              </div>
              <div className="text-sm font-medium mt-1">{it.title}</div>
              {it.where && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3.5 w-3.5" /> {it.where}
                </div>
              )}
            </Card>
          </Link>
        ))}
      </TabsContent>
      <TabsContent value="agenda">
        <Card className="p-4 text-sm text-muted-foreground">Agenda-Ansicht (kompakt): heute, morgen, diese Woche.</Card>
      </TabsContent>
      <TabsContent value="woche">
        <Card className="p-4 text-sm text-muted-foreground">Wochenübersicht — 7 Tage mit Zeitrastern (touch-optimiert).</Card>
      </TabsContent>
    </Tabs>
  );
}
