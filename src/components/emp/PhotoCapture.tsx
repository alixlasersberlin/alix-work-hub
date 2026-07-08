import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface Photo { id: string; dataUrl: string; note?: string; }

interface Props {
  appointmentId?: string;
  onChange?: (photos: Photo[]) => void;
}

export default function PhotoCapture({ appointmentId, onChange }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  const add = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const p: Photo = { id: crypto.randomUUID(), dataUrl: reader.result as string };
      const next = [...photos, p];
      setPhotos(next);
      onChange?.(next);
    };
    reader.readAsDataURL(file);
  };

  const remove = (id: string) => {
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) add(f); e.currentTarget.value = ''; }}
      />
      <Button variant="outline" onClick={() => ref.current?.click()} className="w-full">
        <Camera className="h-4 w-4 mr-2" /> Foto aufnehmen
      </Button>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5"
                aria-label="Entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {appointmentId && <div className="text-[10px] text-muted-foreground">Zugeordnet zu Termin {appointmentId}</div>}
    </div>
  );
}
