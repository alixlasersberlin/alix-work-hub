import { useRef, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { phUpdateProduct, phUpsertChannel } from '@/lib/producthub/api';
import { releaseSingleProduct } from '@/lib/producthub/webRelease';
import type { BulkMapping, BulkResult } from '@/lib/producthub/bulkPublish';
import type { PhChannel } from '@/lib/producthub/useChannels';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { pushGlobalProduct } from '@/lib/producthub/globalRelease';

export function WebReleaseButton({ product, sites, activeCodes, onDone }: {
  product: { id: string; name: string }; sites: PhChannel[]; activeCodes: string[]; onDone: () => void | Promise<void>;
}) {
  const { roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);
  const lock = useRef(false);
  const targets = sites.filter(site => site.is_active && !['us', 'usa'].includes(site.code));
  if (!roles.includes('Super Admin')) return null;

  const run = async () => {
    if (lock.current) return;
    lock.current = true; setRunning(true);
    try {
      const { data: allowed, error: roleError } = await supabase.rpc('has_role', { check_role: 'Super Admin' });
      if (roleError || !allowed) throw new Error('Nur der Super Admin darf Geräte für Webseiten freigeben');
      const { data, error } = await supabase.from('ph_lang_sync_map').select('product_id,site_code,remote_product_id,verified_at').eq('product_id', product.id);
      if (error) throw error;
      await releaseSingleProduct(product, targets.map(site => ({ code: site.code, name: site.label, is_active: site.is_active })), selected,
        (data || []) as BulkMapping[], {
          updateProduct: phUpdateProduct, updateChannel: phUpsertChannel,
          pushGlobal: async (id, channel) => { await pushGlobalProduct(id, channel); },
        }, (_count, result) => setResults(previous => [...previous, result]));
      setDone(true); await onDone();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'WEB Freigabe fehlgeschlagen'); }
    finally { lock.current = false; setRunning(false); }
  };

  return <>
    <Button size="sm" variant="outline" className="shrink-0" onClick={event => {
      event.stopPropagation(); setSelected(activeCodes.filter(code => targets.some(site => site.code === code)));
      setResults([]); setDone(false); setOpen(true);
    }}><Globe className="mr-1.5 h-4 w-4" />WEB Freigabe</Button>
    <Dialog open={open} onOpenChange={value => { if (!running) setOpen(value); }}>
      <DialogContent className="max-w-xl" onClick={event => event.stopPropagation()}
        onEscapeKeyDown={event => { if (running) event.preventDefault(); }} onInteractOutside={event => { if (running) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>WEB Freigabe · {product.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!done && <div className="grid gap-3 sm:grid-cols-2">{targets.map(site => <label key={site.code} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(site.code)} disabled={running} onCheckedChange={value => setSelected(previous => value === true ? [...previous, site.code] : previous.filter(code => code !== site.code))} />
            <span className="break-words">{site.label}</span>
          </label>)}</div>}
          <p className="text-sm text-muted-foreground">Freigabe ausschließlich durch AlixWork · keine weitere manuelle Webseitenfreigabe. COM und DE: direkte GLOBAL-Veröffentlichung. AT/AE/Beauty: zum automatischen Abruf bereit. US bleibt ausgenommen.</p>
          <div className="max-h-64 overflow-y-auto divide-y divide-border" aria-live="polite">{results.map(result => <div key={result.site} className="py-2 text-sm">
            <p className="font-medium">{result.site}</p>
            <p className={result.state === 'error' || result.state === 'skipped' ? 'text-destructive' : 'text-muted-foreground'}>{result.note}</p>
          </div>)}</div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={() => setOpen(false)}>{done ? 'Schließen' : 'Abbrechen'}</Button>
          {!done && <Button disabled={running || !selected.length} onClick={run}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}{running ? 'Freigabe läuft…' : 'Freigeben & senden'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}