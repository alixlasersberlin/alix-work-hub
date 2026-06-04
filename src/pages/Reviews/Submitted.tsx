import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

type Review = {
  id: string;
  order_id: string;
  order_number: string | null;
  customer_name: string | null;
  product_name: string | null;
  rating_delivery: number | null;
  rating_driver_friendliness: number | null;
  training_answer: string | null;
  improvement_text: string | null;
  rating_training_text: string | null;
  submitted_at: string | null;
};

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={i < value ? 'h-3.5 w-3.5 fill-current' : 'h-3.5 w-3.5 opacity-30'} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value}/5</span>
    </span>
  );
}

export default function SubmittedReviews() {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [starFilter, setStarFilter] = useState<string>('any');

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('reviews')
        .select('id, order_id, customer_id, customer_name, customer_email, order_number, product_name, delivery_date, rating_delivery, rating_driver_friendliness, training_answer, rating_training_text, improvement_text, token_expires_at, invitation_sent_at, invitation_sent_by, invitation_status, submitted_at, status, created_at, updated_at, closed_at, closed_by, closed_reason')
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(1000);
      setRows((data ?? []) as Review[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (starFilter !== 'any') {
      const n = parseInt(starFilter, 10);
      list = list.filter(r => r.rating_delivery === n);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.order_number || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.improvement_text || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, starFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {loading ? '…' : `${filtered.length} abgegebene Bewertungen`}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <Select value={starFilter} onValueChange={setStarFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Alle Sterne</SelectItem>
              {['5', '4', '3', '2', '1'].map(n => (
                <SelectItem key={n} value={n}>{n} Sterne</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Lieferung</TableHead>
              <TableHead>Fahrer</TableHead>
              <TableHead>Einweisung</TableHead>
              <TableHead>Kommentar</TableHead>
              <TableHead>Datum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Noch keine Bewertungen abgegeben.</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/auftraege/${r.order_id}`} className="font-mono text-xs hover:underline">
                    {r.order_number || '—'}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{r.customer_name || '—'}</TableCell>
                <TableCell><Stars value={r.rating_delivery} /></TableCell>
                <TableCell><Stars value={r.rating_driver_friendliness} /></TableCell>
                <TableCell className="text-xs">{r.training_answer || '—'}</TableCell>
                <TableCell className="text-xs max-w-[280px] truncate" title={r.improvement_text || ''}>
                  {r.improvement_text || r.rating_training_text || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('de-DE') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
