import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

type Order = {
  id: string;
  order_number: string;
  order_status: string | null;
  customers?: { company_name: string | null; contact_name: string | null } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (order: Order) => void;
  filterModel?: string | null;
};

export default function OrderPickerDialog({ open, onOpenChange, onSelect, filterModel }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFallback(false);
    (async () => {
      let orderIds: string[] | null = null;
      const model = filterModel?.trim();
      if (model) {
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id')
          .ilike('item_name', `%${model}%`)
          .limit(2000);
        orderIds = Array.from(new Set((items ?? []).map((i: any) => i.order_id).filter(Boolean)));
        if (orderIds.length === 0) {
          orderIds = null;
          setFallback(true);
        }
      }
      let q = supabase
        .from('orders')
        .select('id, order_number, order_status, customers(company_name, contact_name)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (orderIds) q = q.in('id', orderIds);
      const { data } = await q;
      const list = (data ?? []) as Order[];
      setOrders(list);

      const ids = list.map((o) => o.id);
      if (ids.length > 0) {
        const { data: itemRows } = await supabase
          .from('order_items')
          .select('order_id, item_name, sku')
          .in('order_id', ids)
          .limit(5000);
        const map: Record<string, string[]> = {};
        (itemRows ?? []).forEach((r: any) => {
          if (!r.order_id) return;
          (map[r.order_id] ||= []).push([r.item_name, r.sku].filter(Boolean).join(' '));
        });
        const joined: Record<string, string> = {};
        Object.keys(map).forEach((k) => (joined[k] = map[k].join(' ').toLowerCase()));
        setItemsByOrder(joined);
      } else {
        setItemsByOrder({});
      }
      setLoading(false);
    })();
  }, [open, filterModel]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_number?.toLowerCase().includes(q) ||
        o.customers?.company_name?.toLowerCase().includes(q) ||
        o.customers?.contact_name?.toLowerCase().includes(q) ||
        itemsByOrder[o.id]?.includes(q),
    );
  }, [orders, search, itemsByOrder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Auftrag auswählen</DialogTitle>
          <DialogDescription>
            {filterModel
              ? fallback
                ? `Keine Aufträge mit Modell „${filterModel}" gefunden – alle Aufträge werden angezeigt.`
                : `Nur Aufträge mit Modell „${filterModel}".`
              : 'Suche und wähle einen Auftrag aus dem Verkauf.'}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Auftragsnummer oder Kunde…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="max-h-96 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {loading ? (
            <div className="p-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Keine Aufträge gefunden.</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onSelect(o);
                  onOpenChange(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.customers?.company_name || o.customers?.contact_name || '—'}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{o.order_status || '—'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
