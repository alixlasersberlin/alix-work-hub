import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { bookTransaction, type AllocationInput } from '@/lib/bank/api';

const ALLOC_TYPES = [
  { v: 'rechnung', l: 'Rechnung' },
  { v: 'anzahlung', l: 'Anzahlung' },
  { v: 'guthaben', l: 'Kundenguthaben' },
  { v: 'sonstige_einnahme', l: 'Sonstige Einnahme' },
  { v: 'sonstige_ausgabe', l: 'Sonstige Ausgabe' },
  { v: 'lieferant', l: 'Lieferant / Eingangsrechnung' },
  { v: 'bankgebuehr', l: 'Bankgebühr' },
  { v: 'ruecklastschrift', l: 'Rücklastschrift' },
  { v: 'erstattung', l: 'Erstattung' },
  { v: 'lohn', l: 'Lohnzahlung' },
  { v: 'steuer', l: 'Steuerzahlung' },
  { v: 'leasing', l: 'Leasing / Miete / Finanzierung' },
  { v: 'intern', l: 'Internes Verrechnungskonto' },
];

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

interface Row extends AllocationInput { key: string }

export function ManualMatchDialog({
  tx, region, open, onOpenChange, onBooked,
}: {
  tx: any; region: 'EU' | 'CH'; open: boolean;
  onOpenChange: (o: boolean) => void; onBooked: () => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const abs = Math.abs(Number(tx?.amount ?? 0));

  useEffect(() => {
    if (!open) return;
    setRows([]);
    setTerm(tx?.purpose?.slice(0, 30) ?? '');
  }, [open, tx?.id]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setSearching(true);
      const cols = 'id,invoice_number,customer_id,customer_name,invoice_date,due_date,currency,total,balance,status,payment_status,reference_number';
      const s = term.trim().replace(/[%,]/g, ' ');
      const build = (table: 'zoho_invoices' | 'zoho_recurring_invoices') => {
        let q = supabase.from(table)
          .select(cols)
          .eq('accounting_region', region as any)
          .order('invoice_date', { ascending: false })
          .limit(30);
        if (s) q = q.or(`invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%,reference_number.ilike.%${s}%,customer_id.ilike.%${s}%`);
        else q = q.gt('balance', 0);
        return q;
      };
      const [std, rec, ord] = await Promise.all([
        build('zoho_invoices'),
        build('zoho_recurring_invoices'),
        (async () => {
          let oq = supabase.from('orders')
            .select('id,order_number,customer_id,currency,total_amount,finance_open_amount,finance_remaining_amount,order_date,order_status,customers:customer_id(company_name,contact_name)')
            .eq('accounting_region', region as any)
            .order('order_date', { ascending: false })
            .limit(20);
          if (s) oq = oq.or(`order_number.ilike.%${s}%,internal_number.ilike.%${s}%,case_number.ilike.%${s}%`);
          const { data } = await oq;
          return (data ?? []) as any[];
        })(),
      ]);
      setResults([
        ...((std.data ?? []) as any[]).map(i => ({ ...i, __src: 'zoho' })),
        ...((rec.data ?? []) as any[]).map(i => ({ ...i, __src: 'recurring' })),
        ...ord.map((o: any) => ({
          id: o.id,
          invoice_number: o.order_number,
          customer_id: o.customer_id,
          customer_name: o.customers?.company_name || o.customers?.contact_name || null,
          invoice_date: o.order_date ? String(o.order_date).slice(0, 10) : null,
          due_date: null,
          currency: o.currency || (region === 'CH' ? 'CHF' : 'EUR'),
          total: Number(o.total_amount ?? 0),
          balance: Number(o.finance_open_amount ?? o.finance_remaining_amount ?? o.total_amount ?? 0),
          status: o.order_status,
          payment_status: 'Auftrag',
          __src: 'order',
        })),
      ]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [term, open, region]);


  const sum = useMemo(() => rows.reduce((s, r) => s + Number(r.allocated_amount || 0), 0), [rows]);
  const diff = abs - sum;

  const addInvoice = (inv: any) => {
    if (rows.some(r => (r.invoice_id ?? r.order_id) === inv.id)) return;
    const rest = Math.max(0, diff);
    const amount = Number(Math.min(rest || abs, Number(inv.balance ?? abs) || abs).toFixed(2));
    if (inv.__src === 'order') {
      setRows(r => [...r, {
        key: crypto.randomUUID(), order_id: inv.id, invoice_number: inv.invoice_number,
        customer_id: inv.customer_id ?? null, allocation_type: 'anzahlung',
        allocated_amount: amount,
      }]);
      return;
    }
    setRows(r => [...r, {
      key: crypto.randomUUID(), invoice_id: inv.id, invoice_number: inv.invoice_number,
      customer_id: null, allocation_type: 'rechnung',
      allocated_amount: amount,
    }]);
  };

  const addOther = () => setRows(r => [...r, {
    key: crypto.randomUUID(), allocation_type: 'guthaben',
    allocated_amount: Number(Math.max(0, diff).toFixed(2)),
  }]);

  const book = async () => {
    setSaving(true);
    try {
      await bookTransaction(tx, rows.map(({ key, ...a }) => a));
      toast.success('Buchung verbucht');
      onOpenChange(false);
      onBooked();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  if (!tx) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manuelle Zuordnung · {fmt(Number(tx.amount), tx.currency)}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">Auftraggeber / Empfänger:</span> {tx.sender_receiver_name || '–'}</div>
          <div><span className="text-muted-foreground">Verwendungszweck:</span> {tx.purpose || '–'}</div>
          <div><span className="text-muted-foreground">Buchungsdatum:</span> {tx.booking_date || '–'} · IBAN: {tx.sender_receiver_iban || '–'}</div>
        </div>

        <div className="space-y-2">
          <Label>Rechnung, Kunde, Kundennummer, Auftrag oder Betrag suchen</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" value={term} onChange={e => setTerm(e.target.value)} placeholder="z. B. RG-2026-0042, Musterfirma GmbH …" />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Rechnung</th><th className="p-2">Kunde</th><th className="p-2">Datum</th>
                  <th className="p-2">Fällig</th><th className="p-2 text-right">Betrag</th>
                  <th className="p-2 text-right">Offen</th><th className="p-2">Status</th><th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {searching && <tr><td colSpan={8} className="p-3 text-muted-foreground">Suche …</td></tr>}
                {!searching && !results.length && <tr><td colSpan={8} className="p-3 text-muted-foreground">Keine Treffer</td></tr>}
                {results.map(inv => (
                  <tr key={inv.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2 font-medium">
                      {inv.invoice_number}
                      {inv.__src === 'recurring' && <Badge variant="secondary" className="ml-1 text-[9px]">Rate</Badge>}
                    </td>
                    <td className="p-2">{inv.customer_name}</td>

                    <td className="p-2">{inv.invoice_date}</td>
                    <td className="p-2">{inv.due_date}</td>
                    <td className="p-2 text-right">{fmt(Number(inv.total), inv.currency || 'EUR')}</td>
                    <td className="p-2 text-right font-medium">{fmt(Number(inv.balance), inv.currency || 'EUR')}</td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{inv.payment_status || inv.status}</Badge></td>
                    <td className="p-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => addInvoice(inv)}><Plus className="w-3 h-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Zuordnungen</Label>
            <Button size="sm" variant="outline" onClick={addOther}><Plus className="w-3.5 h-3.5 mr-1" />Position ohne Rechnung</Button>
          </div>
          {!rows.length && <p className="text-xs text-muted-foreground">Noch keine Zuordnung gewählt.</p>}
          {rows.map((r, i) => (
            <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
              <span className="text-xs font-medium min-w-24">{r.invoice_number || 'Ohne Rechnung'}</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                value={r.allocation_type}
                onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, allocation_type: e.target.value } : x))}
              >
                {ALLOC_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <Input
                type="number" step="0.01" className="h-8 w-32 text-xs"
                value={r.allocated_amount}
                onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, allocated_amount: Number(e.target.value) } : x))}
              />
              <Button size="sm" variant="ghost" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <div className={`text-sm font-medium ${Math.abs(diff) < 0.01 ? 'text-emerald-500' : 'text-amber-500'}`}>
            Summe Zuordnungen: {fmt(sum, tx.currency)} · Buchungsbetrag: {fmt(abs, tx.currency)} · Differenz: {fmt(diff, tx.currency)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={book} disabled={saving || !rows.length || Math.abs(diff) > 0.01}>
            {saving ? 'Verbuche …' : 'Verbuchen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ManualMatchDialog;
