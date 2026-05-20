import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Loader2, Inbox, X, SearchCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageShell';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';

type Hit = {
  id: string;
  order_number: string;
  order_status: string | null;
  order_date: string | null;
  total_amount: number | null;
  currency: string | null;
  customer_name: string;
  customer_phone: string | null;
  city: string | null;
  zip: string | null;
  models: string[];
};

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('de-DE') : '—';
}

function addr(o: any) {
  const b = o?.billing_address || o?.customers?.billing_address || {};
  const s = o?.shipping_address || o?.customers?.shipping_address || {};
  return {
    zip: (b.zip || s.zip || '').toString(),
    city: (b.city || s.city || '').toString(),
  };
}

const EMPTY = { name: '', zip: '', city: '', orderNumber: '', phone: '', model: '' };

export default function Detailsuche() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const reset = () => { setForm({ ...EMPTY }); setHits(null); setError(null); };

  const runSearch = async () => {
    const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as typeof EMPTY;
    if (!Object.values(trimmed).some(Boolean)) {
      toast.error('Bitte mindestens ein Suchkriterium angeben');
      return;
    }
    setLoading(true); setError(null); setHits(null);

    try {
      // 1) Order-IDs aus production_orders via Modellname
      let modelOrderIds: Set<string> | null = null;
      if (trimmed.model) {
        const { data, error } = await supabase
          .from('production_orders')
          .select('order_id')
          .ilike('modellname', `%${trimmed.model}%`)
          .not('order_id', 'is', null)
          .limit(2000);
        if (error) throw error;
        modelOrderIds = new Set((data || []).map((r: any) => r.order_id).filter(Boolean));
        // zusätzlich via order_items.item_name
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id')
          .ilike('item_name', `%${trimmed.model}%`)
          .limit(2000);
        for (const it of (items || []) as any[]) if (it.order_id) modelOrderIds.add(it.order_id);
        if (modelOrderIds.size === 0) { setHits([]); setLoading(false); return; }
      }

      // 2) Kunden-IDs nach Name / Telefon
      let customerIds: Set<string> | null = null;
      if (trimmed.name || trimmed.phone) {
        let q = supabase.from('customers').select('id').limit(2000);
        if (trimmed.name) {
          q = q.or(`company_name.ilike.%${trimmed.name}%,contact_name.ilike.%${trimmed.name}%`);
        }
        if (trimmed.phone) {
          q = q.ilike('phone', `%${trimmed.phone}%`);
        }
        const { data, error } = await q;
        if (error) throw error;
        customerIds = new Set((data || []).map((r: any) => r.id));
        if (customerIds.size === 0) { setHits([]); setLoading(false); return; }
      }

      // 3) Orders laden
      let q = supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, total_amount, currency, billing_address, shipping_address, customers(id, company_name, contact_name, phone, billing_address, shipping_address)')
        .order('order_date', { ascending: false })
        .limit(500);

      if (trimmed.orderNumber) q = q.ilike('order_number', `%${trimmed.orderNumber}%`);
      if (customerIds) q = q.in('customer_id', Array.from(customerIds));
      if (modelOrderIds) q = q.in('id', Array.from(modelOrderIds));

      const { data: rows, error: oErr } = await q;
      if (oErr) throw oErr;

      // Client-side PLZ / Ort Filter (JSONB)
      let filtered = (rows || []) as any[];
      if (trimmed.zip) {
        const z = trimmed.zip.toLowerCase();
        filtered = filtered.filter(o => {
          const a = addr(o);
          return a.zip.toLowerCase().includes(z);
        });
      }
      if (trimmed.city) {
        const c = trimmed.city.toLowerCase();
        filtered = filtered.filter(o => {
          const a = addr(o);
          return a.city.toLowerCase().includes(c);
        });
      }

      // Modelle je Order nachladen für Anzeige
      const orderIds = filtered.map(o => o.id);
      const modelsByOrder: Record<string, string[]> = {};
      if (orderIds.length) {
        const { data: pos } = await supabase
          .from('production_orders')
          .select('order_id, modellname')
          .in('order_id', orderIds);
        for (const p of (pos || []) as any[]) {
          if (!p.order_id || !p.modellname) continue;
          (modelsByOrder[p.order_id] ??= []).push(p.modellname);
        }
      }

      const result: Hit[] = filtered.map(o => {
        const a = addr(o);
        return {
          id: o.id,
          order_number: o.order_number,
          order_status: o.order_status,
          order_date: o.order_date,
          total_amount: o.total_amount,
          currency: o.currency,
          customer_name: o.customers?.company_name || o.customers?.contact_name || '—',
          customer_phone: o.customers?.phone || null,
          zip: a.zip || null,
          city: a.city || null,
          models: Array.from(new Set(modelsByOrder[o.id] || [])),
        };
      });
      setHits(result);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={<SearchCheck className="w-6 h-6 text-primary" />}
        title="Detailsuche"
        subtitle="Suche nach Name, PLZ, Wohnort, Auftragsnummer, Telefonnummer oder Modell"
      />

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><Label>Name (Firma / Kontakt)</Label>
            <Input value={form.name} onChange={update('name')} placeholder="z. B. Müller GmbH" /></div>
          <div><Label>PLZ</Label>
            <Input value={form.zip} onChange={update('zip')} placeholder="z. B. 12347" /></div>
          <div><Label>Wohnort</Label>
            <Input value={form.city} onChange={update('city')} placeholder="z. B. Berlin" /></div>
          <div><Label>Auftragsnummer</Label>
            <Input value={form.orderNumber} onChange={update('orderNumber')} placeholder="z. B. SO-00123" /></div>
          <div><Label>Telefonnummer</Label>
            <Input value={form.phone} onChange={update('phone')} placeholder="z. B. +49 …" /></div>
          <div><Label>Modell</Label>
            <Input value={form.model} onChange={update('model')} placeholder="z. B. Alix Infinity" /></div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={runSearch} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Suchen
          </Button>
          <Button variant="outline" onClick={reset} disabled={loading}>
            <X className="w-4 h-4 mr-2" /> Zurücksetzen
          </Button>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      {hits !== null && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ergebnisse</h3>
            <span className="text-xs text-muted-foreground">{hits.length} Treffer</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsnr.</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Datum</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Telefon</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">PLZ / Ort</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Modelle</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {hits.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Vorgänge gefunden.</p>
                  </td></tr>
                ) : hits.map(h => (
                  <tr key={h.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => navigate(`/auftraege/${h.id}`)}>
                    <td className="px-4 py-3 font-medium">{h.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(h.order_date)}</td>
                    <td className="px-4 py-3">{h.customer_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.customer_phone || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{[h.zip, h.city].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{h.models.length ? h.models.join(', ') : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={h.order_status} /></td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {h.total_amount != null ? `${Number(h.total_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${h.currency || '€'}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
