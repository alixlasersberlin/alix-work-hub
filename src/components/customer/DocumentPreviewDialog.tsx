import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Props = {
  documentId: string | null;
  title?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/** Zeigt ein ALIXDocs-Dokument als Vorschau in einem Popup an. */
export function DocumentPreviewDialog({ documentId, title, open, onOpenChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setUrl(null);
      try {
        const { data: meta } = await supabase
          .from('alixdocs_documents')
          .select('current_version')
          .eq('id', documentId)
          .maybeSingle();
        const { data, error: err } = await supabase.functions.invoke('alixdocs-signed-url', {
          body: { document_id: documentId, version_number: (meta as any)?.current_version ?? 1 },
        });
        if (err) throw err;
        if ((data as any)?.error) throw new Error((data as any).error);
        if (!cancelled) setUrl((data as any).url);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Dokument konnte nicht geladen werden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="truncate">{title || 'Beleg'}</span>
            {url && (
              <span className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={url} download>
                    <Download className="w-4 h-4 mr-1" /> Download
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={url} target="_blank" rel="noopener">
                    <ExternalLink className="w-4 h-4 mr-1" /> Neuer Tab
                  </a>
                </Button>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-neutral-900/40">
          {loading && (
            <div className="h-full flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Beleg wird geladen…
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex items-center justify-center text-sm text-destructive px-6 text-center">{error}</div>
          )}
          {!loading && url && <iframe src={url} title="Beleg" className="w-full h-full border-0 bg-white" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
