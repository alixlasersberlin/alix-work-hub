import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Undo2, Mail, FileText, Plus } from 'lucide-react';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { listReturnDebits, sendReturnDebitDunning, RD_STATUS } from '@/lib/bank/returnDebit';
import { downloadReturnDunningPdf } from '@/lib/bank/returnDunningLetter';
import { supabase } from '@/integrations/supabase/client';
import ReturnDebitDialog from '@/components/bank/ReturnDebitDialog';
import ManualReturnDebitDialog from '@/components/bank/ManualReturnDebitDialog';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

const statusColor = (s: string) =>
  s === 'bestaetigt' || s === 'erledigt' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    : s === 'storniert' ? 'bg-muted text-muted-foreground'
      : s === 'ungeklaert' || s === 'doppelt' ? 'bg-red-500/15 text-red-500 border-red-500/30'
        : 'bg-amber-500/15 text-amber-500 border-amber-500/30';

const feeStatusLabel = (s?: string | null) => {
  const v = (s ?? 'offen').toLowerCase();
  if (v === 'paid' || v === 'bezahlt') return 'bezahlt';
  if (v === 'storniert' || v === 'void') return 'storniert';
  if (v === 'teilweise' || v === 'partially_paid') return 'teilweise';
  return 'offen';
};

const feeStatusColor = (s?: string | null) => {
  const v = feeStatusLabel(s);
  return v === 'bezahlt' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
    : v === 'storniert' ? 'bg-muted text-muted-foreground'
      : 'bg-amber-500/15 text-amber-500 border-amber-500/30';
};

export default function Ruecklastschriften() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<any | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await listReturnDebits(region, status || undefined)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [region, status]);

  const openRow = async (r: any) => {
    const { data } = await supabase.from('bank_transactions' as any)
      .select('*, bank_accounts:bank_account_id(bank_name,account_name,iban,currency)')
      .eq('id', r.bank_transaction_id).maybeSingle();
    if (data) setTx(data);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-red-500" />Rücklastschriften ({rows.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Alle Status</option>
              {Object.entries(RD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Button size="sm" onClick={() => setManualOpen(true)}><Plus className="w-4 h-4 mr-1" />Manuell erfassen</Button>
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40"><tr className="text-left">
                  <th className="p-2">Datum</th><th className="p-2">Rechnung</th><th className="p-2">Grund</th>
                  <th className="p-2">Code</th><th className="p-2 text-right">Betrag</th><th className="p-2 text-right">Gebühr</th>
                  <th className="p-2">Gebührenrechnung</th>
                  <th className="p-2">Status</th><th className="p-2">Sperre</th><th className="p-2"></th>
                </tr></thead>
                <tbody>
                  {!rows.length && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Keine Rücklastschriften vorhanden.</td></tr>}
                  {rows.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-2">{r.booking_date ?? '–'}</td>
                      <td className="p-2">{r.invoice_number ?? '–'}</td>
                      <td className="p-2 max-w-xs truncate" title={r.return_reason ?? ''}>{r.return_reason ?? '–'}</td>
                      <td className="p-2">{r.return_code ?? '–'}</td>
                      <td className="p-2 text-right font-medium text-red-500">{fmt(Number(r.return_debit_amount), r.currency)}</td>
                      <td className="p-2 text-right">{fmt(Number(r.bank_fee) + Number(r.additional_costs), r.currency)}</td>
                      <td className="p-2 whitespace-nowrap">
                        {r.fee_invoice_number ? (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">{r.fee_invoice_number}</span>
                            <Badge className={feeStatusColor(r.fee_invoice_status)}>{feeStatusLabel(r.fee_invoice_status)}</Badge>
                          </span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="p-2"><Badge className={statusColor(r.status)}>{RD_STATUS[r.status] ?? r.status}</Badge></td>
                      <td className="p-2">{r.sepa_mandate_blocked ? 'Lastschrift gesperrt' : '–'}</td>

                      <td className="p-2 text-right whitespace-nowrap space-x-1">
                        <Button size="sm" variant="ghost" title="Mahnung mit Sperrankündigung senden"
                          onClick={async () => {
                            const days = Number(window.prompt('Zahlungsfrist in Tagen (danach Sperre der Leistungen)', '7') ?? '');
                            if (!days || days < 1) return;
                            try {
                              const info = await sendReturnDebitDunning(r, days);
                              toast.success(`Mahnung an ${info.recipient} versendet (zahlbar bis ${info.payUntil})`);
                              load();
                            } catch (e: any) { toast.error(e.message); }
                          }}>
                          <Mail className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Mahnschreiben als PDF herunterladen"
                          onClick={async () => {
                            const days = Number(window.prompt('Zahlungsfrist in Tagen für das Mahnschreiben', '7') ?? '');
                            if (!days || days < 1) return;
                            try {
                              const vars = await downloadReturnDunningPdf(r, days);
                              toast.success(`Mahnschreiben erstellt (zahlbar bis ${vars.zahlbar_bis})`);
                            } catch (e: any) { toast.error(e.message); }
                          }}>
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openRow(r)}>Öffnen</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ManualReturnDebitDialog region={region} open={manualOpen}
        onOpenChange={setManualOpen} onCreated={load} />

      {tx && (
        <ReturnDebitDialog tx={tx} region={region} open={!!tx}
          onOpenChange={o => { if (!o) setTx(null); }} onChanged={load} />
      )}
    </div>
  );
}
