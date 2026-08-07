import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { parseBankFile, applyMapping, guessMapping, duplicateHash, isReturnDebit } from '@/lib/bank/parse';
import type { ColumnMapping, ParsedTx, ParseResult } from '@/lib/bank/types';
import { listBankAccounts, logBank, type BankAccount } from '@/lib/bank/api';
import { loadOpenInvoices, scoreInvoices, scoreColor } from '@/lib/bank/matching';
import { loadMatchRules, payerKey } from '@/lib/bank/rules';
import ColumnMapper from '@/components/bank/ColumnMapper';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

export default function BankImport() {
  const { region } = useAccountingRegion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parsed, setParsed] = useState<ParsedTx[]>([]);
  const [hashes, setHashes] = useState<string[]>([]);
  const [dupIdx, setDupIdx] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [onlyNew, setOnlyNew] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);

  const account = accounts.find(a => a.id === accountId);

  useEffect(() => {
    listBankAccounts((region as any)).then(a => {
      setAccounts(a);
      setAccountId(prev => (a.some(x => x.id === prev) ? prev : (a[0]?.id ?? '')));
    }).catch(e => toast.error(e.message));
  }, [region]);

  useEffect(() => {
    if (!accountId) return;
    supabase.from('bank_import_templates' as any).select('*').eq('bank_account_id', accountId)
      .then(({ data }) => setTemplates(data ?? []));
  }, [accountId]);

  const reset = () => {
    setFile(null); setResult(null); setParsed([]); setHashes([]); setDupIdx(new Set()); setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!accountId) { toast.error('Bitte zuerst ein Bankkonto wählen.'); return; }
    setBusy(true); setFile(f);
    try {
      const r = await parseBankFile(f, account?.currency ?? (region === 'CH' ? 'CHF' : 'EUR'));
      setResult(r);
      if (r.needsMapping && r.headers) {
        const tpl = templates.find(t => t.file_format === r.format);
        const m = tpl?.column_mapping && Object.keys(tpl.column_mapping).length ? tpl.column_mapping : guessMapping(r.headers);
        setMapping(m);
        await recompute(r, m);
      } else {
        await recompute(r, {});
      }
      r.warnings.forEach(w => toast.warning(w));
    } catch (err: any) {
      toast.error('Datei konnte nicht gelesen werden: ' + err.message);
      reset();
    } finally { setBusy(false); }
  };

  const recompute = async (r: ParseResult, m: ColumnMapping) => {
    const txs = r.needsMapping && r.rows
      ? applyMapping(r.rows, m, account?.currency ?? 'EUR')
      : r.transactions;
    const hs = await Promise.all(txs.map(t => duplicateHash(t, accountId)));
    setParsed(txs); setHashes(hs);
    const uniq = [...new Set(hs)];
    const dup = new Set<number>();
    if (uniq.length) {
      for (let i = 0; i < uniq.length; i += 200) {
        const { data } = await supabase.from('bank_transactions' as any)
          .select('duplicate_hash').in('duplicate_hash', uniq.slice(i, i + 200));
        const known = new Set((data ?? []).map((d: any) => d.duplicate_hash));
        hs.forEach((h, idx) => { if (known.has(h)) dup.add(idx); });
      }
    }
    // Dubletten innerhalb der Datei
    const seen = new Map<string, number>();
    hs.forEach((h, idx) => { if (seen.has(h)) dup.add(idx); else seen.set(h, idx); });
    setDupIdx(dup);
  };

  useEffect(() => {
    if (result?.needsMapping) { recompute(result, mapping); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping]);

  const stats = useMemo(() => {
    const income = parsed.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = parsed.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    const dates = parsed.map(t => t.booking_date).filter(Boolean).sort() as string[];
    return {
      count: parsed.length, income, expense,
      from: dates[0] ?? null, to: dates[dates.length - 1] ?? null,
      invalid: parsed.filter(t => t.invalid).length,
      dups: dupIdx.size,
    };
  }, [parsed, dupIdx]);

  const saveTemplate = async () => {
    if (!result?.needsMapping) return;
    const name = window.prompt('Name der Importvorlage', `${account?.bank_name ?? 'Bank'} ${result.format.toUpperCase()}`);
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('bank_import_templates' as any).insert({
      bank_account_id: accountId, template_name: name, file_format: result.format,
      column_mapping: mapping as any, created_by: u?.user?.id ?? null,
    });
    if (error) toast.error(error.message); else toast.success('Importvorlage gespeichert');
  };

  const startImport = async () => {
    if (!file || !result || !accountId || !account) return;
    setBusy(true); setProgress(3);
    try {
      const { data: u } = await supabase.auth.getUser();
      // 1. Originaldatei archivieren
      const path = `${region}/${accountId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
      const up = await supabase.storage.from('bank-statements').upload(path, file, { upsert: false });
      if (up.error) toast.warning('Originaldatei konnte nicht archiviert werden: ' + up.error.message);
      setProgress(10);

      // 2. Import-Datensatz
      const { data: impData, error: impErr } = await supabase.from('bank_imports' as any).insert({
        bank_account_id: accountId,
        accounting_area: region,
        company_id: account.company_id ?? null,
        tenant_id: account.tenant_id ?? null,
        file_name: file.name, file_format: result.format, file_path: up.error ? null : path,
        period_from: stats.from, period_to: stats.to,
        total_transactions: 0, total_income: 0, total_expenses: 0,
        status: result.requiresReview ? 'pruefung_erforderlich' : 'importiert',
        imported_by: u?.user?.id ?? null,
      }).select().single();
      if (impErr) throw impErr;
      const imp = impData as any;

      await logBank({ action: 'datei_hochgeladen', bank_import_id: imp.id, new_value: { file: file.name, format: result.format } });
      if (result.needsMapping) await logBank({ action: 'spaltenzuordnung_gewaehlt', bank_import_id: imp.id, new_value: mapping });
      setProgress(20);

      // 3. Buchungen einfügen
      const selected = parsed
        .map((t, i) => ({ t, i }))
        .filter(({ t, i }) => (!skipInvalid || !t.invalid) && (!onlyNew || !dupIdx.has(i)));

      let inserted = 0, income = 0, expense = 0;
      const insertedRows: any[] = [];
      for (let i = 0; i < selected.length; i += 100) {
        const chunk = selected.slice(i, i + 100).map(({ t, i: idx }) => ({
          bank_account_id: accountId,
          bank_import_id: imp.id,
          accounting_area: region,
          company_id: account.company_id ?? null,
          tenant_id: account.tenant_id ?? null,
          booking_date: t.booking_date, value_date: t.value_date,
          amount: t.amount, currency: t.currency, transaction_type: t.transaction_type,
          sender_receiver_name: t.sender_receiver_name, sender_receiver_iban: t.sender_receiver_iban,
          bic: t.bic, booking_text: t.booking_text, purpose: t.purpose,
          bank_reference: t.bank_reference, end_to_end_reference: t.end_to_end_reference,
          mandate_reference: t.mandate_reference, customer_reference: t.customer_reference,
          raw_data: t.raw_data as any, duplicate_hash: hashes[idx],
          is_duplicate: dupIdx.has(idx),
          is_return_debit: isReturnDebit(t),
          status: dupIdx.has(idx) ? 'dublette' : 'offen',
        }));
        const { data, error } = await supabase.from('bank_transactions' as any).insert(chunk).select('id,amount,currency,purpose,booking_text,sender_receiver_name,sender_receiver_iban,end_to_end_reference,bank_reference,customer_reference,is_duplicate,is_return_debit,status');
        if (error) throw error;
        (data ?? []).forEach((r: any) => {
          insertedRows.push(r);
          inserted++;
          if (Number(r.amount) > 0) income += Number(r.amount); else expense += Number(r.amount);
        });
        setProgress(20 + Math.round((i / Math.max(1, selected.length)) * 45));
      }

      // 4. Automatischer Abgleich gegen offene Rechnungen
      setProgress(70);
      const invoices = await loadOpenInvoices((region as any));
      const rules = await loadMatchRules((region as any));
      let auto = 0, unmatched = 0, autoBooked = 0;
      for (const row of insertedRows) {
        if (row.is_duplicate || row.is_return_debit) { unmatched++; continue; }
        const key = payerKey(row);
        const rule = key ? rules.get(key) : undefined;
        const cands = scoreInvoices(row, invoices, new Set(), rule?.customer_id ?? null);
        const best = cands[0];
        if (!best) { unmatched++; continue; }
        await supabase.from('bank_transaction_matches' as any).insert(
          cands.slice(0, 5).map(c => ({
            bank_transaction_id: row.id,
            invoice_id: c.invoice.source === 'order' ? null : c.invoice.id,
            order_id: c.invoice.source === 'order' ? c.invoice.id : null,
            invoice_number: c.invoice.invoice_number,
            customer_id: c.invoice.source === 'order' ? (c.invoice.customer_id ?? null) : null,
            suggested_amount: Math.abs(Number(row.amount)),
            matching_score: c.score, matching_reasons: c.reasons as any, status: 'vorschlag',
          }))
        );
        const color = scoreColor(best.score);
        const status = color === 'gruen' ? 'sicher' : color === 'gelb' ? 'vorschlag' : 'offen';
        await supabase.from('bank_transactions' as any).update({
          matching_score: best.score, status,
          matched_invoice_id: best.invoice.source === 'order' ? null : best.invoice.id,
          matched_customer_id: best.invoice.source === 'order' ? (best.invoice.customer_id ?? null) : null,
        }).eq('id', row.id);
        if (color === 'rot') unmatched++; else auto++;
      }

      // 5. Optionale automatische Verbuchung
      if (account.automatic_booking_enabled) {
        const { data: greens } = await supabase.from('bank_transactions' as any)
          .select('*').eq('bank_import_id', imp.id).eq('status', 'sicher')
          .gte('matching_score', account.auto_book_threshold ?? 95);
        for (const g of (greens ?? []) as any[]) {
          try {
            const { bookTransaction } = await import('@/lib/bank/api');
            if (!g.matched_invoice_id) continue; // Auftrags-Treffer nur manuell verbuchen
            await bookTransaction(g, [{
              invoice_id: g.matched_invoice_id, allocation_type: 'rechnung',
              allocated_amount: Math.abs(Number(g.amount)),
            }]);
            autoBooked++;
          } catch { /* bei Fehlern bleibt die Buchung offen */ }
        }
      }

      await supabase.from('bank_imports' as any).update({
        total_transactions: inserted, total_income: income, total_expenses: expense,
        duplicates_count: dupIdx.size, auto_matched_count: auto, unmatched_count: unmatched,
        status: result.requiresReview ? 'pruefung_erforderlich' : 'verarbeitet',
      }).eq('id', imp.id);
      await logBank({ action: 'import_abgeschlossen', bank_import_id: imp.id, new_value: { inserted, auto, unmatched, autoBooked } });

      setProgress(100);
      toast.success(`${inserted} Buchungen importiert · ${auto} automatisch zugeordnet${autoBooked ? ` · ${autoBooked} automatisch verbucht` : ''}`);
      reset();
    } catch (e: any) {
      toast.error('Import fehlgeschlagen: ' + e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" />Kontoauszug importieren</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
            <div className="space-y-1">
              <Label>Bankkonto ({region})</Label>
              <select className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
                value={accountId} onChange={e => { setAccountId(e.target.value); reset(); }}>
                {!accounts.length && <option value="">Kein Bankkonto angelegt</option>}
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name} · {a.iban ?? ''} ({a.currency})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Datei (PDF, CSV, XLS/XLSX, MT940/942, CAMT.052/053/054, XML, TXT, OFX, QIF, DATEV)</Label>
              <Input ref={fileRef} type="file" disabled={!accountId || busy}
                accept=".pdf,.csv,.txt,.xls,.xlsx,.xml,.sta,.mt940,.940,.942,.ofx,.qif" onChange={onFile} />
            </div>
          </div>
          {busy && <Progress value={progress || undefined} className="h-2" />}
        </CardContent>
      </Card>

      {result?.needsMapping && result.headers && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Zuordnungsassistent · Format {result.format.toUpperCase()}</CardTitle>
            <Button size="sm" variant="outline" onClick={saveTemplate}>Als Importvorlage speichern</Button>
          </CardHeader>
          <CardContent><ColumnMapper headers={result.headers} mapping={mapping} onChange={setMapping} /></CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" />Importvorschau</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 text-sm">
              <Info l="Dateiname" v={file?.name} />
              <Info l="Format" v={result.format.toUpperCase()} />
              <Info l="Bankkonto" v={`${account?.bank_name ?? ''} · ${account?.account_name ?? ''}`} />
              <Info l="Buchhaltung" v={region} />
              <Info l="Erkannte Buchungen" v={String(stats.count)} />
              <Info l="Zeitraum" v={stats.from ? `${stats.from} – ${stats.to}` : '–'} />
              <Info l="Summe Eingänge" v={fmt(stats.income, account?.currency)} />
              <Info l="Summe Ausgänge" v={fmt(stats.expense, account?.currency)} />
              <Info l="Mögliche Dubletten" v={String(stats.dups)} />
              <Info l="Fehlerhafte Datensätze" v={String(stats.invalid)} />
            </div>

            {result.requiresReview && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                <span>Prüfung erforderlich: Die Datei konnte nicht eindeutig ausgelesen werden. Buchungen werden nicht automatisch verbucht.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={skipInvalid} onChange={e => setSkipInvalid(e.target.checked)} />Fehlerhafte Buchungen überspringen</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={onlyNew} onChange={e => setOnlyNew(e.target.checked)} />Nur neue Buchungen importieren</label>
            </div>

            <div className="overflow-x-auto rounded-md border border-border max-h-96">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0"><tr className="text-left">
                  <th className="p-2">Datum</th><th className="p-2">Valuta</th><th className="p-2">Name</th>
                  <th className="p-2">Verwendungszweck</th><th className="p-2 text-right">Betrag</th><th className="p-2">Hinweis</th>
                </tr></thead>
                <tbody>
                  {parsed.slice(0, 200).map((t, i) => (
                    <tr key={i} className={`border-t border-border ${dupIdx.has(i) ? 'bg-amber-500/10' : t.invalid ? 'bg-red-500/10' : ''}`}>
                      <td className="p-2">{t.booking_date ?? '–'}</td>
                      <td className="p-2">{t.value_date ?? '–'}</td>
                      <td className="p-2">{t.sender_receiver_name ?? '–'}</td>
                      <td className="p-2 max-w-md truncate" title={t.purpose ?? ''}>{t.purpose ?? '–'}</td>
                      <td className={`p-2 text-right font-medium ${t.amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{fmt(t.amount, t.currency)}</td>
                      <td className="p-2">
                        {dupIdx.has(i) && <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">Dublette</Badge>}
                        {t.invalid && <Badge className="bg-red-500/15 text-red-500 border-red-500/30">Unvollständig</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 200 && <p className="p-2 text-xs text-muted-foreground">… {parsed.length - 200} weitere Buchungen</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={startImport} disabled={busy || !parsed.length}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}Import starten
              </Button>
              <Button variant="outline" onClick={reset} disabled={busy}>Import abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Info({ l, v }: { l: string; v?: string | null }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[11px] uppercase text-muted-foreground">{l}</div>
      <div className="font-medium break-all">{v || '–'}</div>
    </div>
  );
}
