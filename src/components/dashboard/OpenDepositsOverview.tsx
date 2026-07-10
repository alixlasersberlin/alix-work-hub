import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, ChevronDown, Loader2, Download } from 'lucide-react';
import { parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { EmptyState } from '@/components/infinity/EmptyState';


type Deposit = {
  id: string;
  source: 'alixwork' | 'zoho' | null;
  deposit_number: string | null;
  customer_name: string | null;
  company_name: string | null;
  order_id: string | null;
  order_number: string | null;
  offer_number: string | null;
  invoice_number: string | null;
  currency: string | null;
  gross_amount: number;
  paid_amount: number;
  open_amount: number;
  due_date: string | null;
  status: 'offen' | 'ueberfaellig' | 'teilweise' | 'gebucht';
};


const fmtMoney = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(n) || 0);

const statusLabel: Record<Deposit['status'], string> = {
  offen: 'Offen',
  ueberfaellig: 'Überfällig',
  teilweise: 'Teilweise bezahlt',
  gebucht: 'Gebucht',
};

const statusBadge: Record<Deposit['status'], string> = {
  offen: 'bg-muted text-muted-foreground border border-border',
  ueberfaellig: 'bg-destructive/15 text-destructive border border-destructive/30',
  teilweise: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  gebucht: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
};

export function OpenDepositsOverview() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Deposit[]>([]);
  const [docTokens, setDocTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('finance_deposits')
        .select('id, source, deposit_number, customer_name, company_name, order_id, order_number, offer_number, invoice_number, currency, gross_amount, paid_amount, open_amount, due_date, status')
        .neq('status', 'gebucht')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(500);
      const list = (data ?? []) as any as Deposit[];
      setRows(list);

      const orderIds = Array.from(new Set(list.map(r => r.order_id).filter(Boolean))) as string[];
      if (orderIds.length) {
        const { data: docs } = await supabase
          .from('order_documents')
          .select('order_id, download_token, created_at')
          .in('order_id', orderIds)
          .eq('document_type', 'Anzahlungsrechnung')
          .order('created_at', { ascending: false });
        const map: Record<string, string> = {};
        (docs ?? []).forEach((d: any) => {
          if (d.order_id && d.download_token && !map[d.order_id]) map[d.order_id] = d.download_token;
        });
        setDocTokens(map);
      }
      setLoading(false);
    })();
  }, []);


  const totalOpen = rows.reduce((s, r) => s + Number(r.open_amount || 0), 0);
  const overdue = rows.filter(r => r.due_date && parseISO(r.due_date) < new Date()).length;

  return (
    <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
      <div className="flex items-center justify-between p-5">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left"
          aria-expanded={open}
        >
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
          <Wallet className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Offene Anzahlungen</h2>
          <span className="text-xs text-muted-foreground">
            {rows.length} offen · {overdue} überfällig · Summe {fmtMoney(totalOpen)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/finance/offene-anzahlungen')}
          className="text-xs text-primary hover:underline"
        >
          Alle anzeigen →
        </button>
      </div>
      {open && (
        <div className="border-t border-border">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Wallet} title="Keine offenen Anzahlungen." compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-secondary/30">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Kunde / Firma</th>
                    <th className="text-left px-4 py-2 font-medium">Auftrag</th>
                    <th className="text-left px-4 py-2 font-medium">Rechnung</th>
                    <th className="text-right px-4 py-2 font-medium">Brutto</th>
                    <th className="text-right px-4 py-2 font-medium">Bezahlt</th>
                    <th className="text-right px-4 py-2 font-medium">Offen</th>
                    <th className="text-left px-4 py-2 font-medium">Fällig</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Rechnung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.slice(0, 25).map((r) => {
                    const token = r.order_id ? docTokens[r.order_id] : null;
                    return (
                    <tr
                      key={r.id}
                      className="hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate('/finance/offene-anzahlungen')}
                    >
                      <td className="px-4 py-2">{r.company_name || r.customer_name || '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.order_number || r.offer_number || '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.invoice_number || r.deposit_number || '—'}</td>
                      <td className="px-4 py-2 text-right">{fmtMoney(r.gross_amount, r.currency || 'EUR')}</td>
                      <td className="px-4 py-2 text-right">{fmtMoney(r.paid_amount, r.currency || 'EUR')}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmtMoney(r.open_amount, r.currency || 'EUR')}</td>
                      <td className="px-4 py-2 text-xs">
                        {r.due_date ? new Date(r.due_date).toLocaleDateString('de-DE') : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${statusBadge[r.status]}`}>
                          {statusLabel[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {token ? (
                          <a
                            href={`/d/${token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-primary hover:bg-primary/10"
                            title="Anzahlungsrechnung öffnen"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>

              </table>
              {rows.length > 25 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
                  {rows.length - 25} weitere – <button className="text-primary hover:underline" onClick={() => navigate('/finance/offene-anzahlungen')}>alle anzeigen</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
