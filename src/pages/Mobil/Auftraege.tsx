import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2, Search, Navigation, Phone, User } from 'lucide-react';
import { formatAddress, mapsHref, telHref, cacheGet, cacheSet } from '@/lib/mobil/utils';

export default function MobilAuftraege() {
  const [rows, setRows] = useState<any[]>(cacheGet<any[]>('orders') ?? []);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, shipping_address, billing_address, customer_id, customers:customer_id(company_name, contact_name, phone)')
        .order('order_date', { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (error) setError('Keine Verbindung – gespeicherte Daten werden angezeigt.');
      else { setRows(data ?? []); cacheSet('orders', data ?? []); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.order_number, r.customers?.company_name, r.customers?.contact_name, r.order_status]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(s)),
    );
  }, [rows, q]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Aufträge</h1>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag oder Kunde…" className="pl-9 h-12 text-base" />
      </div>

      {error && <Card className="p-3 text-xs text-amber-500">{error}</Card>}
      {loading && <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {!loading && list.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Keine Aufträge gefunden.</Card>}

      {list.map((r) => {
        const address = formatAddress(r.shipping_address) || formatAddress(r.billing_address);
        const tel = telHref(r.customers?.phone);
        return (
          <Card key={r.id} className="p-4 space-y-3">
            <div>
              <div className="text-base font-bold">{r.customers?.company_name || r.customers?.contact_name || '—'}</div>
              {address && <div className="text-sm">{address}</div>}
              <div className="text-sm text-muted-foreground mt-1">Auftrag: {r.order_number}</div>
              {r.order_status && <div className="text-sm text-muted-foreground">Status: {r.order_status}</div>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button asChild className="h-12" disabled={!address}>
                <a href={address ? mapsHref(address) : undefined}><Navigation className="w-4 h-4" /></a>
              </Button>
              <Button asChild variant="outline" className="h-12" disabled={!tel}>
                <a href={tel}><Phone className="w-4 h-4" /></a>
              </Button>
              <Button asChild variant="outline" className="h-12" disabled={!r.customer_id}>
                <Link to={r.customer_id ? `/customers/${r.customer_id}` : '#'}><User className="w-4 h-4" /></Link>
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
