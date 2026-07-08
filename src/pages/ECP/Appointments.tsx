import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Download, Calendar, Video, RefreshCw, X, Check } from 'lucide-react';
import { mockAppointments } from '@/lib/ecp/mock';
import { toast } from 'sonner';

function List({ filter }: { filter: 'kommende' | 'vergangen' | 'alle' }) {
  const items = mockAppointments.filter((a) => filter === 'alle' ? true : filter === 'vergangen' ? a.status === 'vergangen' : a.status !== 'vergangen');
  if (!items.length) return <Card className="p-6 text-sm text-muted-foreground text-center">Keine Termine.</Card>;
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <Card key={a.id} className="p-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{a.when}</div>
            <div className="text-sm font-medium">{a.title}</div>
            <div className="text-xs text-muted-foreground">Status: {a.status}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.success('ICS heruntergeladen')}><Download className="h-4 w-4 mr-1" />ICS</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success('Meeting wird geöffnet')}><Video className="h-4 w-4 mr-1" />Meeting</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success('Bestätigt')}><Check className="h-4 w-4 mr-1" />Bestätigen</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success('Umbuchung angefragt')}><RefreshCw className="h-4 w-4 mr-1" />Umbuchen</Button>
            <Button size="sm" variant="outline" onClick={() => toast.success('Absage gesendet')}><X className="h-4 w-4 mr-1" />Absagen</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function EcpAppointments() {
  return (
    <Tabs defaultValue="kommende">
      <TabsList>
        <TabsTrigger value="kommende">Kommende</TabsTrigger>
        <TabsTrigger value="vergangen">Vergangen</TabsTrigger>
        <TabsTrigger value="alle">Alle</TabsTrigger>
      </TabsList>
      <TabsContent value="kommende"><List filter="kommende" /></TabsContent>
      <TabsContent value="vergangen"><List filter="vergangen" /></TabsContent>
      <TabsContent value="alle"><List filter="alle" /></TabsContent>
    </Tabs>
  );
}
