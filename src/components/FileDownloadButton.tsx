import { useState } from 'react';
import { Archive, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildDownload, deliverDownload, type DownloadSource } from '@/lib/file-download';

interface Props {
  sources: DownloadSource[] | (() => Promise<DownloadSource[]>);
  filename: string;
  zip?: boolean;
  label?: string;
  disabled?: boolean;
  onDelivered?: () => void | Promise<void>;
}

export function FileDownloadButton({ sources, filename, zip = false, label, disabled, onDelivered }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState('');
  const title = label || (zip ? 'Alle Bilder als ZIP' : 'Bild herunterladen');

  async function prepare() {
    setOpen(true); setBusy(true); setBlob(null); setProgress('Dateien werden geladen …');
    try {
      const files = typeof sources === 'function' ? await sources() : sources;
      const result = await buildDownload(files, zip, done => setProgress(`${done} / ${files.length} Dateien geladen`));
      setBlob(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download konnte nicht vorbereitet werden');
      setOpen(false);
    } finally { setBusy(false); }
  }

  return <>
    <Button type="button" size="sm" variant="outline" disabled={busy || disabled} title={title} aria-label={title}
      onClick={e => { e.stopPropagation(); void prepare(); }} className="gap-1.5">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : zip ? <Archive className="w-4 h-4" /> : <Download className="w-4 h-4" />}
      {label || (zip ? title : null)}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onClick={e => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {busy ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />{progress}</div>
          : blob ? <Button className="gap-2" onClick={() => {
            void deliverDownload(blob, filename).then(() => { setOpen(false); setBlob(null); void onDelivered?.(); })
              .catch(() => toast.error('Download fehlgeschlagen'));
          }}><Download className="w-4 h-4" />Herunterladen</Button> : null}
      </DialogContent>
    </Dialog>
  </>;
}