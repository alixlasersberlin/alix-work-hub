import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, Search, Pencil, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import TxDetailPanel from '@/components/bank/TxDetailPanel';
import ReturnDebitDialog from '@/components/bank/ReturnDebitDialog';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { revisionCategories, revisionStatuses, validRevisionReview, type RevisionCase } from '@/lib/finance/revision';

const money = (amount: number, currency: string) => Number(amount).toLocaleString('de-DE', { style: 'currency', currency });
export default function Revision() {
  const { region } = useAccountingRegion();
  const [rows, setRows] = useState<RevisionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RevisionCase | null>(null);
  const [note, setNote] = useState('');
  const [reviewStatus, setReviewStatus] = useState('in_progress');
  const [saving, setSaving] = useState(false);
  const [tx, setTx] = useState<Record<string, unknown> | null>(null);
  const [returnTx, setReturnTx] = useState<Record<string, unknown> | null>(null);
  async function load() {
    setLoading(true); setError('');
    const { data, error: failure } = await supabase.rpc('revision_cases');
    if (failure) { setError(failure.message); setRows([]); }
    else setRows((data ?? []) as unknown as RevisionCase[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  const scoped = useMemo(() => rows.filter(r => String(region) === 'ALL' || (region === 'CH' ? r.currency === 'CHF' : r.currency !== 'CHF')), [rows, region]);
  const visible = scoped.filter(r => (category === 'all' || r.category === category) && (status === 'all' || r.review_status === status) && `${r.customer_name ?? ''} ${r.invoice_number ?? ''} ${r.reason}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  async function save() {
    if (!selected || !validRevisionReview(reviewStatus, note)) return;
    setSaving(true);
    const { data, error: failure } = await supabase.rpc('revision_review', { p_case_key: selected.case_key, p_status: reviewStatus, p_note: note });
    setSaving(false);
    if (failure) toast.error(failure.message);
    else {
      const result = data as { settled?: boolean; fully_paid?: boolean; balance?: number } | null;
      toast.success(result?.settled ? (result.fully_paid ? 'Belegte Zahlung verrechnet – Rechnung ausgeglichen' : `Belegte Zahlung verrechnet – Restbetrag ${money(result.balance ?? 0, selected.currency)}`) : 'Prüfvermerk gespeichert');
      setSelected(null); await load();
    }
  }
  async function edit(r: RevisionCase) {
    const { data, error: failure } = await supabase.from('bank_transactions').select('*').eq('id', r.transaction_id).maybeSingle();
    if (failure || !data) { toast.error(failure?.message ?? 'Bankumsatz nicht verfügbar'); return; }
    if (r.category === 'return') setReturnTx(data); else setTx(data);
  }
  return <div className="container mx-auto space-y-6 px-4 py-6">
    <PageHeader title="REVISION" icon={ShieldCheck} actions={<Button variant="outline" onClick={load} disabled={loading} aria-label="Revision aktualisieren"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>} />
    <div className="grid grid-cols-2 gap-4 border-y border-border py-5 lg:grid-cols-4">{Object.entries(revisionCategories).map(([key, name]) => <div key={key}><div className="text-sm text-muted-foreground">{name}</div><div className="mt-1 text-3xl font-semibold">{scoped.filter(r => r.category === key).length}</div></div>)}</div>
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Kunde oder Rechnung suchen" placeholder="Kunde oder Rechnung" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-full sm:w-64" aria-label="Fallart"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Fallarten</SelectItem>{Object.entries(revisionCategories).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full sm:w-56" aria-label="Prüfstatus"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Alle Prüfstatus</SelectItem>{Object.entries(revisionStatuses).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select>
    </div>
    {error && <div role="alert" className="border border-destructive p-4 text-destructive">{error}</div>}
    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Kunde / Rechnung</TableHead><TableHead>Prüffall</TableHead><TableHead className="text-right">Betrag</TableHead><TableHead>Status</TableHead><TableHead>Bearbeitung</TableHead></TableRow></TableHeader><TableBody>
      {loading ? <TableRow><TableCell colSpan={6}>Wird geladen…</TableCell></TableRow> : visible.length === 0 ? <TableRow><TableCell colSpan={6} className="text-muted-foreground">Keine Prüffälle</TableCell></TableRow> : visible.map(r => <TableRow key={r.case_key}>
        <TableCell className="whitespace-nowrap">{r.booking_date ? new Date(`${r.booking_date}T12:00:00`).toLocaleDateString('de-DE') : '–'}</TableCell>
        <TableCell><div className="font-medium">{r.customer_name ?? 'Nicht hinterlegt'}</div><div className="text-sm text-muted-foreground">{r.invoice_number ?? '–'}</div></TableCell>
        <TableCell className="min-w-52"><div>{revisionCategories[r.category]}</div><div className="max-w-sm text-xs text-muted-foreground">{r.reason}</div></TableCell>
        <TableCell className="whitespace-nowrap text-right font-medium">{money(r.amount, r.currency)}</TableCell>
        <TableCell><Badge variant={r.review_status === 'clarification' ? 'destructive' : 'outline'}>{revisionStatuses[r.review_status]}</Badge></TableCell>
        <TableCell><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setSelected(r); setNote(''); setReviewStatus(r.review_status); }}><Pencil className="mr-2 h-3 w-3" />Prüfen</Button><Button variant="ghost" size="icon" aria-label="Buchung öffnen" title="Buchung öffnen" onClick={() => edit(r)}><ExternalLink className="h-4 w-4" /></Button></div></TableCell>
      </TableRow>)}
    </TableBody></Table></div>
    <div className="text-sm text-muted-foreground">{visible.length} Prüffälle · {new Set(visible.map(r => r.transaction_id)).size} Bankumsätze</div>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.customer_name ?? 'Prüffall'} · {selected?.invoice_number ?? 'Bankumsatz'}</DialogTitle></DialogHeader>
      <p className="text-sm">{selected?.reason}</p><Label>Prüfstatus</Label><Select value={reviewStatus} onValueChange={setReviewStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(revisionStatuses).map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select>
      <Label htmlFor="revision-note">Prüfvermerk</Label><Textarea id="revision-note" value={note} onChange={e => setNote(e.target.value)} maxLength={4000} />
      {selected?.history.map((h, i) => <div key={`${h.at}-${i}`} className="border-t border-border pt-3 text-sm"><div className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString('de-DE')} · {revisionStatuses[h.status]}</div><p className="whitespace-pre-wrap">{h.note}</p></div>)}
      <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Abbrechen</Button><Button onClick={save} disabled={saving || !validRevisionReview(reviewStatus, note)}>{reviewStatus === 'reviewed' ? 'Prüfung abschließen & Zahlung verrechnen' : 'Prüfvermerk speichern'}</Button></DialogFooter>
    </DialogContent></Dialog>
    <TxDetailPanel tx={tx} region={tx?.currency === 'CHF' ? 'CH' : 'EU'} onClose={() => setTx(null)} onChanged={load} />
    {returnTx && <ReturnDebitDialog tx={returnTx} region={returnTx.currency === 'CHF' ? 'CH' : 'EU'} open onOpenChange={open => { if (!open) setReturnTx(null); }} onChanged={load} />}
  </div>;
}