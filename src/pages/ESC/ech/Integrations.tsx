import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlugZap } from 'lucide-react';
import { getIntegrations, setIntegrationStatus, subscribeEch } from '@/lib/esc/ech/store';
import type { EchIntegration } from '@/lib/esc/ech/types';
import { toast } from 'sonner';

const CATS: { id: EchIntegration['category']; label: string }[] = [
  { id: 'calendar', label: 'Kalender' },
  { id: 'meeting', label: 'Videokonferenzen' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'push', label: 'Push' },
];

export default function EchIntegrations() {
  const [items, setItems] = useState<EchIntegration[]>(getIntegrations());
  useEffect(() => subscribeEch(() => setItems(getIntegrations())), []);

  const setStatus = (id: EchIntegration['id'], status: EchIntegration['status']) => {
    setIntegrationStatus(id, { status });
    toast.success('Status aktualisiert');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PlugZap className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Integrationen</h1>
      </div>
      <div className="text-[11.5px] text-muted-foreground">Alle Integrationen sind modular. „Vorbereitet" bedeutet: API-Anbindung ist entkoppelt und wird durch Freischaltung aktiviert – ohne Änderung an anderen Modulen.</div>

      {CATS.map((cat) => (
        <Card key={cat.id}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{cat.label}</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border/50">
            {items.filter((i) => i.category === cat.id).map((i) => (
              <div key={i.id} className="py-2 grid md:grid-cols-[1fr_160px_180px_auto] gap-2 items-center text-[12.5px]">
                <span>{i.name}{i.note && <span className="text-[10.5px] text-muted-foreground ml-2">{i.note}</span>}</span>
                <Badge variant={i.status === 'connected' ? 'default' : 'secondary'} className="text-[10px] w-fit">{i.status}</Badge>
                <Select value={i.mode ?? 'read'} onValueChange={(v) => setIntegrationStatus(i.id, { mode: v as 'read' | 'read_write' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Nur lesen</SelectItem>
                    <SelectItem value="read_write">Lesen & Schreiben</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 justify-end">
                  {i.status !== 'connected' && <Button size="sm" onClick={() => setStatus(i.id, 'connected')}>Aktivieren</Button>}
                  {i.status === 'connected' && <Button size="sm" variant="outline" onClick={() => setStatus(i.id, 'prepared')}>Deaktivieren</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
