import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PH_CHANNELS } from '@/lib/producthub/config';

const db = supabase as any;

export default function ProductHubSyncHealth() {
  const [logs, setLogs] = useState<any[]>([]);
  const [chan, setChan] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [l, c] = await Promise.all([
        db.from('ph_sync_log').select('*').order('created_at', { ascending: false }).limit(100),
        db.from('ph_product_channels').select('*'),
      ]);
      setLogs(l.data || []); setChan(c.data || []);
    })();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Sync Health" subtitle="Status der Verbindungen zu den Webseiten" icon={Activity} />
      <div className="grid md:grid-cols-5 gap-3">
        {PH_CHANNELS.map(ch => {
          const rows = chan.filter(c => c.channel_code === ch.code);
          const err = rows.filter(r => r.last_sync_status === 'error').length;
          const last = rows.map(r => r.last_sync_at).filter(Boolean).sort().pop();
          return (
            <Card key={ch.code}><CardHeader className="pb-2"><CardTitle className="text-sm">{ch.label}</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <div>Produkte verknüpft: <b>{rows.length}</b></div>
                <div>Veröffentlicht: <b>{rows.filter(r => r.status === 'published').length}</b></div>
                <div>Offene Änderungen: <b>{rows.filter(r => r.has_pending_changes).length}</b></div>
                <div>Fehler: <b className={err ? 'text-destructive' : ''}>{err}</b></div>
                <div className="text-muted-foreground">Letzter Sync: {last ? new Date(last).toLocaleString('de-DE') : '—'}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Zeit</TableHead><TableHead>Kanal</TableHead><TableHead>Richtung</TableHead><TableHead>Vorgang</TableHead><TableHead>Status</TableHead><TableHead>Meldung</TableHead></TableRow></TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Sync-Vorgänge.</TableCell></TableRow>}
            {logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell className="text-xs">{l.channel_code || '—'}</TableCell>
                <TableCell className="text-xs">{l.direction}</TableCell>
                <TableCell className="text-xs">{l.operation || '—'}</TableCell>
                <TableCell><Badge variant="outline" className={l.status === 'error' ? 'border-destructive text-destructive' : 'border-emerald-500/40 text-emerald-500'}>{l.status}</Badge></TableCell>
                <TableCell className="text-xs max-w-[400px] truncate">{l.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
