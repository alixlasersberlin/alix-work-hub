import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, RotateCw, CheckCircle2, Loader2, Search, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { sendReviewInvitation } from '@/lib/review-invitation';

type Order = {
  id: string;
  order_number: string;
  order_date: string | null;
  total_amount: number | null;
  customer_id: string;
  customers?: { company_name: string | null; contact_name: string | null; email: string | null } | null;
};

type Review = {
  order_id: string;
  invitation_sent_at: string | null;
  invitation_status: string | null;
  submitted_at: string | null;
  rating_delivery: number | null;
};

export default function DeliveredOrders() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const { data: ordersData, error } = await (supabase as any)
      .from('orders')
      .select('id, order_number, order_date, total_amount, customer_id, customers(company_name, contact_name, email)')
      .eq('order_status', 'geliefert')
      .order('order_date', { ascending: false })
      .limit(1000);
    if (error) toast.error('Aufträge laden fehlgeschlagen: ' + error.message);
    const list = (ordersData ?? []) as Order[];
    setOrders(list);

    if (list.length) {
      const ids = list.map(o => o.id);
      const { data: revData } = await (supabase as any)
        .from('reviews')
        .select('order_id, invitation_sent_at, invitation_status, submitted_at, rating_delivery')
        .in('order_id', ids);
      const map: Record<string, Review> = {};
      ((revData ?? []) as Review[]).forEach(r => { map[r.order_id] = r; });
      setReviews(map);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.trim().toLowerCase();
    return orders.filter(o =>
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.customers?.company_name || '').toLowerCase().includes(q) ||
      (o.customers?.contact_name || '').toLowerCase().includes(q),
    );
  }, [orders, search]);

  async function sendInvite(orderId: string, hasEmail: boolean) {
    if (!hasEmail) {
      toast.error('Für diesen Auftrag ist keine Kunden-E-Mail hinterlegt.');
      return;
    }
    setBusy(orderId);
    const r = await sendReviewInvitation(orderId, { manual: true });
    setBusy(null);
    if (r.ok) { toast.success('Einladung versendet'); load(); }
    else toast.error('Versand fehlgeschlagen: ' + (r.message || ''));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          {loading ? '…' : `${filtered.length} ausgelieferte Aufträge`}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Auftrag oder Kunde suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 w-72"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Lieferdatum</TableHead>
              <TableHead>Einladung</TableHead>
              <TableHead>Bewertung</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Keine ausgelieferten Aufträge.
                </TableCell>
              </TableRow>
            )}
            {filtered.map(o => {
              const rev = reviews[o.id];
              const hasEmail = !!o.customers?.email;
              const submitted = !!rev?.submitted_at;
              const sent = !!rev?.invitation_sent_at;
              return (
                <TableRow key={o.id} className={submitted ? 'bg-emerald-500/5' : ''}>
                  <TableCell>
                    <Link to={`/auftraege/${o.id}`} className="font-mono text-xs hover:underline">
                      {o.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.customers?.company_name || o.customers?.contact_name || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {hasEmail ? (
                      <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {o.customers?.email}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <AlertTriangle className="h-3 w-3" /> keine E-Mail
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}
                  </TableCell>
                  <TableCell>
                    {sent ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        {new Date(rev!.invitation_sent_at!).toLocaleDateString('de-DE')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {submitted ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        abgegeben{rev?.rating_delivery ? ` · ${rev.rating_delivery}★` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">offen</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSuperAdmin && !submitted && (
                      <Button
                        size="sm"
                        variant={sent ? 'outline' : 'default'}
                        disabled={busy === o.id || !hasEmail}
                        onClick={() => sendInvite(o.id, hasEmail)}
                      >
                        {busy === o.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : sent ? (
                          <><RotateCw className="h-4 w-4" /> Erneut senden</>
                        ) : (
                          <><Send className="h-4 w-4" /> Bewertung senden</>
                        )}
                      </Button>
                    )}
                    {submitted && <span className="text-xs text-muted-foreground">erledigt</span>}
                    {!isSuperAdmin && !submitted && <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
