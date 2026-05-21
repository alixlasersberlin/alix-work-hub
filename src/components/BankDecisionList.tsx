import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BankFinancingTab from '@/components/BankFinancingTab';
import { Search, Loader2, Inbox, Eye, Trash2, Pencil, ArrowUp, ArrowDown, ArrowUpDown, CalendarDays, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  status: 'approved' | 'rejected' | 'pending' | Array<'approved' | 'rejected' | 'pending' | 'in_review'>;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyText: string;
  allowDelete?: boolean;
}

export default function BankDecisionList({ status, title, subtitle, icon: Icon, emptyText, allowDelete = false }: Props) {
  const [toDelete, setToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [toSend, setToSend] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error: err } = await supabase
      .from('bank_financing_requests')
      .delete()
      .eq('id', toDelete.id);
    setDeleting(false);
    if (err) {
      toast.error('Löschen fehlgeschlagen: ' + err.message);
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== toDelete.id));
    toast.success('Anfrage gelöscht. Auftrag steht wieder unter „Verfügbare Aufträge".');
    setToDelete(null);
  };

  const formatAddress = (addr: any): string => {
    if (!addr || typeof addr !== 'object') return '';
    const parts = [
      addr.attention || addr.contact_name,
      addr.address || addr.street,
      addr.street2,
      [addr.zip || addr.postal_code, addr.city].filter(Boolean).join(' '),
      addr.state,
      addr.country,
    ].filter((p) => p && String(p).trim().length > 0);
    return parts.join(', ');
  };

  const handleSend = async () => {
    if (!toSend) return;
    setSending(true);
    try {
      const { data: full, error: fetchErr } = await supabase
        .from('bank_financing_requests')
        .select('id, order_id, request_date, purchase_price, down_payment, term_months, residual_value, decision_note, in_processing_note, orders(order_number, order_date, total_amount, currency, billing_address, shipping_address, customers(company_name, contact_name, email, phone, billing_address, shipping_address))')
        .eq('id', toSend.id)
        .single();
      if (fetchErr || !full) throw new Error(fetchErr?.message || 'Anfrage nicht gefunden');

      const o: any = full.orders;
      const cust: any = o?.customers;
      const addr = cust?.billing_address || cust?.shipping_address || o?.billing_address || o?.shipping_address;
      const templateData = {
        orderNumber: o?.order_number ?? '',
        customerName: cust?.company_name || cust?.contact_name || '',
        customerAddress: formatAddress(addr),
        customerEmail: cust?.email || '',
        customerPhone: cust?.phone || '',
        purchasePrice: full.purchase_price,
        downPayment: full.down_payment,
        termMonths: full.term_months,
        residualValue: full.residual_value,
        requestDate: full.request_date
          ? new Date(full.request_date).toLocaleDateString('de-DE')
          : '',
        totalAmount: o?.total_amount,
        currency: o?.currency || 'EUR',
        note: full.in_processing_note || full.decision_note || '',
      };

      const recipients = ['gregor.polywka@hoenen-leasing.de', 'l.scheidler@alix-operation.de'];

      const { error: sendErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'bank-financing-request',
          recipientEmail: recipients[0],
          idempotencyKey: `bank-req-${full.id}-${Date.now()}`,
          templateData,
          extraCc: recipients.slice(1),
        },
      });
      if (sendErr) throw new Error(sendErr.message);

      if (full.order_id) {
        await supabase.from('order_notes').insert({
          order_id: full.order_id,
          note_type: 'email',
          is_internal: true,
          note_text: `Leasing-Anfrage per E-Mail versendet an: ${recipients.join(', ')} (Auftrag ${o?.order_number || ''}).`,
        });
      }

      toast.success('Anfrage erfolgreich per E-Mail versendet und in der Akte gespeichert.');
      setToSend(null);
    } catch (e: any) {
      toast.error('Versand fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setSending(false);
    }
  };


  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [weekSearch, setWeekSearch] = useState('');
  type SortKey = 'order_number' | 'customer' | 'order_date' | 'amount' | 'decided_at' | 'note';
  const [sortKey, setSortKey] = useState<SortKey>('decided_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const getIsoWeek = (d: Date) => {
    const target = new Date(d.valueOf());
    target.setHours(0, 0, 0, 0);
    target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
    const jan4 = new Date(target.getFullYear(), 0, 4);
    const week = 1 + Math.round(((target.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return { week, year: target.getFullYear() };
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from('bank_financing_requests')
        .select('id, status, decided_at, decision_note, order_id, orders(id, order_number, order_date, total_amount, currency, order_status, customers(company_name, contact_name))')
        .order('decided_at', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (Array.isArray(status)) q = q.in('status', status);
      else q = q.eq('status', status);
      const { data, error: err } = await q;
      if (err) setError(err.message);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [Array.isArray(status) ? status.join(',') : status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wRaw = weekSearch.trim().toLowerCase().replace(/^kw\s*/, '');
    let wantedWeek: number | null = null;
    let wantedYear: number | null = null;
    if (wRaw) {
      const m = wRaw.match(/^(\d{1,2})(?:[\/\-](\d{2,4}))?$/);
      if (m) {
        wantedWeek = parseInt(m[1], 10);
        if (m[2]) wantedYear = parseInt(m[2].length === 2 ? '20' + m[2] : m[2], 10);
      }
    }
    let res = rows.filter((r) => {
      const o = r.orders;
      const name = o?.customers?.company_name || o?.customers?.contact_name || '';
      if (q && !((o?.order_number || '').toLowerCase().includes(q) || name.toLowerCase().includes(q))) return false;
      if (wantedWeek != null) {
        if (!r.decided_at) return false;
        const { week, year } = getIsoWeek(new Date(r.decided_at));
        if (week !== wantedWeek) return false;
        if (wantedYear != null && year !== wantedYear) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const valOf = (r: any) => {
      const o = r.orders || {};
      switch (sortKey) {
        case 'order_number': return (o.order_number || '').toLowerCase();
        case 'customer': return (o.customers?.company_name || o.customers?.contact_name || '').toLowerCase();
        case 'order_date': return o.order_date ? new Date(o.order_date).getTime() : 0;
        case 'amount': return o.total_amount == null ? -Infinity : Number(o.total_amount);
        case 'decided_at': return r.decided_at ? new Date(r.decided_at).getTime() : 0;
        case 'note': return (r.decision_note || '').toLowerCase();
      }
    };
    res = [...res].sort((a, b) => {
      const va = valOf(a), vb = valOf(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return res;
  }, [rows, search, weekSearch, sortKey, sortDir]);

  const fmtMoney = (v: number | null, c?: string | null) =>
    v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? <ArrowUpDown className="h-3 w-3 opacity-50" /> :
    sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  const SortableHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        <SortIcon k={k} />
      </button>
    </TableHead>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Icon className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>Übersicht ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-52">
              <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="KW (z. B. 42 oder 42-2026)"
                value={weekSearch}
                onChange={(e) => setWeekSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche Auftrag / Kunde…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-destructive text-sm py-10 text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <p className="text-sm">{emptyText}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead k="order_number">Auftragsnr.</SortableHead>
                    <SortableHead k="customer">Kunde</SortableHead>
                    <SortableHead k="order_date">Auftragsdatum</SortableHead>
                    <SortableHead k="amount" className="text-right">Betrag</SortableHead>
                    <SortableHead k="decided_at">Anfrage gestellt</SortableHead>
                    {status === 'rejected' && <SortableHead k="note">Grund</SortableHead>}
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const o = r.orders;
                    if (!o) return null;
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>
                        <TableCell className="font-medium">{o.order_number || '—'}</TableCell>
                        <TableCell>{o.customers?.company_name || o.customers?.contact_name || '—'}</TableCell>
                        <TableCell>{fmtDate(o.order_date)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(o.total_amount, o.currency)}</TableCell>
                        <TableCell>{r.decided_at ? new Date(r.decided_at).toLocaleDateString('de-DE') : '—'}</TableCell>
                        {status === 'rejected' && (
                          <TableCell className="max-w-[260px] truncate text-muted-foreground" title={r.decision_note || ''}>
                            {r.decision_note || '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); navigate(`/auftraege/${o.id}`); }}
                              title="Auftrag öffnen"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setEditRow(r); }}
                              title="Anfrage bearbeiten"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setToSend(r); }}
                              title="Anfrage per E-Mail versenden"
                              className="text-primary hover:text-primary"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            {allowDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); setToDelete(r); }}
                                title="Anfrage löschen"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anfrage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Finanzierungs-Anfrage für Auftrag{' '}
              <span className="font-medium">{toDelete?.orders?.order_number || '—'}</span>{' '}
              wird gelöscht. Der Auftrag erscheint danach wieder unter „Verfügbare Aufträge".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Lösche…' : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Anfrage bearbeiten – {editRow?.orders?.order_number || '—'}
            </DialogTitle>
          </DialogHeader>
          {editRow && <BankFinancingTab orderId={editRow.order_id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
