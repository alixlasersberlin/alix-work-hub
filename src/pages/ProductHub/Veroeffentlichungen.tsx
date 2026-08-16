import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Eye, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { phLabel } from '@/lib/producthub/config';

const db = supabase as any;

const STATUSES = ['draft', 'review', 'approved', 'publishing', 'published', 'failed'] as const;
const NEXT: Record<string, string> = { draft: 'review', review: 'approved', approved: 'publishing', publishing: 'published' };
const badgeCls = (s: string) =>
  s === 'published' ? 'bg-emerald-500' : s === 'failed' ? 'bg-destructive'
    : s === 'approved' ? 'bg-sky-500' : s === 'publishing' ? 'bg-amber-500' : '';

const val = (v: any) => v === null || v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v, null, 2);

export default function ProductHubVeroeffentlichungen() {
  const { user, roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [rows, setRows] = useState<any[]>([]);
  const [rollbacks, setRollbacks] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<any>(null);

  const load = async () => {
    const [{ data }, { data: rb }] = await Promise.all([
      db.from('ph_publish_queue').select('*, ph_products(name, slug)').order('created_at', { ascending: false }).limit(500),
      db.from('ph_publish_rollbacks').select('*, ph_products(name)').order('created_at', { ascending: false }).limit(100),
    ]);
    setRows(data || []); setRollbacks(rb || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r =>
    (status === 'all' || r.status === status) &&
    (!q || `${r.ph_products?.name} ${r.field_key} ${r.channel_code}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, status, q]);

  const advance = async (r: any) => {
    const next = NEXT[r.status];
    if (!next) return;
    const patch: any = { status: next };
    if (next === 'approved') { patch.approved_by = user?.id ?? null; patch.approved_at = new Date().toISOString(); }
    if (next === 'published') {
      patch.published_at = new Date().toISOString();
      await db.from('ph_publish_rollbacks').insert({
        queue_id: r.id, product_id: r.product_id, channel_code: r.channel_code,
        field_key: r.field_key, previous_value: r.old_value, restored_value: null,
        action: 'snapshot', performed_by: user?.id ?? null,
      });
    }
    const { error } = await db.from('ph_publish_queue').update(patch).eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${next}`);
    load();
  };

  const rollback = async (r: any) => {
    const { error } = await db.from('ph_publish_rollbacks').insert({
      queue_id: r.id, product_id: r.product_id, channel_code: r.channel_code, field_key: r.field_key,
      previous_value: r.new_value, restored_value: r.old_value, action: 'rollback', performed_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    await db.from('ph_publish_queue').update({ status: 'draft', published_at: null, notes: 'Rollback ausgeführt' }).eq('id', r.id);
    toast.success('Rollback dokumentiert – vorheriger Wert wiederhergestellt');
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Veröffentlichungen" subtitle="Publish Queue mit Vorschau, Freigabe und Rollback – kein Blind-Publishing" icon={Send} />

      <Card><CardContent className="p-3 flex flex-wrap gap-2 items-center">
        <Input className="max-w-xs" placeholder="Suche Gerät / Feld / Kanal…" value={q} onChange={e => setQ(e.target.value)} />
        <Badge variant={status === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setStatus('all')}>alle</Badge>
        {STATUSES.map(s => (
          <Badge key={s} variant={status === s ? 'default' : 'outline'} className="cursor-pointer uppercase" onClick={() => setStatus(s)}>{s}</Badge>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          Phase B: Änderungen werden gesammelt, aber noch nicht an die Webseiten übertragen.
        </span>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Gerät</TableHead><TableHead>Feld</TableHead><TableHead>Kanal</TableHead>
            <TableHead>alter Live-Wert</TableHead><TableHead>neuer Master-Wert</TableHead>
            <TableHead>Status</TableHead><TableHead>Freigabe</TableHead><TableHead>Zeitpunkt</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Keine Änderungen in der Warteschlange.</TableCell></TableRow>}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.ph_products?.name}</TableCell>
                <TableCell className="text-xs">{phLabel(r.field_key)}</TableCell>
                <TableCell><Badge variant="outline" className="uppercase">{r.channel_code}</Badge></TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{val(r.old_value)}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{val(r.new_value)}</TableCell>
                <TableCell><Badge className={badgeCls(r.status)} variant={badgeCls(r.status) ? 'default' : 'outline'}>{r.status.toUpperCase()}</Badge></TableCell>
                <TableCell className="text-xs">{r.approved_at ? new Date(r.approved_at).toLocaleString('de-DE') : '—'}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(r)}><Eye className="h-4 w-4" /></Button>
                  {canWrite && NEXT[r.status] && <Button size="sm" variant="outline" className="ml-1" onClick={() => advance(r)}>{NEXT[r.status].toUpperCase()}</Button>}
                  {canWrite && r.status === 'published' && <Button size="sm" variant="ghost" className="ml-1" onClick={() => rollback(r)}><Undo2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card><CardContent className="p-0 overflow-x-auto">
        <div className="p-3 text-sm font-medium">Rollback-Verlauf (Audit)</div>
        <Table>
          <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Gerät</TableHead><TableHead>Feld</TableHead><TableHead>Kanal</TableHead><TableHead>Aktion</TableHead><TableHead>vorheriger Wert</TableHead></TableRow></TableHeader>
          <TableBody>
            {rollbacks.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Noch keine Einträge.</TableCell></TableRow>}
            {rollbacks.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell className="text-xs">{r.ph_products?.name}</TableCell>
                <TableCell className="text-xs">{phLabel(r.field_key)}</TableCell>
                <TableCell className="text-xs uppercase">{r.channel_code}</TableCell>
                <TableCell className="text-xs">{r.action}</TableCell>
                <TableCell className="text-xs max-w-[360px] truncate">{val(r.previous_value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Vorschau · {preview?.ph_products?.name} · {phLabel(preview?.field_key || '')}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Aktueller Live-Wert ({preview.channel_code.toUpperCase()})</div>
                  <pre className="text-xs bg-muted p-2 rounded max-h-64 overflow-auto whitespace-pre-wrap">{val(preview.old_value)}</pre>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Neuer Master-Wert</div>
                  <pre className="text-xs bg-muted p-2 rounded max-h-64 overflow-auto whitespace-pre-wrap">{val(preview.new_value)}</pre>
                </div>
              </div>
              {preview.ph_products?.slug && (
                <a className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer"
                   href={`https://alix-lasers.${preview.channel_code === 'com' ? 'com' : 'de'}/produkte/${preview.ph_products.slug}`}>
                  Live-Vorschau der Produktseite öffnen
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
