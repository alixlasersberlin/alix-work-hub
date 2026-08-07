import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileDown, Loader2, Search, RefreshCw, Trash2 } from 'lucide-react';
import { listBankAccounts, listTransactions, deleteTransactions, type BankAccount } from '@/lib/bank/api';
import { useCanDelete } from '@/hooks/useCanDelete';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import BankStatusBadge from '@/components/bank/BankStatusBadge';
import TxDetailPanel from '@/components/bank/TxDetailPanel';
import BankLoadErrorPanel from '@/components/bank/BankLoadErrorPanel';
import { describeBankLoadError, type BankLoadError } from '@/lib/bank/loadError';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

export default function TxListPage({
  title, statuses, description,
}: { title: string; statuses?: string[]; description?: string }) {
  const { region } = useAccountingRegion();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'' | 'eingang' | 'ausgang'>('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const canDelete = useCanDelete();
  const pageSize = 50;
  const [loadError, setLoadError] = useState<BankLoadError | null>(null);
  const [accountsError, setAccountsError] = useState<BankLoadError | null>(null);

  useEffect(() => {
    listBankAccounts((region as any))
      .then(a => { setAccounts(a); setAccountsError(null); })
      .catch(e => setAccountsError(describeBankLoadError(e, 'GET /rest/v1/bank_accounts')));
  }, [region]);
  useEffect(() => { setPage(0); }, [region, accountId, search, direction, status, from, to, amountMin, amountMax]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listTransactions({
        area: region,
        status: status ? [status] : statuses,
        bankAccountId: accountId || undefined,
        search: search || undefined,
        direction: direction || undefined,
        from: from || undefined, to: to || undefined,
        amountMin: amountMin ? Number(amountMin) : undefined,
        amountMax: amountMax ? Number(amountMax) : undefined,
        page, pageSize,
      });
      setRows(res.rows); setCount(res.count); setChecked([]);
    } catch (e: any) {
      const err = describeBankLoadError(e, 'GET /rest/v1/bank_transactions');
      setLoadError(err);
      toast.error(`${err.message} (${err.correlationId})`);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [region, accountId, search, direction, status, from, to, amountMin, amountMax, page, JSON.stringify(statuses)]);

  const sums = useMemo(() => ({
    income: rows.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0),
    expense: rows.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Number(r.amount), 0),
  }), [rows]);

  const exportRows = () => rows.map(r => ({
    Buchungsdatum: r.booking_date, Wertstellung: r.value_date,
    Betrag: Number(r.amount), Waehrung: r.currency,
    Richtung: r.transaction_type, Name: r.sender_receiver_name ?? '',
    IBAN: r.sender_receiver_iban ?? '', Buchungstext: r.booking_text ?? '',
    Verwendungszweck: r.purpose ?? '', Status: r.status, Score: r.matching_score ?? '',
  }));

  const exportCsv = () => {
    const data = exportRows();
    if (!data.length) return toast.error('Keine Daten zum Export');
    const head = Object.keys(data[0]);
    const csv = [head.join(';'), ...data.map(r => head.map(h => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bankbuchungen_${region}.csv`; a.click();
    URL.revokeObjectURL(url);

  };

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Buchungen');
    XLSX.writeFile(wb, `bankbuchungen_${region}.xlsx`);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(13);
    doc.text(`${title} · Buchhaltung ${region}`, 14, 14);
    autoTable(doc, {
      startY: 20, styles: { fontSize: 7 },
      head: [['Datum', 'Name', 'Verwendungszweck', 'Betrag', 'Status', 'Score']],
      body: rows.map(r => [r.booking_date ?? '', r.sender_receiver_name ?? '', (r.purpose ?? '').slice(0, 70), fmt(Number(r.amount), r.currency), r.status, r.matching_score ?? '']),
    });
    doc.save(`bankbuchungen_${region}.pdf`);
  };

  const toggle = (id: string) =>
    setChecked(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);

  const removeSelected = async () => {
    if (!checked.length) return;
    if (!window.confirm(`${checked.length} Buchung(en) endgültig löschen? Zugehörige Zuordnungen und Rücklastschriften werden ebenfalls entfernt.`)) return;
    setDeleting(true);
    try {
      await deleteTransactions(checked);
      toast.success(`${checked.length} Buchung(en) gelöscht`);
      if (selected && checked.includes(selected.id)) setSelected(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      {loadError && <BankLoadErrorPanel error={loadError} onRetry={load} />}
      {accountsError && !loadError && <BankLoadErrorPanel error={accountsError} />}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" />Aktualisieren</Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><FileDown className="w-3.5 h-3.5 mr-1" />CSV</Button>
            <Button size="sm" variant="outline" onClick={exportXlsx}><FileDown className="w-3.5 h-3.5 mr-1" />Excel</Button>
            <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="w-3.5 h-3.5 mr-1" />PDF</Button>
            {canDelete && (
              <Button size="sm" variant="destructive" disabled={!checked.length || deleting} onClick={removeSelected}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                Löschen{checked.length ? ` (${checked.length})` : ''}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-3 text-muted-foreground" />
              <Input className="pl-8" placeholder="Suche: Auftragsnr., Rechnungsnr., Kundenname, IBAN, Verwendungszweck" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="h-10 rounded-md border border-border bg-background px-2 text-sm" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Alle Bankkonten</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name}</option>)}
            </select>
            <select className="h-10 rounded-md border border-border bg-background px-2 text-sm" value={direction} onChange={e => setDirection(e.target.value as any)}>
              <option value="">Eingang &amp; Ausgang</option>
              <option value="eingang">Nur Zahlungseingänge</option>
              <option value="ausgang">Nur Zahlungsausgänge</option>
            </select>
            {!statuses && (
              <select className="h-10 rounded-md border border-border bg-background px-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Alle Status</option>
                {['offen', 'sicher', 'vorschlag', 'verbucht', 'zurueckgestellt', 'ignoriert', 'dublette'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            <Input type="number" step="0.01" placeholder="Betrag von" value={amountMin} onChange={e => setAmountMin(e.target.value)} />
            <Input type="number" step="0.01" placeholder="Betrag bis" value={amountMax} onChange={e => setAmountMax(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{count} Buchungen</span>
            <span className="text-emerald-500">Eingänge (Seite): {fmt(sums.income)}</span>
            <span className="text-red-500">Ausgänge (Seite): {fmt(sums.expense)}</span>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40"><tr className="text-left">
                {canDelete && (
                  <th className="p-2 w-8">
                    <input type="checkbox" aria-label="Alle auswählen"
                      checked={!!rows.length && checked.length === rows.length}
                      onChange={e => setChecked(e.target.checked ? rows.map(r => r.id) : [])} />
                  </th>
                )}
                <th className="p-2">Datum</th><th className="p-2">Bankkonto</th><th className="p-2">Kundenname</th>
                <th className="p-2">Verwendungszweck</th><th className="p-2 text-right">Betrag</th>
                <th className="p-2">Status</th><th className="p-2">Hinweis</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={canDelete ? 8 : 7} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
                {!loading && !rows.length && <tr><td colSpan={canDelete ? 8 : 7} className="p-6 text-center text-muted-foreground">Keine Buchungen gefunden.</td></tr>}
                {!loading && rows.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(r)}>
                    {canDelete && (
                      <td className="p-2" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" aria-label="Buchung auswählen"
                          checked={checked.includes(r.id)} onChange={() => toggle(r.id)} />
                      </td>
                    )}
                    <td className="p-2 whitespace-nowrap">{r.booking_date}</td>
                    <td className="p-2 whitespace-nowrap">{r.bank_accounts?.bank_name ?? '–'}</td>
                    <td className="p-2">{r.sender_receiver_name ?? '–'}</td>
                    <td className="p-2 max-w-sm truncate" title={r.purpose ?? ''}>{r.purpose ?? '–'}</td>
                    <td className={`p-2 text-right font-medium ${Number(r.amount) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(Number(r.amount), r.currency)}</td>
                    <td className="p-2"><BankStatusBadge status={r.status} score={r.matching_score} /></td>
                    <td className="p-2 space-x-1">
                      {r.is_duplicate && <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Dublette</Badge>}
                      {r.is_return_debit && <Badge className="bg-red-500/15 text-red-500 border-red-500/30">Rücklastschrift</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span>Seite {page + 1} von {Math.max(1, Math.ceil(count / pageSize))}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Zurück</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= count} onClick={() => setPage(p => p + 1)}>Weiter</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <TxDetailPanel tx={selected} region={region as any} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}
