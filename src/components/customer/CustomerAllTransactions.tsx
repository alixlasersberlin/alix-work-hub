import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Search, ChevronRight, FileText, FileSignature, ShoppingCart, Receipt, Undo2, ArrowDownToLine, Layers,
} from 'lucide-react';
import { EmptyState } from '@/components/infinity/EmptyState';

type Kind = 'beleg' | 'angebot' | 'auftrag' | 'rechnung' | 'gutschrift' | 'zahlung';

type Row = {
  id: string;
  kind: Kind;
  date: string | null;
  number: string;
  title: string;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  href?: string | null;
};

const KIND_META: Record<Kind, { label: string; icon: any; className: string }> = {
  beleg: { label: 'Beleg', icon: FileText, className: 'bg-muted text-muted-foreground' },
  angebot: { label: 'Angebot', icon: FileSignature, className: 'bg-primary/15 text-primary' },
  auftrag: { label: 'Auftrag', icon: ShoppingCart, className: 'bg-blue-500/15 text-blue-400' },
  rechnung: { label: 'Rechnung', icon: Receipt, className: 'bg-amber-500/15 text-amber-400' },
  gutschrift: { label: 'Gutschrift', icon: Undo2, className: 'bg-purple-500/15 text-purple-400' },
  zahlung: { label: 'Zahlung', icon: ArrowDownToLine, className: 'bg-emerald-500/15 text-emerald-400' },
};

const fmtMoney = (n?: number | null, c?: string | null) =>
  n == null ? '—' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: c || 'EUR' });

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('de-DE');
};

export default function CustomerAllTransactions({
  customerId,
  externalCustomerId,
  customerName,
}: {
  customerId: string;
  externalCustomerId?: string | null;
  customerName?: string | null;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ext = externalCustomerId || null;
      const name = customerName || null;

      const invQ = supabase
        .from('zoho_invoices')
        .select('id, invoice_number, invoice_date, status, payment_status, total, balance, currency')
        .order('invoice_date', { ascending: false })
        .limit(300);
      const cnQ = supabase
        .from('zoho_credit_notes')
        .select('id, creditnote_number, creditnote_date, status, total, currency')
        .order('creditnote_date', { ascending: false })
        .limit(200);

      const [offersRes, ordersRes, invRes, cnRes, payRes, docsRes] = await Promise.all([
        supabase
          .from('offers')
          .select('id, offer_number, offer_date, created_at, status, approval_status, total_gross')
          .eq('customer_id', customerId)
          .order('offer_date', { ascending: false })
          .limit(200),
        supabase
          .from('orders')
          .select('id, order_number, order_date, order_status, total_amount, currency')
          .eq('customer_id', customerId)
          .order('order_date', { ascending: false })
          .limit(300),
        ext ? invQ.eq('customer_id', ext) : name ? invQ.eq('customer_name', name) : invQ.eq('customer_id', '__none__'),
        ext ? cnQ.eq('customer_id', ext) : name ? cnQ.eq('customer_name', name) : cnQ.eq('customer_id', '__none__'),
        supabase
          .from('finance_transactions')
          .select('id, amount, currency, booking_date, reference, transaction_type, notes')
          .eq('customer_id', customerId)
          .order('booking_date', { ascending: false })
          .limit(300),
        supabase
          .from('alixdocs_documents')
          .select('id, title, document_date, created_at, status, original_filename')
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      const list: Row[] = [];

      (offersRes.data ?? []).forEach((o: any) =>
        list.push({
          id: `ang-${o.id}`,
          kind: 'angebot',
          date: o.offer_date || o.created_at,
          number: o.offer_number,
          title: `Angebot ${o.offer_number}`,
          status: o.approval_status === 'pending' ? 'In Freigabe' : o.status,
          amount: o.total_gross,
          currency: 'EUR',
          href: `/angebote?nr=${encodeURIComponent(o.offer_number)}`,
        }),
      );

      (ordersRes.data ?? []).forEach((o: any) =>
        list.push({
          id: `auf-${o.id}`,
          kind: 'auftrag',
          date: o.order_date,
          number: o.order_number,
          title: `Auftrag ${o.order_number}`,
          status: o.order_status,
          amount: o.total_amount,
          currency: o.currency,
          href: `/auftraege/${o.id}`,
        }),
      );

      (invRes.data ?? []).forEach((r: any) =>
        list.push({
          id: `inv-${r.id}`,
          kind: 'rechnung',
          date: r.invoice_date,
          number: r.invoice_number,
          title: `Rechnung ${r.invoice_number}`,
          status: r.payment_status || r.status,
          amount: r.total,
          currency: r.currency,
        }),
      );

      (cnRes.data ?? []).forEach((r: any) =>
        list.push({
          id: `cn-${r.id}`,
          kind: 'gutschrift',
          date: r.creditnote_date,
          number: r.creditnote_number,
          title: `Gutschrift ${r.creditnote_number}`,
          status: r.status,
          amount: r.total,
          currency: r.currency,
        }),
      );

      (payRes.data ?? []).forEach((r: any) =>
        list.push({
          id: `pay-${r.id}`,
          kind: 'zahlung',
          date: r.booking_date,
          number: r.reference || '—',
          title: r.transaction_type ? `${r.transaction_type}${r.notes ? ` · ${r.notes}` : ''}` : r.notes || 'Zahlung',
          status: r.transaction_type,
          amount: r.amount,
          currency: r.currency,
        }),
      );

      (docsRes.data ?? []).forEach((r: any) =>
        list.push({
          id: `doc-${r.id}`,
          kind: 'beleg',
          date: r.document_date || r.created_at,
          number: r.original_filename || '—',
          title: r.title || r.original_filename || 'Dokument',
          status: r.status,
          href: `/alixdocs/preview/${r.id}`,
        }),
      );

      list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      if (!cancelled) {
        setRows(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, externalCustomerId, customerName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (!q) return true;
      return [r.number, r.title, r.status, r.amount != null ? String(r.amount) : '']
        .some((v) => (v ?? '').toString().toLowerCase().includes(q));
    });
  }, [rows, search, kind]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.kind] = (c[r.kind] || 0) + 1; });
    return c;
  }, [rows]);

  const groups = useMemo(() => {
    return (Object.keys(KIND_META) as Kind[])
      .filter((k) => kind === 'all' || kind === k)
      .map((k) => ({ kind: k, items: filtered.filter((r) => r.kind === k) }));
  }, [filtered, kind]);

  const toggle = (k: Kind) =>
    setOpen((o) => ({ ...o, [k]: !o[k] }));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Nummer, Betreff, Status, Betrag…"
            className="pl-9"
          />
        </div>
        <div className="mt-3">
          <Select value={kind} onValueChange={(v) => setKind(v as any)}>
            <SelectTrigger className="w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Vorgänge ({rows.length})</SelectItem>
              {(Object.keys(KIND_META) as Kind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_META[k].label} ({counts[k] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{filtered.length} Einträge</div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8">
          <EmptyState icon={Layers} title="Keine Vorgänge" description="Für diesen Kunden liegen keine Vorgänge vor." />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ kind: k, items }) => {
            const meta = KIND_META[k];
            const Icon = meta.icon;
            const isOpen = !!open[k];
            return (
              <div key={k} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(k)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                >
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${meta.className}`}>
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </span>
                  <span className="text-sm font-medium">{items.length} Einträge</span>
                </button>
                {isOpen && (
                  <table className="w-full text-sm border-t border-border">
                    <thead className="bg-secondary/50 text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-3">Datum</th>
                        <th className="text-left px-4 py-3">Nummer</th>
                        <th className="text-left px-4 py-3">Bezeichnung</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-right px-4 py-3">Betrag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((r) => (
                        <tr
                          key={r.id}
                          className={`hover:bg-secondary/30 ${r.href ? 'cursor-pointer' : ''}`}
                          onClick={() => r.href && navigate(r.href)}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                          <td className="px-4 py-2 font-medium">{r.number}</td>
                          <td className="px-4 py-2 text-muted-foreground max-w-[320px] truncate">{r.title}</td>
                          <td className="px-4 py-2">
                            {r.status ? <Badge variant="outline" className="text-[10px]">{r.status}</Badge> : '—'}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${r.kind === 'zahlung' ? 'text-success' : ''}`}>
                            {r.kind === 'beleg' ? '—' : fmtMoney(r.amount, r.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
