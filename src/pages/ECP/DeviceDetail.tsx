import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { mockDevices } from '@/lib/ecp/mock';

export default function EcpDeviceDetail() {
  const { id } = useParams();
  const d = mockDevices.find((x) => x.id === id) ?? mockDevices[0];
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-xs text-muted-foreground">Gerät</div>
        <div className="text-lg font-semibold">{d.model}</div>
        <div className="text-xs text-muted-foreground">SN {d.serial} · {d.location}</div>
      </Card>
      <Tabs defaultValue="uebersicht">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
          <TabsTrigger value="wartung">Wartungen</TabsTrigger>
          <TabsTrigger value="doks">Dokumente</TabsTrigger>
          <TabsTrigger value="anleit">Anleitungen</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="historie">Historie</TabsTrigger>
          <TabsTrigger value="garantie">Garantie</TabsTrigger>
        </TabsList>
        {['uebersicht','service','wartung','doks','anleit','videos','downloads','historie','garantie'].map((t) => (
          <TabsContent key={t} value={t}>
            <Card className="p-4 text-sm text-muted-foreground">Bereich „{t}" – Daten stammen aus AlixWorks-CRM & Service.</Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
