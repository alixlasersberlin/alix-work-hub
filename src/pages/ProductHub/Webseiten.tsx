import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PH_CHANNELS, PH_ACTIVE_FIELD, phLabel, PH_CRITICAL_FIELDS } from '@/lib/producthub/config';
import { phUpsertChannel } from '@/lib/producthub/api';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;
const COMPARE_FIELDS = ['name', 'model', 'short_description', 'wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes', 'cooling', 'laser_class', 'mdr_status', 'ce_status', 'seo_title', 'seo_description'];

export default function ProductHubWebseiten() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [products, setProducts] = useState<any[]>([]);
  const [chan, setChan] = useState<any[]>([]);
  const [compare, setCompare] = useState<any | null>(null);

  const load = async () => {
    const [p, c] = await Promise.all([
      db.from('ph_products').select('*').order('name'),
      db.from('ph_product_channels').select('*'),
    ]);
    setProducts(p.data || []); setChan(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const row = (pid: string, code: string) => chan.find(c => c.product_id === pid && c.channel_code === code);

  const publish = async (p: any, code: string) => {
    await phUpsertChannel(p.id, code, {
      status: 'published', publish_state: 'published', has_pending_changes: false,
      last_sync_at: new Date().toISOString(), last_sync_status: 'ok',
    });
    await db.from('ph_sync_log').insert({ channel_code: code, direction: 'export', operation: 'publish', product_id: p.id, status: 'ok', message: `${p.name} für ${code.toUpperCase()} freigegeben` });
    toast.success('Veröffentlicht');
    load();
  };

  const diffs = useMemo(() => {
    if (!compare) return [];
    return PH_CHANNELS.filter(c => ['com', 'de'].includes(c.code)).flatMap(ch => {
      const r = row(compare.id, ch.code);
      const snap = r?.remote_snapshot || {};
      return COMPARE_FIELDS
        .filter(f => snap[f] !== undefined && String(snap[f] ?? '') !== String(compare[f] ?? ''))
        .map(f => ({ channel: ch.short, field: f, master: compare[f], remote: snap[f] }));
    });
  }, [compare, chan]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Webseiten" subtitle="Veröffentlichungskanäle COM / DE (später AT, USA, Dubai)" icon={Globe} />
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Gerät</TableHead>
            {PH_CHANNELS.map(c => <TableHead key={c.code}>{c.short}</TableHead>)}
            <TableHead>Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {products.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Produkte importiert.</TableCell></TableRow>}
            {products.map(p => (
              <TableRow key={p.id}>
                <TableCell><Link to={`/product-hub/geraete/${p.id}`} className="text-primary hover:underline">{p.name}</Link></TableCell>
                {PH_CHANNELS.map(c => {
                  const r = row(p.id, c.code);
                  return (
                    <TableCell key={c.code} className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className={p[PH_ACTIVE_FIELD[c.code]] ? 'border-emerald-500/40 text-emerald-500 w-fit' : 'w-fit'}>
                          {r?.status || (p[PH_ACTIVE_FIELD[c.code]] ? 'aktiv' : '—')}
                        </Badge>
                        {r?.last_sync_at && <span className="text-muted-foreground">{new Date(r.last_sync_at).toLocaleDateString('de-DE')}</span>}
                        {r?.has_pending_changes && <span className="text-sky-500">Änderungen</span>}
                        {r?.hold && <span className="text-amber-500">zurückgehalten</span>}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => setCompare(p)}>Vergleich</Button>
                  {canWrite && <>
                    <Button size="sm" variant="outline" onClick={() => publish(p, 'com')}>→ COM</Button>
                    <Button size="sm" variant="outline" onClick={() => publish(p, 'de')}>→ DE</Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!compare} onOpenChange={o => !o && setCompare(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Vergleich: ALIXWORK MASTER ↔ COM ↔ DE — {compare?.name}</DialogTitle></DialogHeader>
          {diffs.length === 0
            ? <div className="text-sm text-muted-foreground">Keine Abweichungen bekannt (noch kein Website-Snapshot importiert).</div>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Kanal</TableHead><TableHead>Feld</TableHead><TableHead>Master</TableHead><TableHead>Website</TableHead></TableRow></TableHeader>
                <TableBody>
                  {diffs.map((d, i) => (
                    <TableRow key={i} className={PH_CRITICAL_FIELDS.includes(d.field) ? 'bg-amber-500/5' : ''}>
                      <TableCell>{d.channel}</TableCell>
                      <TableCell className="text-xs">{phLabel(d.field)}</TableCell>
                      <TableCell className="text-xs text-emerald-500 max-w-[220px] truncate">{String(d.master ?? '—')}</TableCell>
                      <TableCell className="text-xs text-amber-500 max-w-[220px] truncate">{String(d.remote ?? '—')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
