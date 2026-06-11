import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ArrowLeft, FileSignature, Eraser, Save, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enqueue, flush } from '@/lib/mobile/outbox';
import { toast } from 'sonner';

export default function MobileSignatur() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [role, setRole] = useState('customer');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const c = canvasRef.current;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      c.width = c.offsetWidth * ratio;
      c.height = c.offsetHeight * ratio;
      c.getContext('2d')?.scale(ratio, ratio);
      padRef.current?.clear();
      setHasInk(false);
    };
    padRef.current = new SignaturePad(c, { backgroundColor: 'rgba(255,255,255,0)', penColor: 'hsl(var(--foreground))' });
    padRef.current.addEventListener('endStroke', () => setHasInk(!padRef.current?.isEmpty()));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const clear = () => { padRef.current?.clear(); setHasInk(false); };

  const save = async () => {
    if (!padRef.current || padRef.current.isEmpty()) { toast.error('Bitte unterschreiben.'); return; }
    if (!id) return;
    setBusy(true);
    const dataUrl = padRef.current.toDataURL('image/png');
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${id}/signatures/${role}-${Date.now()}.png`;
    await enqueue({
      kind: 'signature',
      blob,
      blob_path: path,
      payload: { route_plan_id: id, role, signer_name: name || null },
    });
    if (navigator.onLine) {
      const r = await flush();
      toast.success(`${r.ok} gespeichert`);
    } else {
      toast.info('Offline – wird beim nächsten Sync übermittelt.');
    }
    padRef.current.clear();
    setHasInk(false);
    setName('');
    setBusy(false);
  };

  return (
    <div className="p-4 space-y-4">
      <Link to={`/m/einsatz/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> zurück
      </Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><FileSignature className="w-5 h-5" /> Signatur</h1>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Rolle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Kunde</SelectItem>
                <SelectItem value="technician">Techniker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unterzeichner" />
          </div>
        </div>
        <div className="rounded-md border border-border bg-secondary/40 relative">
          <canvas ref={canvasRef} className="w-full h-56 touch-none" />
          {!hasInk && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none text-xs text-muted-foreground">
              hier unterschreiben
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clear} disabled={!hasInk} className="flex-1 h-11">
            <Eraser className="w-4 h-4 mr-1" /> löschen
          </Button>
          <Button onClick={save} disabled={busy || !hasInk} className="flex-1 h-11 gold-gradient">
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            speichern
          </Button>
        </div>
      </Card>
    </div>
  );
}
