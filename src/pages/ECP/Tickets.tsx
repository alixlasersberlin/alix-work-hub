import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { mockTickets } from '@/lib/ecp/mock';

const STATES = ['Alle', 'Offen', 'In Bearbeitung', 'Wartend', 'Gelöst', 'Geschlossen'] as const;

export default function EcpTickets() {
  return (
    <Tabs defaultValue="Alle">
      <TabsList className="flex-wrap h-auto">
        {STATES.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
      </TabsList>
      {STATES.map((s) => (
        <TabsContent key={s} value={s} className="space-y-2">
          {mockTickets
            .filter((t) => s === 'Alle' || t.status === s)
            .map((t) => (
              <Card key={t.id} className="p-3">
                <div className="text-xs text-muted-foreground">#{t.id} · aktualisiert {t.updated}</div>
                <div className="text-sm font-medium mt-1">{t.subject}</div>
                <div className="text-xs text-muted-foreground mt-1">Status: {t.status} · Bearbeiter: {t.assignee}</div>
              </Card>
            ))}
          {mockTickets.filter((t) => s === 'Alle' || t.status === s).length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground text-center">Keine Tickets in dieser Kategorie.</Card>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
