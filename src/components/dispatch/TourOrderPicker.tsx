import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Search, Loader2, Plus, Trash2, PackageCheck, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { fetchApproval, isReleased, missingStages } from '@/lib/delivery-approval/api';

export type PickedItem = {
  key: string;
  description: string;
  quantity: number;
  serial_number: string;
  include: boolean;
};

export type PickedOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  customer_id: string | null;
};

function addrPart(addr: any, keys: string[]) {
  if (!addr || typeof addr !== 'object') return '';
  for (const k of keys) if (addr[k]) return String(addr[k]);
  return '';
}

export function TourOrderPicker({
  order, setOrder, items, setItems, partial, setPartial,
}: {
  order: PickedOrder | null;
  setOrder: (o: PickedOrder | null) => void;
  items: PickedItem[];
  setItems: (i: PickedItem[]) => void;
  partial: boolean;
  setPartial: (v: boolean) => void;
}) {
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, string[]>>({});
  const [release, setRelease] = useState<{ released: boolean; missing: string[] } | null>(null);

  async function search() {
    const q = term.trim();
    if (q.length < 2) { toast.error('Bitte mindestens 2 Zeichen eingeben'); return; }
    setSearching(true);
    try {
      const sel = 'id, order_number, customer_id, total_amount, currency, order_date, shipping_address, billing_address, customers:customer_id(company_name, contact_name, email, phone, shipping_address, billing_address)';
      const [byNumber, byCustomer] = await Promise.all([
        supabase.from('orders').select(sel).ilike('order_number', `%${q}%`).limit(25),
        supabase.from('customers').select('id').or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%`).limit(25),
      ]);
      if (byNumber.error) throw byNumber.error;
      let rows = byNumber.data ?? [];
      const custIds = (byCustomer.data ?? []).map((c: any) => c.id);
      if (custIds.length) {
        const { data: byName } = await supabase.from('orders').select(sel).in('customer_id', custIds).limit(50);
        const seen = new Set(rows.map((r: any) => r.id));
        rows = [...rows, ...(byName ?? []).filter((r: any) => !seen.has(r.id))];
      }
      setResults(rows);
      const ids = rows.map((r: any) => r.id);
      if (ids.length) {
        const { data: oi } = await supabase
          .from('order_items')
          .select('order_id, item_name, sku, quantity')
          .in('order_id', ids)
          .limit(1000);
        const map: Record<string, string[]> = {};
        (oi ?? []).forEach((it: any) => {
          if (!it.order_id) return;
          (map[it.order_id] ||= []).push(`${Number(it.quantity ?? 1)}× ${it.item_name || it.sku || 'Position'}`);
        });
        setItemsByOrder(map);
      } else {
        setItemsByOrder({});
      }
      if (!rows.length) toast.info('Kein Auftrag gefunden');
    } catch (e: any) {
      toast.error(e.message ?? 'Suche fehlgeschlagen');
    } finally {
      setSearching(false);
    }
  }

  function fmtMoney(v: any, cur?: string) {
    const n = Number(v);
    if (!v || Number.isNaN(n)) return null;
    return n.toLocaleString('de-DE', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 });
  }

  function rowAddress(r: any) {
    const c = r.customers ?? {};
    const ship = r.shipping_address ?? c.shipping_address ?? c.billing_address ?? r.billing_address;
    return [
      addrPart(ship, ['street', 'address', 'address1', 'street1']),
      `${addrPart(ship, ['zip', 'zipcode', 'postal_code', 'zip_code'])} ${addrPart(ship, ['city', 'town'])}`.trim(),
      addrPart(ship, ['country']),
    ].filter(Boolean).join(', ');
  }


  async function choose(row: any) {
    const c = row.customers ?? {};
    const ship = row.shipping_address ?? c.shipping_address ?? c.billing_address ?? row.billing_address;
    const picked: PickedOrder = {
      id: row.id,
      order_number: row.order_number,
      customer_name: c.company_name || c.contact_name || '',
      company_name: c.company_name || '',
      contact_name: c.contact_name || '',
      contact_email: c.email || '',
      contact_phone: c.phone || '',
      street: addrPart(ship, ['street', 'address', 'address1', 'street1']),
      zip: addrPart(ship, ['zip', 'zipcode', 'postal_code', 'zip_code']),
      city: addrPart(ship, ['city', 'town']),
      country: addrPart(ship, ['country']),
      customer_id: row.customer_id ?? null,
    };
    setOrder(picked);
    setResults([]);
    setRelease(null);
    try {
      const a = await fetchApproval(row.id);
      setRelease({ released: isReleased(a), missing: missingStages(a) });
    } catch { /* Freigabestatus optional */ }
    const { data: oi } = await supabase
      .from('order_items')
      .select('id, item_name, description, quantity, sku')
      .eq('order_id', row.id)
      .order('item_order', { ascending: true });
    setItems(
      (oi ?? []).map((it: any, i: number) => ({
        key: it.id ?? `i${i}`,
        description: it.item_name || it.description || it.sku || 'Position',
        quantity: Number(it.quantity ?? 1),
        serial_number: '',
        include: true,
      })),
    );
  }

  function patch(key: string, p: Partial<PickedItem>) {
    setItems(items.map((it) => (it.key === key ? { ...it, ...p } : it)));
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <PackageCheck className="h-4 w-4 text-primary" />Auftrag suchen &amp; übernehmen
      </div>
      <div className="flex gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          placeholder="Auftragsnummer oder Name…"
        />
        <Button type="button" variant="outline" onClick={search} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-1">
          {results.map((r) => {
            const arts = itemsByOrder[r.id] ?? [];
            const money = fmtMoney(r.total_amount, r.currency);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => choose(r)}
                className="w-full rounded px-2 py-2 text-left text-xs hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.order_number}</span>
                  <span className="text-muted-foreground truncate">{r.customers?.company_name || r.customers?.contact_name || '—'}</span>
                  {money && <span className="ml-auto shrink-0 font-medium text-primary">{money}</span>}
                </div>
                <div className="text-muted-foreground truncate">
                  {rowAddress(r) || 'Keine Lieferadresse'}
                  {r.order_date ? ` · ${new Date(r.order_date).toLocaleDateString('de-DE')}` : ''}
                </div>
                {arts.length > 0 && (
                  <div className="text-muted-foreground/80 truncate">
                    {arts.slice(0, 3).join(' · ')}{arts.length > 3 ? ` · +${arts.length - 3} weitere` : ''}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}


      {order && (
        <div className="mt-3 space-y-3">
          <div className="rounded-md bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-2 font-medium">
              {order.order_number}
              <Badge variant="secondary">{order.company_name || order.contact_name || '—'}</Badge>
              <Button type="button" size="sm" variant="ghost" className="ml-auto h-6" onClick={() => { setOrder(null); setItems([]); setRelease(null); }}>
                entfernen
              </Button>
            </div>
            <div className="text-muted-foreground">{[order.street, `${order.zip} ${order.city}`.trim(), order.country].filter(Boolean).join(', ') || 'Keine Lieferadresse hinterlegt'}</div>
            <div className="text-muted-foreground">{order.contact_email || 'Keine E-Mail hinterlegt'}</div>
          </div>

          {release && (
            release.released ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />Auslieferung vollständig freigegeben
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Keine vollständige Auslieferungsfreigabe. Fehlend: {release.missing.join(', ')}.
                </span>
              </div>
            )
          )}

          <div className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
            <Label className="text-xs">Teillieferung</Label>
            <Switch checked={partial} onCheckedChange={setPartial} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Artikelliste</Label>
              <Button
                type="button" size="sm" variant="outline" className="h-7"
                onClick={() => setItems([...items, { key: `new-${Date.now()}`, description: '', quantity: 1, serial_number: '', include: true }])}
              >
                <Plus className="mr-1 h-3 w-3" />Position
              </Button>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {items.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Keine Positionen im Auftrag.</p>}
              {items.map((it) => (
                <div key={it.key} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={it.include}
                    onChange={(e) => patch(it.key, { include: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                    title="Mitliefern"
                  />
                  <Input className="h-8 flex-1 text-xs" value={it.description} onChange={(e) => patch(it.key, { description: e.target.value })} placeholder="Bezeichnung" />
                  <Input className="h-8 w-16 text-xs" type="number" min={0} step="1" value={it.quantity} onChange={(e) => patch(it.key, { quantity: Number(e.target.value) })} />
                  <Input className="h-8 w-28 text-xs" value={it.serial_number} onChange={(e) => patch(it.key, { serial_number: e.target.value })} placeholder="Seriennr." />
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setItems(items.filter((x) => x.key !== it.key))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
