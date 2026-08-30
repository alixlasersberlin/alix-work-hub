import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  productId: string;
  productName?: string;
  /** wird nach erfolgreichem "Übernehmen" aufgerufen */
  onDone?: () => void;
  variant?: 'button' | 'icon';
}

export function EnrichProductButton({ productId, productName, onDone, variant = 'button' }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);

  const run = async (mode: 'preview' | 'apply') => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('product-hub-enrich', {
        body: { mode, productIds: [productId], limit: 1 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRes(data);
      if (mode === 'apply') {
        toast.success('Gerätedaten ergänzt');
        onDone?.();
      }
    } catch (e: any) {
      toast.error(e.message || 'Anreicherung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const openDialog = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRes(null);
    setOpen(true);
  };

  return (
    <>
      {variant === 'icon' ? (
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Daten anreichern" onClick={openDialog}>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Sparkles className="w-4 h-4 mr-1" /> Daten anreichern
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Gerätedaten anreichern{productName ? ` · ${productName}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Quellen: alix-lasers.de · alix-lasers.com · alix-laser.ae</p>
            <p>Es werden <strong>ausschließlich leere Felder</strong> gefüllt. Bestehende Angaben bleiben unverändert, jede Änderung wird protokolliert.</p>
          </div>
          {res && (
            <ScrollArea className="h-[280px] border rounded-md p-2">
              <div className="space-y-2 text-xs">
                {(res.results || []).map((r: any) => (
                  <div key={r.id} className="border-b pb-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                    {r.filled?.length > 0 && <div className="text-muted-foreground">Felder: {r.filled.join(', ')}</div>}
                    {r.error && <div className="text-destructive">{r.error}</div>}
                    {r.sources?.length > 0 && <div className="text-muted-foreground truncate">Quelle: {r.sources.join(', ')}</div>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run('preview')}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Vorschau
            </Button>
            <Button disabled={busy} onClick={() => run('apply')}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
