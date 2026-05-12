import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Package } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface LagerDevice {
  id: string;
  serial_number: string;
  model_name: string;
  entry_date: string;
  notes: string | null;
  reservation_week: string | null;
  reserved_order_id: string | null;
  orders?: { order_number: string | null } | null;
}

function getStatusFromNotes(notes: string | null | undefined): string {
  const m = /\[Status:\s*([^\]]+)\]/.exec(notes ?? '');
  return m?.[1]?.trim() ?? '';
}

function getTypeFromNotes(notes: string | null | undefined): string {
  return (notes ?? '').includes('[Typ: Leihgerät]') || (notes ?? '').includes('[Leihgerät]')
    ? 'Leihgerät'
    : 'Neugerät';
}

function cleanNotes(notes: string | null | undefined): string {
  return (notes ?? '')
    .replace(/\[Status:\s*[^\]]+\]/g, '')
    .replace(/\[Typ:\s*(Neugerät|Leihgerät)\]/g, '')
    .replace(/\[Leihgerät\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function EquipmentHold() {
  const [devices, setDevices] = useState<LagerDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('lager_devices')
        .select('id, serial_number, model_name, entry_date, notes, reservation_week, reserved_order_id')
        .order('updated_at', { ascending: false });
      if (error || !data) {
        setLoading(false);
        return;
      }
      const prodDevices = (data as LagerDevice[]).filter((d) => {
        const s = getStatusFromNotes(d.notes).toLowerCase();
        return s === 'hold' || s === 'sperre boss';
      });
      const orderIds = Array.from(
        new Set(prodDevices.map((d) => d.reserved_order_id).filter(Boolean) as string[]),
      );
      const orderMap: Record<string, string> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number')
          .in('id', orderIds);
        for (const o of (orders ?? []) as { id: string; order_number: string | null }[]) {
          if (o.order_number) orderMap[o.id] = o.order_number;
        }
      }
      setDevices(
        prodDevices.map((d) => ({
          ...d,
          orders: d.reserved_order_id && orderMap[d.reserved_order_id]
            ? { order_number: orderMap[d.reserved_order_id] }
            : null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return devices;
    return devices.filter((d) =>
      `${d.serial_number ?? ''} ${d.model_name ?? ''} ${d.notes ?? ''} ${d.orders?.order_number ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [devices, search]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <PageHeader
        icon={<AlertTriangle className="w-6 h-6 text-primary" />}
        title="Hold"
        subtitle={'Lagergeräte mit Status „Hold"'}
      />

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Suche nach Serien-Nr., Modell, Auftrag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Badge variant="outline" className="bg-orange-500/15 text-orange-500 border-orange-500/40">
          {devices.length} in Hold
        </Badge>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Keine Geräte aktuell in Hold.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serien-Nr.</TableHead>
                <TableHead>Modell</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reservierter Auftrag</TableHead>
                <TableHead>KW</TableHead>
                <TableHead>Eingang</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.serial_number}</TableCell>
                  <TableCell>{d.model_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeFromNotes(d.notes)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/40">
                      Hold
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.orders?.order_number ? (
                      <span className="font-mono text-xs flex items-center gap-1">
                        <Package className="w-3 h-3" /> {d.orders.order_number}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{d.reservation_week || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {d.entry_date ? format(new Date(d.entry_date), 'dd.MM.yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {cleanNotes(d.notes) || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
