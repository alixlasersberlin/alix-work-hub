import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wrench, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

export default function CustomerPortalMaintenance() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('device_maintenance')
        .select('id, serial_number, device_name, last_maintenance_date, next_maintenance_date, maintenance_status, notes')
        .eq('customer_id', ctx.customerId)
        .order('next_maintenance_date', { ascending: true, nullsFirst: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const statusVariant = (s: string | null) => {
    if (!s) return 'outline';
    if (s.toLowerCase().includes('überfällig')) return 'destructive';
    if (s.toLowerCase().includes('abgeschlossen')) return 'default';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5" /> Meine Wartungen</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Keine Wartungen geplant.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gerät</TableHead>
                  <TableHead>Seriennummer</TableHead>
                  <TableHead>Letzte Wartung</TableHead>
                  <TableHead>Nächste Wartung</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.device_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.serial_number ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.last_maintenance_date ? new Date(r.last_maintenance_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell className="text-xs">{r.next_maintenance_date ? new Date(r.next_maintenance_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.maintenance_status) as any}>{r.maintenance_status ?? 'Geplant'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
