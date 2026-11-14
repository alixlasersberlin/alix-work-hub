import { useEffect, useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type jsPDF from 'jspdf';

export function markOfferDemo(doc: jsPDF) {
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('DEMO – UNVERBINDLICHE VORSCHAU – NICHT ZUR UNTERSCHRIFT', doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
  }
}

export function OfferDemoPdf({ build, filename, disabled }: { build: () => Promise<Blob | undefined>; filename: string; disabled: boolean }) {
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // Discard the previous PDF when any of the source values changes.
  useEffect(() => { setUrl(undefined); }, [build]);
  async function prepare(download: boolean) {
    setBusy(true);
    try {
      const blob = await build();
      if (!blob) throw new Error('Demo-PDF konnte nicht erstellt werden.');
      const next = URL.createObjectURL(blob);
      setUrl(next);
      if (download) {
        const link = document.createElement('a');
        link.href = next; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
      }
    } catch (error) {
      toast({ title: 'PDF konnte nicht erstellt werden', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => prepare(false)}><Eye className="mr-2 h-4 w-4" />PDF-Vorschau</Button>
      <Button type="button" disabled={disabled || busy} onClick={() => prepare(true)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Demo-PDF speichern</Button>
    </div>
    {url && <><iframe title="Demo-PDF Vorschau" src={url} className="h-[65vh] w-full rounded-md border border-border bg-background" /><a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Demo-PDF öffnen</a></>}
  </div>;
}