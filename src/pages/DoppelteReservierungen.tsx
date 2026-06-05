import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, ExternalLink, X } from 'lucide-react';
import { PageHeader, PageLoading, PageEmpty, PageError } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { withAt } from '@/lib/atSuffix';
import { SourceBadge } from '@/lib/source-system';

type DeviceRow = {
  id: string;
  serial_number: string;
  model_name: string;
  notes: string | null;
  reserved_order_id: string;
};

type OrderInfo = {
  id: string;
  order_number: string;
  order_status: string | null;
  source_system: string;
  customer_id: string;
  customers?: { company_name: string | null; contact_name: string | null } | null;
};

type Group = {
  order: OrderInfo;
  devices: DeviceRow[];
};

export default function DoppelteReservierungen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [releasing, setReleasing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: devices, error: devErr } = await supabase
        .from('lager_devices')
        .select('id, serial_number, model_name, notes, reserved_order_id')
        .not('reserved_order_id', 'is', null);
      if (devErr) throw devErr;

      const isLeih = (notes: string | null) =>
        /\[Typ:\s*Leihgerät\]|\[Leihgerät\]/.test(notes ?? '');

      const byOrder = new Map<string, DeviceRow[]>();
      for (const d of (devices ?? []) as DeviceRow[]) {
        // Leihgeräte sind nur temporär verliehen — nicht als doppelte Reservierung zählen
        if (isLeih(d.notes)) continue;
        const arr = byOrder.get(d.reserved_order_id) ?? [];
        arr.push(d);
        byOrder.set(d.reserved_order_id, arr);
      }
      const dupOrderIds = Array.from(byOrder.entries())
        .filter(([, list]) => list.length > 1)
        .map(([id]) => id);

      if (dupOrderIds.length === 0) {
        setGroups([]);
        return;
      }

      const { data: orders, error: ordErr } = await supabase
        .from('orders')
        .select('id, order_number, order_status, source_system, customer_id, customers(company_name, contact_name)')
        .in('id', dupOrderIds);
      if (ordErr) throw ordErr;

      const ordersMap = new Map((orders ?? []).map((o: any) => [o.id, o as OrderInfo]));
      const result: Group[] = dupOrderIds
        .map((id) => {
          const o = ordersMap.get(id);
          if (!o) return null;
          return { order: o, devices: byOrder.get(id)! };
        })
        .filter(Boolean) as Group[];

      // Sort by device count desc
      result.sort((a, b) => b.devices.length - a.devices.length);
      setGroups(result);
    } catch (e: any) {
      setError(e?.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalDevices = useMemo(
    () => groups.reduce((sum, g) => sum + g.devices.length, 0),
    [groups],
  );

  const releaseDevice = async (deviceId: string) => {
    if (!confirm('Reservierung dieses Geräts wirklich aufheben?')) return;
    setReleasing(deviceId);
    try {
      const { error } = await supabase
        .from('lager_devices')
        .update({ reserved_order_id: null, reservation_week: null })
        .eq('id', deviceId);
      if (error) throw error;
      toast.success('Reservierung aufgehoben');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler beim Aufheben');
    } finally {
      setReleasing(null);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
        title="Doppelte Reservierungen"
        subtitle={
          loading
            ? 'wird geladen…'
            : `${groups.length} Auftrag${groups.length === 1 ? '' : 'e'} mit mehrfacher Reservierung · ${totalDevices} Geräte gesamt`
        }
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Neu laden'}
          </Button>
        }
      />

      {loading && <PageLoading />}
      {!loading && error && <PageError message={error} onRetry={load} />}
      {!loading && !error && groups.length === 0 && (
        <PageEmpty message="Keine doppelten Reservierungen gefunden." />
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="space-y-5">
          {groups.map((g) => {
            const customer =
              g.order.customers?.company_name?.trim() ||
              g.order.customers?.contact_name?.trim() ||
              '—';
            return (
              <div
                key={g.order.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/auftraege/${g.order.id}`}
                        className="font-display font-semibold text-foreground hover:underline inline-flex items-center gap-1.5"
                      >
                        {withAt(g.order.order_number, g.order.source_system)}
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </Link>
                      <SourceBadge source={g.order.source_system} />
                      {g.order.order_status && (
                        <Badge variant="outline" className="text-xs">
                          {g.order.order_status}
                        </Badge>
                      )}
                      <Badge variant="destructive" className="text-xs">
                        {g.devices.length} Geräte
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{customer}</p>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {g.devices.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {d.model_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          SN: {d.serial_number}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => releaseDevice(d.id)}
                        disabled={releasing === d.id}
                        className="text-destructive hover:text-destructive flex-shrink-0"
                      >
                        {releasing === d.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            Reservierung aufheben
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
