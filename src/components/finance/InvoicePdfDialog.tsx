import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export type PdfInvoiceRef = {
  zoho_invoice_id: string;
  invoice_number?: string | null;
  source_system?: string | null;
  recurring?: boolean;
};

type Props = {
  invoice: PdfInvoiceRef | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/** Zeigt eine Zoho-Rechnung als PDF in einem Popup an. */
export function InvoicePdfDialog({ invoice, open, onOpenChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !invoice?.zoho_invoice_id) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      setLoading(true);
      setError(null);
      setUrl(null);
      try {
        const { data, error: err } = await supabase.functions.invoke('zoho-invoice-pdf', {
          body: {
            zoho_invoice_id: invoice.zoho_invoice_id,
            source_system: invoice.source_system ?? 'zoho_eu_1',
            recurring: !!invoice.recurring,
          },
        });
        if (err) throw err;
        if ((data as any)?.error) throw new Error((data as any).error);
        const b64 = (data as any)?.pdf_base64;
        if (!b64) throw new Error('Kein PDF erhalten');
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        if (!cancelled) setUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'PDF konnte nicht geladen werden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, invoice?.zoho_invoice_id, invoice?.source_system, invoice?.recurring]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span>Rechnung {invoice?.invoice_number || '—'}</span>
            {url && (
              <span className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={url} download={`Rechnung-${invoice?.invoice_number || 'zoho'}.pdf`}>
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
              <Loader2 className="w-5 h-5 animate-spin" /> Rechnung wird von Zoho geladen…
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex items-center justify-center text-sm text-destructive px-6 text-center">{error}</div>
          )}
          {!loading && url && (
            <iframe src={url} title="Rechnung" className="w-full h-full border-0 bg-white" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
