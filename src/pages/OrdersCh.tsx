import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ClipboardList, Search, Loader2, Inbox } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

const CH_BRANCH_ID = '598077000000065075';

export default function OrdersCh() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError(null);
    // Fetch EU 1 orders, filter for CH branch in raw_data
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, customers(company_name, contact_name)')
      .eq('source_system', 'zoho_eu_1')
      .order('order_date', { ascending: false, nullsFirst: false })
      .limit(2000);
    if (err) { setError(err.message); setLoading(false); return; }
    const ch = (data ?? []).filter((o: any) => o?.raw_data?.branch_id === CH_BRANCH_ID);
    setOrders(ch);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(s) ||
      o.customers?.company_name?.toLowerCase().includes(s) ||
      o.customers?.contact_name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold gold-text">🇨🇭 Aufträge Schweiz</h1>
          <p className="text-sm text-muted-foreground">
            Alix Lasers ® Schweiz – Niederlassung (branch_id <code>{CH_BRANCH_ID}</code>)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche Auftragsnummer / Kunde …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Neu laden'}
        </Button>
        <div className="text-sm text-muted-foreground ml-auto">
          {filtered.length} {filtered.length === 1 ? 'Auftrag' : 'Aufträge'}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Auftragsnr.</th>
              <th className="text-left px-3 py-2">Datum</th>
              <th className="text-left px-3 py-2">Kunde</th>
              <th className="text-right px-3 py-2">Betrag</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                <Inbox className="w-6 h-6 mx-auto mb-2" />
                Keine Schweiz-Aufträge gefunden. Über <strong>Operations → Import-Aktionen</strong> kann ein Voll-Import gestartet werden.
              </td></tr>
            ) : filtered.map((o) => (
              <tr
                key={o.id}
                className="border-t border-border hover:bg-muted/30 cursor-pointer"
                onClick={() => navigate(`/auftraege/${o.id}`)}
              >
                <td className="px-3 py-2 font-mono">{o.order_number}</td>
                <td className="px-3 py-2">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-CH') : '—'}</td>
                <td className="px-3 py-2">{o.customers?.company_name ?? o.customers?.contact_name ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-CH', { style: 'currency', currency: o.currency ?? 'CHF' }) : '—'}
                </td>
                <td className="px-3 py-2"><StatusBadge status={o.order_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
