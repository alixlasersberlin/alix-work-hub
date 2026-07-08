import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import PhotoCapture from '@/components/emp/PhotoCapture';
import SignaturePad from '@/components/emp/SignaturePad';
import { enqueue } from '@/lib/emp/offline';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

const MATERIALS = ['Handstück', 'Filter', 'Laserlinse', 'Netzteil', 'Prisma', 'Kühlmittel', 'Zubehör'];

export default function EmpServiceReport() {
  const [fault, setFault] = useState('');
  const [work, setWork] = useState('');
  const [duration, setDuration] = useState('');
  const [mats, setMats] = useState<string[]>([]);

  const toggle = (m: string) => setMats(mats.includes(m) ? mats.filter(x => x !== m) : [...mats, m]);

  const submit = () => {
    enqueue({ kind: 'service_report', payload: { fault, work, duration, materials: mats } });
    toast.success('Servicebericht gespeichert (offline-fähig)');
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Servicebericht</div>
        <div className="space-y-2">
          <Label>Fehlerbeschreibung</Label>
          <Textarea value={fault} onChange={(e) => setFault(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Durchgeführte Arbeiten</Label>
          <Textarea value={work} onChange={(e) => setWork(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Arbeitszeit (h)</Label>
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label>Materialverbrauch</Label>
          <div className="grid grid-cols-2 gap-2">
            {MATERIALS.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox checked={mats.includes(m)} onCheckedChange={() => toggle(m)} />
                {m}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-3"><PhotoCapture /></Card>
      <Card className="p-3"><SignaturePad label="Kunde bestätigt" onSave={() => toast.success('Unterschrift gespeichert')} /></Card>

      <Button className="w-full" onClick={submit}>Bericht speichern &amp; PDF erzeugen</Button>
    </div>
  );
}
