import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

export default function CustomerPortalWarranty() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('warranty_records')
        .select('id, serial_number, device_name, warranty_start, warranty_end, warranty_type, warranty_status')
        .eq('customer_id', ctx.customerId)
        .order('warranty_end', { ascending: true, nullsFirst: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  const variant = (s: string | null) => {
    if (!s) return 'outline';
    if (s.toLowerCase().includes('abgelaufen')) return 'destructive';
    if (s.toLowerCase().includes('läuft')) return 'secondary';
    return 'default';
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Meine Garantien</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Keine Garantien hinterlegt.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gerät</TableHead>
                  <TableHead>Seriennummer</TableHead>
                  <TableHead>Beginn</TableHead>
                  <TableHead>Ende</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.device_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{r.serial_number ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.warranty_start ? new Date(r.warranty_start).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell className="text-xs">{r.warranty_end ? new Date(r.warranty_end).toLocaleDateString('de-DE') : '—'}</TableCell>
                    <TableCell><Badge variant="outline">{r.warranty_type ?? '—'}</Badge></TableCell>
                    <TableCell><Badge variant={variant(r.warranty_status) as any}>{r.warranty_status ?? '—'}</Badge></TableCell>
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
