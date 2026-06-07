import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Cpu, Loader2 } from 'lucide-react';

type Ctx = { customerId: string };

export default function CustomerPortalDevices() {
  const ctx = useOutletContext<Ctx>();
  const [rows, setRows] = useState<any[]>([]);
  const [warranty, setWarranty] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', ctx.customerId);
      const orderIds = (orders ?? []).map((o: any) => o.id);
      let devices: any[] = [];
      if (orderIds.length > 0) {
        const { data } = await supabase
          .from('lager_devices')
          .select('id, serial_number, model_name, commissioning_date, last_service_date, next_service_date, device_status, entry_date, reservation_week')
          .in('reserved_order_id', orderIds);
        devices = data ?? [];
      }
      const serials = devices.map((d) => d.serial_number).filter(Boolean);
      let wmap: Record<string, any> = {};
      if (serials.length > 0) {
        const { data: w } = await supabase
          .from('warranty_records')
          .select('serial_number, warranty_start, warranty_end, warranty_status, warranty_type')
          .in('serial_number', serials);
        (w ?? []).forEach((r: any) => { wmap[r.serial_number] = r; });
      }
      setWarranty(wmap);
      setRows(devices);
      setLoading(false);
    })();
  }, [ctx.customerId]);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" /> Meine Geräte</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Aktuell sind keine Geräte hinterlegt.</p>
        ) : (
          <div className="border border-border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modell</TableHead>
                  <TableHead>Seriennummer</TableHead>
                  <TableHead>Inbetriebnahme</TableHead>
                  <TableHead>Letzter Service</TableHead>
                  <TableHead>Garantie bis</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const w = warranty[d.serial_number];
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.model_name ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{d.serial_number ?? '—'}</TableCell>
                      <TableCell className="text-xs">{d.commissioning_date ? new Date(d.commissioning_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                      <TableCell className="text-xs">{d.last_service_date ? new Date(d.last_service_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {w?.warranty_end ? new Date(w.warranty_end).toLocaleDateString('de-DE') : '—'}
                        {w?.warranty_status && <Badge variant="outline" className="ml-2 text-[10px]">{w.warranty_status}</Badge>}
                      </TableCell>
                      <TableCell><Badge>{d.device_status ?? 'Aktiv'}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
