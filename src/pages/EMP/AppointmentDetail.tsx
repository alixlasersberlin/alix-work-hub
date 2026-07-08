import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Phone, MapPin, Play, Pause, Square } from 'lucide-react';
import SignaturePad from '@/components/emp/SignaturePad';
import PhotoCapture from '@/components/emp/PhotoCapture';
import QrScanner from '@/components/emp/QrScanner';
import MobileChecklist from '@/components/emp/MobileChecklist';
import { enqueue } from '@/lib/emp/offline';
import { auditMobile } from '@/lib/emp/audit';
import { toast } from 'sonner';
import { useState } from 'react';

export default function EmpAppointmentDetail() {
  const { id = 'a1' } = useParams();
  const [timer, setTimer] = useState<{ start?: string; pause?: string; end?: string }>({});

  const saveSig = (dataUrl: string, who: string) => {
    enqueue({ kind: 'signature', payload: { appointmentId: id, who, dataUrl } });
    auditMobile('signature_saved', { appointmentId: id, who });
    toast.success(`Unterschrift ${who} gespeichert`);
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="text-xs text-muted-foreground">Termin</div>
        <div className="text-lg font-semibold">Service Laser MedX</div>
        <div className="text-xs text-muted-foreground">Praxis Dr. Berger · München · 08:30</div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline"><Phone className="h-4 w-4 mr-1" />Anruf</Button>
          <Button size="sm" variant="outline"><MapPin className="h-4 w-4 mr-1" />Navi</Button>
        </div>
      </Card>

      <Tabs defaultValue="check">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="check">Check</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="zeit">Zeit</TabsTrigger>
          <TabsTrigger value="sign">Sign.</TabsTrigger>
          <TabsTrigger value="qr">QR</TabsTrigger>
        </TabsList>

        <TabsContent value="check">
          <MobileChecklist onChange={(items) => enqueue({ kind: 'checklist', payload: { appointmentId: id, items } })} />
        </TabsContent>

        <TabsContent value="fotos">
          <PhotoCapture appointmentId={id} onChange={(photos) => enqueue({ kind: 'photo', payload: { appointmentId: id, count: photos.length } })} />
        </TabsContent>

        <TabsContent value="zeit">
          <Card className="p-3 space-y-3">
            <div className="text-sm">
              Start: {timer.start ?? '—'} · Pause: {timer.pause ?? '—'} · Ende: {timer.end ?? '—'}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { const t = new Date().toLocaleTimeString(); setTimer({ ...timer, start: t }); enqueue({ kind: 'time', payload: { appointmentId: id, action: 'start', t } }); }}><Play className="h-4 w-4 mr-1" />Start</Button>
              <Button size="sm" variant="outline" onClick={() => { const t = new Date().toLocaleTimeString(); setTimer({ ...timer, pause: t }); enqueue({ kind: 'time', payload: { appointmentId: id, action: 'pause', t } }); }}><Pause className="h-4 w-4 mr-1" />Pause</Button>
              <Button size="sm" variant="outline" onClick={() => { const t = new Date().toLocaleTimeString(); setTimer({ ...timer, end: t }); enqueue({ kind: 'time', payload: { appointmentId: id, action: 'end', t } }); }}><Square className="h-4 w-4 mr-1" />Ende</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sign" className="space-y-3">
          <Card className="p-3"><SignaturePad label="Kunde" onSave={(d) => saveSig(d, 'kunde')} /></Card>
          <Card className="p-3"><SignaturePad label="Techniker" onSave={(d) => saveSig(d, 'techniker')} /></Card>
        </TabsContent>

        <TabsContent value="qr">
          <QrScanner onScan={(code) => { enqueue({ kind: 'qr', payload: { appointmentId: id, code } }); toast.success(`Code erfasst: ${code}`); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
