import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, ArrowLeft, Upload, Loader2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enqueue, flush } from '@/lib/mobile/outbox';
import { toast } from 'sonner';

const CATEGORIES = ['vorher', 'nachher', 'schaden', 'ersatzteil', 'installation', 'sonstiges'];

interface Preview { url: string; name: string; cat: string; }

export default function MobileFotos() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState('vorher');
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);

  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews]);

  const onFiles = async (files: FileList | null) => {
    if (!files || !id || !user) return;
    setBusy(true);
    const newPreviews: Preview[] = [];
    for (const f of Array.from(files)) {
      const ts = Date.now();
      const path = `${id}/${cat}/${ts}-${f.name}`;
      await enqueue({
        kind: 'photo',
        blob: f,
        blob_path: path,
        payload: {
          route_plan_id: id,
          attachment_kind: cat,
          file_name: f.name,
          uploaded_by: user.id,
        },
      });
      newPreviews.push({ url: URL.createObjectURL(f), name: f.name, cat });
    }
    setPreviews(prev => [...newPreviews, ...prev]);
    setBusy(false);
    if (navigator.onLine) {
      const r = await flush();
      toast.success(`${r.ok} hochgeladen${r.failed ? `, ${r.failed} offen` : ''}`);
    } else {
      toast.info('Offline – wird beim nächsten Sync hochgeladen.');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="p-4 space-y-4">
      <Link to={`/m/einsatz/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> zurück
      </Link>
      <h1 className="text-xl font-bold flex items-center gap-2"><Camera className="w-5 h-5" /> Fotos</h1>

      <Card className="p-4 space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Kategorie</div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy} className="w-full h-12 gold-gradient">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-5 h-5 mr-2" />}
          Foto aufnehmen / wählen
        </Button>
      </Card>

      {previews.length > 0 && (
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">{previews.length} Foto(s) in Warteschlange</div>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-secondary">
                <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 backdrop-blur px-1.5 py-0.5 rounded">
                  {p.cat}
                </span>
                <button
                  onClick={() => { URL.revokeObjectURL(p.url); setPreviews(prev => prev.filter((_, j) => j !== i)); }}
                  className="absolute top-1 right-1 bg-background/80 backdrop-blur rounded-full p-0.5"
                  aria-label="entfernen"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
