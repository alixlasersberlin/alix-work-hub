import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, RotateCcw, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

type Row = {
  id: string;
  order_id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closed_reason: string | null;
  submitted_at: string | null;
  status: string | null;
};

export default function ClosedReviews() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('reviews')
      .select('id, order_id, order_number, customer_name, customer_email, product_name, closed_at, closed_by, closed_reason, submitted_at, status')
      .not('closed_at', 'is', null)
      .is('submitted_at', null)
      .order('closed_at', { ascending: false })
      .limit(1000);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.order_number || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.closed_reason || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const reopen = async (r: Row) => {
    setBusy(r.id);
    const { error } = await (supabase as any)
      .from('reviews')
      .update({ closed_at: null, closed_by: null, closed_reason: null, status: 'open' })
      .eq('id', r.id);
    setBusy(null);
    if (error) { toast.error('Wieder öffnen fehlgeschlagen: ' + error.message); return; }
    toast.success('Auftrag wieder geöffnet');
    setRows(prev => prev.filter(x => x.id !== r.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Lock className="h-4 w-4" />
          {loading ? '…' : `${filtered.length} geschlossene Aufträge (ohne Bewertung)`}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Grund</TableHead>
              <TableHead>Geschlossen am</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Keine geschlossenen Aufträge.</TableCell></TableRow>
            )}
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/auftraege/${r.order_id}`} className="font-mono text-xs hover:underline">
                    {r.order_number || '—'}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{r.customer_name || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.product_name || '—'}</TableCell>
                <TableCell className="text-xs max-w-[320px] truncate" title={r.closed_reason || ''}>
                  {r.closed_reason || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.closed_at ? new Date(r.closed_at).toLocaleString('de-DE') : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reopen(r)}
                    disabled={busy === r.id}
                  >
                    {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                    Wieder öffnen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
