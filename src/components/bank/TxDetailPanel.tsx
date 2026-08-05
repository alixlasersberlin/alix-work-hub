import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, Undo2, PauseCircle, XCircle, Pencil } from 'lucide-react';
import { getAllocations, getMatches, getTxAudit, setTxStatus, bookTransaction, reverseTransaction } from '@/lib/bank/api';
import BankStatusBadge from './BankStatusBadge';
import ManualMatchDialog from './ManualMatchDialog';
import { useAuth } from '@/hooks/useAuth';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

export function TxDetailPanel({
  tx, region, onClose, onChanged,
}: { tx: any | null; region: 'EU' | 'CH'; onClose: () => void; onChanged: () => void }) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [matches, setMatches] = useState<any[]>([]);
  const [allocs, setAllocs] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!tx) return;
    (async () => {
      const [m, a, l] = await Promise.all([getMatches(tx.id), getAllocations(tx.id), getTxAudit(tx.id)]);
      setMatches(m); setAllocs(a); setAudit(l);
    })();
  }, [tx?.id]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); toast.success(msg); onChanged(); onClose(); }
    catch (e: any) { toast.error(e.message); }
  };

  const best = matches[0];

  return (
    <>
      <Sheet open={!!tx} onOpenChange={o => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {tx && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {fmt(Number(tx.amount), tx.currency)}
                  <BankStatusBadge status={tx.status} score={tx.matching_score} />
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4 text-sm">
                <section className="space-y-1">
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground">Originaldaten der Bank</h4>
                  <Row l="Buchungsdatum" v={tx.booking_date} />
                  <Row l="Wertstellung" v={tx.value_date} />
                  <Row l="Richtung" v={tx.transaction_type === 'eingang' ? 'Zahlungseingang' : 'Zahlungsausgang'} />
                  <Row l="Auftraggeber / Empfänger" v={tx.sender_receiver_name} />
                  <Row l="IBAN" v={tx.sender_receiver_iban} />
                  <Row l="BIC" v={tx.bic} />
                  <Row l="Buchungstext" v={tx.booking_text} />
                  <Row l="Verwendungszweck" v={tx.purpose} />
                  <Row l="Bankreferenz" v={tx.bank_reference} />
                  <Row l="End-to-End" v={tx.end_to_end_reference} />
                  <Row l="Mandatsreferenz" v={tx.mandate_reference} />
                  {tx.is_duplicate && <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Mögliche Dublette</Badge>}
                  {tx.is_return_debit && <Badge className="bg-red-500/15 text-red-500 border-red-500/30">Rücklastschrift erkannt</Badge>}
                </section>

                <section className="space-y-2">
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground">Vorgeschlagene Zuordnungen</h4>
                  {!matches.length && <p className="text-muted-foreground text-xs">Keine automatischen Treffer.</p>}
                  {matches.map(m => (
                    <div key={m.id} className="rounded-md border border-border p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {m.invoice_number ?? '–'}
                          {m.order_id && !m.invoice_id && <Badge variant="outline" className="ml-1 text-[9px]">Auftrag</Badge>}
                        </span>
                        <Badge variant="outline">{m.matching_score} % Übereinstimmung</Badge>
                      </div>
                      <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                        {(m.matching_reasons ?? []).map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                      {tx.status !== 'verbucht' && (
                        <Button size="sm" className="mt-2" variant="outline"
                          onClick={() => act(() => bookTransaction(tx, [{
                            invoice_id: m.invoice_id ?? null, order_id: m.order_id ?? null,
                            invoice_number: m.invoice_number,
                            customer_id: m.customer_id,
                            allocation_type: (!m.invoice_id && m.order_id) ? 'anzahlung' : 'rechnung',
                            allocated_amount: Math.abs(Number(tx.amount)),
                          }]), 'Zahlung verbucht')}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          {(!m.invoice_id && m.order_id) ? 'Auf diesen Auftrag verbuchen' : 'Diese Rechnung verbuchen'}
                        </Button>
                      )}
                    </div>
                  ))}
                </section>

                {!!allocs.length && (
                  <section className="space-y-1">
                    <h4 className="font-semibold text-xs uppercase text-muted-foreground">Verbuchte Zuordnungen</h4>
                    {allocs.map(a => (
                      <div key={a.id} className="flex justify-between text-xs border-b border-border py-1">
                        <span>{a.invoice_number ?? a.allocation_type}</span>
                        <span>{fmt(Number(a.allocated_amount), a.currency)}</span>
                      </div>
                    ))}
                  </section>
                )}

                <section className="flex flex-wrap gap-2">
                  {tx.status !== 'verbucht' && (
                    <>
                      <Button size="sm" onClick={() => setManual(true)}><Pencil className="w-3.5 h-3.5 mr-1" />Manuell zuordnen</Button>
                      <Button size="sm" variant="outline" onClick={() => act(() => setTxStatus(tx.id, 'zurueckgestellt'), 'Zurückgestellt')}>
                        <PauseCircle className="w-3.5 h-3.5 mr-1" />Zurückstellen
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(() => setTxStatus(tx.id, 'ignoriert'), 'Ignoriert')}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />Ignorieren
                      </Button>
                    </>
                  )}
                  {tx.status === 'verbucht' && isSuperAdmin && (
                    <Button size="sm" variant="destructive"
                      onClick={() => act(() => reverseTransaction(tx, 'Storno durch Super Admin'), 'Storniert (Gegenbuchung erstellt)')}>
                      <Undo2 className="w-3.5 h-3.5 mr-1" />Verbuchung stornieren
                    </Button>
                  )}
                </section>

                <section className="space-y-1">
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground">Buchungshistorie</h4>
                  {!audit.length && <p className="text-xs text-muted-foreground">Keine Einträge.</p>}
                  {audit.map(a => (
                    <div key={a.id} className="text-xs border-b border-border py-1">
                      <span className="font-medium">{a.action}</span> · {new Date(a.created_at).toLocaleString('de-DE')} · {a.user_email ?? '–'}
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {tx && <ManualMatchDialog tx={tx} region={region} open={manual} onOpenChange={setManual} onBooked={() => { onChanged(); onClose(); }} />}
    </>
  );
}

function Row({ l, v }: { l: string; v: any }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-40 shrink-0">{l}</span>
      <span className="break-all">{v || '–'}</span>
    </div>
  );
}

export default TxDetailPanel;
