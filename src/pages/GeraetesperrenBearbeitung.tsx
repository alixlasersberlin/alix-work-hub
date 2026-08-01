import { useEffect, useMemo, useState } from 'react';
import { Lock, Upload, FileText, Search, CheckCircle2, Loader2, Ban, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseRuecklastCsv, parseRuecklastText, type RuecklastRow } from '@/lib/geraetesperren/parse';
import { GeraetesperrenTabs } from './GeraetesperrenTabs';

type Match = {
  row: RuecklastRow;
  invoice: any | null;
  note: string;
  selected: boolean;
};

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

export default function GeraetesperrenBearbeitung() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [q, setQ] = useState('');

  async function loadPending() {
    const { data } = await supabase
      .from('device_locks' as any)
      .select('*')
      .eq('status', 'vorschlag')
      .order('created_at', { ascending: false })
      .limit(300);
    setPending((data as any[]) ?? []);
  }
  useEffect(() => { loadPending(); }, []);

  async function extractText(f: File): Promise<RuecklastRow[]> {
    if (/\.csv$/i.test(f.name) || f.type.includes('csv')) return parseRuecklastCsv(await f.text());
    if (/\.txt$/i.test(f.name)) return parseRuecklastText(await f.text());
    const pdfjs: any = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
    let text = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      for (const it of content.items as any[]) {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) text += '\n';
        else text += ' ';
        text += it.str;
        lastY = y;
      }
      text += '\n';
    }
    return parseRuecklastText(text);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    setMatches([]);
    setImportId(null);
    try {
      const rows = await extractText(f);
      if (!rows.length) { toast.error('Keine Rücklastschriften erkannt'); return; }
      const { data: imp } = await supabase
        .from('device_lock_imports' as any)
        .insert({ filename: f.name, file_type: /\.csv$/i.test(f.name) ? 'csv' : 'pdf', row_count: rows.length, raw_rows: rows as any } as any)
        .select('id')
        .maybeSingle();
      setImportId((imp as any)?.id ?? null);
      toast.success(`${rows.length} Positionen gelesen – Rechnungen werden gesucht…`);
      await findInvoices(rows);
    } catch (err: any) {
      toast.error('Datei konnte nicht gelesen werden: ' + (err?.message ?? ''));
    } finally {
      setParsing(false);
    }
  }

  async function findInvoices(rows: RuecklastRow[]) {
    setMatching(true);
    try {
      const result: Match[] = [];
      for (const row of rows) {
        let inv: any = null;
        if (row.invoice_number) {
          const { data } = await supabase
            .from('zoho_invoices')
            .select('id,invoice_number,customer_id,customer_name,total,balance,status,currency,invoice_date')
            .ilike('invoice_number', `%${row.invoice_number}%`)
            .limit(1);
          inv = (data as any[])?.[0] ?? null;
        }
        if (!inv && row.customer_name) {
          let query = supabase
            .from('zoho_invoices')
            .select('id,invoice_number,customer_id,customer_name,total,balance,status,currency,invoice_date')
            .ilike('customer_name', `%${row.customer_name.split(/\s+/).slice(0, 2).join(' ')}%`)
            .order('invoice_date', { ascending: false })
            .limit(5);
          const { data } = await query;
          const list = (data as any[]) ?? [];
          inv = (row.amount != null ? list.find((i) => Math.abs(Number(i.total ?? 0) - row.amount!) < 0.02) : null) ?? list[0] ?? null;
        }
        result.push({
          row,
          invoice: inv,
          selected: !!inv,
          note: `Rücklastschrift${row.return_date ? ' vom ' + row.return_date : ''} – Rechnung ${inv?.invoice_number ?? row.invoice_number ?? '?'}${row.amount != null ? ' über ' + fmt(row.amount) : ''}${row.reason ? ' | ' + row.reason : ''}`,
        });
      }
      setMatches(result);
      toast.success(`${result.filter((r) => r.invoice).length} von ${result.length} Rechnungen zugeordnet`);
    } finally {
      setMatching(false);
    }
  }

  async function activate(selectedOnly = true) {
    const list = matches.filter((m) => (selectedOnly ? m.selected : true));
    if (!list.length) { toast.error('Keine Positionen ausgewählt'); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id ?? null;
      const payload = list.map((m) => ({
        invoice_id: m.invoice?.id ?? null,
        invoice_number: m.invoice?.invoice_number ?? m.row.invoice_number,
        customer_id: m.invoice?.customer_id ?? null,
        customer_number: m.invoice?.customer_id ?? null,
        customer_name: m.invoice?.customer_name ?? m.row.customer_name,
        amount: m.row.amount ?? m.invoice?.total ?? null,
        currency: m.invoice?.currency ?? 'EUR',
        return_date: m.row.return_date,
        return_reason: m.row.reason,
        lock_note: m.note,
        status: 'aktiv',
        source: 'rueck_import',
        import_id: importId,
        activated_at: new Date().toISOString(),
        activated_by: uid,
        created_by: uid,
      }));
      const { error } = await supabase.from('device_locks' as any).insert(payload as any);
      if (error) throw error;
      toast.success(`${payload.length} Gerätesperren aktiviert`);
      setMatches([]);
      setFile(null);
      loadPending();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function activatePending(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('device_locks' as any)
      .update({ status: 'aktiv', activated_at: new Date().toISOString(), activated_by: u?.user?.id ?? null } as any)
      .eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Sperre aktiviert');
    loadPending();
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return matches;
    const s = q.toLowerCase();
    return matches.filter(
      (m) =>
        (m.invoice?.invoice_number ?? m.row.invoice_number ?? '').toLowerCase().includes(s) ||
        (m.invoice?.customer_name ?? m.row.customer_name ?? '').toLowerCase().includes(s),
    );
  }, [matches, q]);

  const selectedCount = matches.filter((m) => m.selected).length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader icon={Lock} title="Gerätesperren · Bearbeitung" subtitle="Rücklastschriften importieren, Rechnungen zuordnen und Sperren aktivieren" noBreadcrumbs />
      <GeraetesperrenTabs />

      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-red-500" /> Rücklastschrift importieren (PDF / CSV)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".pdf,.csv,.txt" onChange={onFile} disabled={parsing || matching} className="max-w-md" />
          {file && <p className="text-xs text-muted-foreground flex items-center gap-2"><FileText className="w-3.5 h-3.5" />{file.name}</p>}
          {(parsing || matching) && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {parsing ? 'Datei wird gelesen…' : 'Rechnungen werden gesucht…'}
            </p>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Sperrvorschläge ({matches.length}) · {selectedCount} ausgewählt</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…" className="pl-8 w-56" />
              </div>
              <Button variant="outline" size="sm" onClick={() => setMatches((m) => m.map((x) => ({ ...x, selected: true })))}>Alle</Button>
              <Button variant="outline" size="sm" onClick={() => setMatches((m) => m.map((x) => ({ ...x, selected: false })))}>Keine</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={saving || !selectedCount} onClick={() => activate(true)}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />} Sperren aktivieren
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2">Rechnung</th>
                  <th className="p-2">Kd.-Nr.</th>
                  <th className="p-2">Kunde</th>
                  <th className="p-2 text-right">Betrag</th>
                  <th className="p-2">Rückl.-Datum</th>
                  <th className="p-2">Sperrvermerk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const idx = matches.indexOf(m);
                  return (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={m.selected}
                          onChange={(e) => setMatches((prev) => prev.map((x, j) => (j === idx ? { ...x, selected: e.target.checked } : x)))}
                          className="mt-2 accent-red-500"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {m.invoice ? (
                          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{m.invoice.invoice_number}</span>
                        ) : (
                          <span className="text-amber-500">{m.row.invoice_number ?? 'nicht gefunden'}</span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{m.invoice?.customer_id ?? '—'}</td>
                      <td className="p-2">{m.invoice?.customer_name ?? m.row.customer_name ?? '—'}</td>
                      <td className="p-2 text-right whitespace-nowrap">{fmt(m.row.amount ?? m.invoice?.total)}</td>
                      <td className="p-2 whitespace-nowrap">{m.row.return_date ?? '—'}</td>
                      <td className="p-2 min-w-[280px]">
                        <Textarea
                          value={m.note}
                          rows={2}
                          onChange={(e) => setMatches((prev) => prev.map((x, j) => (j === idx ? { ...x, note: e.target.value } : x)))}
                          className="text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Offene Sperrvorschläge ({pending.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadPending}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Keine offenen Vorschläge.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left"><tr><th className="p-2">Rechnung</th><th className="p-2">Kd.-Nr.</th><th className="p-2">Kunde</th><th className="p-2 text-right">Betrag</th><th className="p-2">Vermerk</th><th className="p-2"></th></tr></thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2">{p.invoice_number ?? '—'}</td>
                    <td className="p-2 font-mono text-xs">{p.customer_number ?? p.customer_id ?? '—'}</td>
                    <td className="p-2">{p.customer_name ?? '—'}</td>
                    <td className="p-2 text-right">{fmt(p.amount)}</td>
                    <td className="p-2 text-xs text-muted-foreground">{p.lock_note}</td>
                    <td className="p-2 text-right">
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => activatePending(p.id)}>Aktivieren</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
