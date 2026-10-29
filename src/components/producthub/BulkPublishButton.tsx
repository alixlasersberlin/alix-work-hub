import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { phUpdateProduct, phUpsertChannel } from '@/lib/producthub/api';
import { publishAllProducts, type BulkProduct, type BulkSite, type BulkMapping, type BulkResult } from '@/lib/producthub/bulkPublish';
import { toast } from 'sonner';

const db = supabase as any;
async function readAll<T>(table: string, fields: string): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await db.from(table).select(fields).order('id').range(start, start + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 500) return rows;
  }
}

export function BulkPublishButton({ onDone }: { onDone: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  const [snapshot, setSnapshot] = useState<{ products: BulkProduct[]; sites: BulkSite[]; mappings: BulkMapping[] } | null>(null);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [completed, setCompleted] = useState(0);
  const prepare = async () => {
    setLoading(true);
    try {
      const [products, allSites, mappings] = await Promise.all([
        readAll<BulkProduct>('ph_products', 'id,name'),
        readAll<BulkSite>('ph_channels', 'id,code,name,is_active'),
        readAll<BulkMapping>('ph_lang_sync_map', 'id,product_id,site_code,remote_product_id,verified_at'),
      ]);
      const sites = allSites.filter(s => s.is_active);
      if (!products.length || !sites.length) throw new Error('Keine Geräte oder aktiven Webseiten vorhanden');
      setSnapshot({ products, sites, mappings }); setResults([]); setCompleted(0); setDone(false); setOpen(true);
    } catch (e: any) { toast.error(e?.message || 'Abgleich konnte nicht vorbereitet werden'); }
    finally { setLoading(false); }
  };
  const run = async () => {
    if (!snapshot || lock.current) return;
    lock.current = true; setRunning(true);
    try {
      await publishAllProducts(snapshot.products, snapshot.sites, snapshot.mappings, {
        updateProduct: phUpdateProduct,
        updateChannel: phUpsertChannel,
        pushCom: async id => {
          const { data, error } = await supabase.functions.invoke('ph-com-publish-device', { body: { product_id: id } });
          if (error) {
            let message = error.message;
            try { const body = await error.context?.json(); message = body?.error || message; } catch { /* response may not be JSON */ }
            throw new Error(message);
          }
          if (!data?.ok || data?.error || data?.mismatches?.length || data?.master?.ok === false) {
            throw new Error(data?.error || data?.master?.error || (data?.mismatches?.length ? `Kontrolle abweichend: ${data.mismatches.join(', ')}` : 'Annahme nicht bestätigt'));
          }
        },
      }, (count, result) => { setCompleted(count); setResults(prev => [...prev, result]); });
      setDone(true); await onDone();
    } catch (e: any) { toast.error(e?.message || 'Abgleich unterbrochen'); }
    finally { lock.current = false; setRunning(false); }
  };
  const total = (snapshot?.products.length || 0) * (snapshot?.sites.length || 0);
  return <>
    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={prepare} disabled={loading || running}>
      {loading || running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Abgleich All
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!running) setOpen(value); }}>
      <DialogContent className="max-w-3xl" onEscapeKeyDown={e => { if (running) e.preventDefault(); }} onInteractOutside={e => { if (running) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Abgleich All {done ? '· Ergebnis' : ''}</DialogTitle></DialogHeader>
        <div className="text-sm space-y-2">
          <p><strong>{snapshot?.products.length} Geräte</strong> · alle gespeicherten Geräte, unabhängig von der aktuellen Suche.</p>
          <p>Webseiten: {snapshot?.sites.map(s => s.name).join(', ')}</p>
          {!done && <p className="text-muted-foreground">Alle Geräte für diese aktiven Webseiten freigeben? COM erhält nur Geräte mit bestätigter Zuordnung. Preise und regulatorische Freigaben bleiben unverändert.</p>}
          {!done && <p className="text-muted-foreground">Andere Webseiten erhalten die Freigabe zum Abruf; ihre tatsächliche Annahme kann hier nicht bestätigt werden.</p>}
          {(running || done) && <><Progress value={total ? completed / total * 100 : 0} /><p>{completed} / {total} abgeschlossen</p></>}
          {done && <p>{results.filter(r => r.state === 'accepted').length} bestätigt · {results.filter(r => r.state === 'available').length} zum Abruf bereit · {results.filter(r => r.state === 'skipped').length} übersprungen · {results.filter(r => r.state === 'error').length} Fehler</p>}
        </div>
        {results.length > 0 && <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {results.map(r => <div key={`${r.productId}-${r.site}`} className="py-2 text-sm">
            <div className="font-medium flex items-center gap-2">{r.state === 'accepted' && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}{r.product} · {r.site}</div>
            <p className={r.state === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{r.note}</p>
          </div>)}
        </div>}
        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={() => setOpen(false)}>{done ? 'Schließen' : 'Abbrechen'}</Button>
          {!done && <Button className="bg-success text-success-foreground hover:bg-success/90" disabled={running} onClick={run}>
            {running && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{running ? 'Abgleich läuft…' : 'Alle freigeben & senden'}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}