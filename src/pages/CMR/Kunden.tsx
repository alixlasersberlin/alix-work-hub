import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Search, Users, Download } from 'lucide-react';
import { useCmrTenant, cmrMoney, CMR_DOC_TYPES } from '@/hooks/useCmrTenant';


type Row = {
  key: string;
  customer_id: string | null;
  name: string;
  email: string | null;
  docs: number;
  gross: number;
  paid: number;
  open: number;
  last: string | null;
};

export default function CmrKunden() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');

  const cur = settings?.default_currency || 'AED';

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      setBusy(true);
      const { data } = await supabase
        .from('cmr_documents' as any)
        .select('customer_id,customer_name,customer_email,doc_type,doc_date,gross_total,paid_total,status')
        .eq('tenant_id', tenantId)
        .limit(2000);

      const map = new Map<string, Row>();
      for (const d of ((data as any) || []) as any[]) {
        const key = d.customer_id || d.customer_name || '—';
        const r = map.get(key) ?? {
          key,
          customer_id: d.customer_id ?? null,
          name: d.customer_name || 'Ohne Kunde',
          email: d.customer_email ?? null,
          docs: 0, gross: 0, paid: 0, open: 0, last: null,
        };
        const billable = ['rechnung', 'proforma', 'mahnung', 'zahlungserinnerung'].includes(d.doc_type);
        r.docs += 1;
        if (billable && d.status !== 'storniert') {
          r.gross += Number(d.gross_total || 0);
          r.paid += Number(d.paid_total || 0);
        }
        if (!r.email && d.customer_email) r.email = d.customer_email;
        if (!r.last || (d.doc_date && d.doc_date > r.last)) r.last = d.doc_date;
        map.set(key, r);
      }
      const list = [...map.values()].map((r) => ({ ...r, open: Math.max(0, r.gross - r.paid) }));
      list.sort((a, b) => b.gross - a.gross);
      setRows(list);
      setBusy(false);
    })();
  }, [tenantId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(s) || (r.email ?? '').toLowerCase().includes(s));
  }, [rows, q]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ gross: a.gross + r.gross, paid: a.paid + r.paid, open: a.open + r.open }),
    { gross: 0, paid: 0, open: 0 },
  ), [filtered]);

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CMR Kunden"
        subtitle="Kundenübersicht auf Basis der CMR-Belege – Umsatz, bezahlt und offene Posten je Kunde."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Kunden</div><div className="text-xl font-semibold">{filtered.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Umsatz (brutto)</div><div className="text-xl font-semibold">{cmrMoney(totals.gross, cur)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Bezahlt</div><div className="text-xl font-semibold text-emerald-500">{cmrMoney(totals.paid, cur)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Offen</div><div className="text-xl font-semibold text-amber-500">{cmrMoney(totals.open, cur)}</div></Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kunde oder E-Mail suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-2 px-2">Kunde</th>
                <th className="text-left py-2 px-2">E-Mail</th>
                <th className="text-right py-2 px-2">Belege</th>
                <th className="text-right py-2 px-2">Umsatz</th>
                <th className="text-right py-2 px-2">Bezahlt</th>
                <th className="text-right py-2 px-2">Offen</th>
                <th className="text-left py-2 px-2">Letzter Beleg</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="py-2 px-2 font-medium">
                    <span className="inline-flex items-center gap-2"><Users className="w-3.5 h-3.5 text-muted-foreground" />{r.name}</span>
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{r.email || '—'}</td>
                  <td className="py-2 px-2 text-right">{r.docs}</td>
                  <td className="py-2 px-2 text-right">{cmrMoney(r.gross, cur)}</td>
                  <td className="py-2 px-2 text-right text-emerald-500">{cmrMoney(r.paid, cur)}</td>
                  <td className="py-2 px-2 text-right">
                    {r.open > 0
                      ? <Badge variant="outline" className="border-amber-500/40 text-amber-500">{cmrMoney(r.open, cur)}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{r.last ? new Date(r.last).toLocaleDateString('de-DE') : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Kunden gefunden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
