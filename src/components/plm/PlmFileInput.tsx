import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, X, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { deletePlmFile, resolvePlmUrl, uploadPlmFile } from '@/lib/plm/media';

interface Props {
  value?: string | null;
  onChange: (path: string | null) => void;
  /** true = nur Bilder (mit Vorschau), false = beliebige Datei */
  image?: boolean;
  folder?: string;
  disabled?: boolean;
}

/** Upload-Feld für Produktion & Beschaffung — keine URL-Eingabe, nur Datei-Upload. */
export function PlmFileInput({ value, onChange, image = true, folder = 'allgemein', disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => { let a = true; resolvePlmUrl(value).then(u => { if (a) setUrl(u); }); return () => { a = false; }; }, [value]);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast.error('Datei zu groß (max. 25 MB)');
    setBusy(true);
    try {
      const path = await uploadPlmFile(f, folder);
      onChange(path);
      toast.success('Datei hochgeladen');
    } catch (e: any) {
      toast.error(e?.message || 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  async function clear() {
    const old = value;
    onChange(null);
    if (old) await deletePlmFile(old).catch(() => {});
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept={image ? 'image/*' : undefined}
        className="hidden"
        onChange={e => pick(e.target.files)}
      />
      {value ? (
        <div className="flex items-center gap-3">
          {image && url ? (
            <a href={url} target="_blank" rel="noreferrer" className="block">
              <img src={url} alt="Vorschau" className="h-20 w-20 rounded-md object-cover border border-border" />
            </a>
          ) : (
            <a href={url || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
              <FileText className="w-4 h-4" /> Datei öffnen <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {!disabled && (
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ersetzen'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={busy}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={() => ref.current?.click()} disabled={busy || disabled}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {image ? 'Foto hochladen' : 'Datei hochladen'}
        </Button>
      )}
    </div>
  );
}

/** Kleine Tabellen-Vorschau für gespeicherte Bilder. */
export function PlmThumb({ value }: { value?: string | null }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let a = true; resolvePlmUrl(value).then(u => { if (a) setUrl(u); }); return () => { a = false; }; }, [value]);
  if (!value) return <span className="text-muted-foreground">—</span>;
  if (!url) return <span className="text-muted-foreground">…</span>;
  return <img src={url} alt="" className="h-10 w-10 rounded object-cover border border-border" />;
}
