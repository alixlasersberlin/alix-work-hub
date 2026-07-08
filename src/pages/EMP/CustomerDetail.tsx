import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MessageCircle, Video, MapPin } from 'lucide-react';

export default function EmpCustomerDetail() {
  const { id } = useParams();
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-xs text-muted-foreground">Kunde</div>
        <div className="text-lg font-semibold">Praxis Dr. Berger</div>
        <div className="text-xs text-muted-foreground">ID: {id}</div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline"><Phone className="h-4 w-4 mr-1" />Anruf</Button>
          <Button size="sm" variant="outline"><Mail className="h-4 w-4 mr-1" />E-Mail</Button>
          <Button size="sm" variant="outline"><MessageCircle className="h-4 w-4 mr-1" />WhatsApp</Button>
          <Button size="sm" variant="outline"><Video className="h-4 w-4 mr-1" />Teams</Button>
        </div>
        <Button variant="outline" size="sm" className="mt-2 w-full">
          <MapPin className="h-4 w-4 mr-1" /> Navigation starten
        </Button>
      </Card>

      <Tabs defaultValue="info">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="geraete">Geräte</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="doks">Doks</TabsTrigger>
        </TabsList>
        <TabsContent value="info"><Card className="p-3 text-sm text-muted-foreground">Kontaktdaten und Ansprechpartner.</Card></TabsContent>
        <TabsContent value="geraete"><Card className="p-3 text-sm text-muted-foreground">Installierte Geräte und Seriennummern.</Card></TabsContent>
        <TabsContent value="service"><Card className="p-3 text-sm text-muted-foreground">Vergangene Serviceeinsätze.</Card></TabsContent>
        <TabsContent value="tickets"><Card className="p-3 text-sm text-muted-foreground">Offene und geschlossene Tickets.</Card></TabsContent>
        <TabsContent value="doks"><Card className="p-3 text-sm text-muted-foreground">Dokumente, Verträge, Rechnungen (rollenabhängig).</Card></TabsContent>
      </Tabs>
    </div>
  );
}
