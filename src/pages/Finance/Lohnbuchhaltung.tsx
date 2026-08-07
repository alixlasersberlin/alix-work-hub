import { useEffect, useMemo, useState } from 'react';
import { Users, RefreshCw, Download, Plus, Trash2, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { KpiTile } from '@/components/infinity/KpiTile';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useAuth } from '@/hooks/useAuth';

interface Run {
  id: string; accounting_region: string; period_year: number; period_month: number;
  label: string | null; status: string; currency: string;
  total_gross: number | null; total_deductions: number | null; total_net: number | null;
  total_employer_cost: number | null; employee_count: number | null; notes: string | null;
  created_at: string;
}
interface Line {
  id: string; run_id: string; employee_name: string; employee_number: string | null;
  wage_type_code: string | null; wage_type_name: string | null; kind: string;
  amount: number | null; account_number: string | null; cost_center: string | null;
}
interface WageType {
  id: string; accounting_region: string; code: string; name: string; kind: string;
  percentage: number | null; account_number: string | null; is_active: boolean; sort_order: number;
}
interface SocialRate {
  id: string; accounting_region: string; code: string; name: string;
  employee_rate: number; employer_rate: number; valid_from: string; valid_to: string | null;
  account_number: string | null; is_active: boolean;
}

const KIND_LABEL: Record<string, string> = {
  earning: 'Lohn / Gehalt',
  deduction: 'Abzug',
  employer_contribution: 'AG-Beitrag',
};
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function csv(rows: (string | number)[][]) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
}
function download(name: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Lohnbuchhaltung() {
  const { region } = useAccountingRegion();
  const { hasRole } = useAuth();
  const canDelete = hasRole('Super Admin');
  const cur = region === 'CH' ? 'CHF' : 'EUR';
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: cur });

  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [wageTypes, setWageTypes] = useState<WageType[]>([]);
  const [rates, setRates] = useState<SocialRate[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  // Dialog-States
  const [newRunMonth, setNewRunMonth] = useState(new Date().getMonth() + 1);
  const [runDialog, setRunDialog] = useState(false);
  const [lineDialog, setLineDialog] = useState(false);
  const [lineForm, setLineForm] = useState({
    employee_name: '', employee_number: '', wage_type_code: '', kind: 'earning',
    amount: '', cost_center: '',
  });

  async function load() {
    setLoading(true);
    const [rRes, wRes, sRes] = await Promise.all([
      (supabase as any).from('finance_payroll_runs').select('*')
        .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).eq('period_year', year)
        .order('period_month', { ascending: true }),
      (supabase as any).from('finance_wage_types').select('*')
        .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).order('sort_order', { ascending: true }),
      (supabase as any).from('finance_social_rates').select('*')
        .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).order('code', { ascending: true }),
    ]);
    if (rRes.error) toast.error(rRes.error.message);
    if (wRes.error) toast.error(wRes.error.message);
    if (sRes.error) toast.error(sRes.error.message);
    const list = (rRes.data || []) as Run[];
    setRuns(list);
    setWageTypes((wRes.data || []) as WageType[]);
    setRates((sRes.data || []) as SocialRate[]);
    if (list.length && !list.some(r => r.id === selectedRun)) setSelectedRun(list[list.length - 1].id);
    if (!list.length) { setSelectedRun(null); setLines([]); }
    setLoading(false);
  }

  async function loadLines(runId: string) {
    const { data, error } = await (supabase as any)
      .from('finance_payroll_lines').select('*')
      .eq('run_id', runId).order('employee_name', { ascending: true }).limit(5000);
    if (error) { toast.error(error.message); return; }
    setLines((data || []) as Line[]);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region, year]);
  useEffect(() => { if (selectedRun) loadLines(selectedRun); }, [selectedRun]);

  const run = runs.find(r => r.id === selectedRun) || null;

  const totals = useMemo(() => runs.reduce((t, r) => ({
    gross: t.gross + Number(r.total_gross || 0),
    deductions: t.deductions + Number(r.total_deductions || 0),
    net: t.net + Number(r.total_net || 0),
    employer: t.employer + Number(r.total_employer_cost || 0),
  }), { gross: 0, deductions: 0, net: 0, employer: 0 }), [runs]);

  const perEmployee = useMemo(() => {
    const map = new Map<string, { name: string; number: string; gross: number; deductions: number; employer: number }>();
    for (const l of lines) {
      const key = l.employee_name;
      if (!map.has(key)) map.set(key, { name: key, number: l.employee_number || '', gross: 0, deductions: 0, employer: 0 });
      const e = map.get(key)!;
      const amt = Number(l.amount || 0);
      if (l.kind === 'earning') e.gross += amt;
      else if (l.kind === 'deduction') e.deductions += amt;
      else e.employer += amt;
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [lines]);

  async function createRun() {
    const wt = wageTypes; // noop guard
    void wt;
    const { data, error } = await (supabase as any).from('finance_payroll_runs').insert({
      accounting_region: (String(region) === 'ALL' ? 'EU' : region),
      period_year: year,
      period_month: newRunMonth,
      label: `${MONTHS[newRunMonth - 1]} ${year}`,
      currency: cur,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success('Lohnlauf angelegt');
    setRunDialog(false);
    await load();
    setSelectedRun(data.id);
  }

  async function setStatus(status: string) {
    if (!run) return;
    const patch: any = { status };
    if (status === 'verbucht') patch.posted_at = new Date().toISOString();
    const { error } = await (supabase as any).from('finance_payroll_runs').update(patch).eq('id', run.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status: ${status}`);
    load();
  }

  async function deleteRun() {
    if (!run) return;
    const { error } = await (supabase as any).from('finance_payroll_runs').delete().eq('id', run.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Lohnlauf gelöscht');
    setSelectedRun(null);
    load();
  }

  async function addLine() {
    if (!run) return;
    if (!lineForm.employee_name.trim()) { toast.error('Mitarbeiter erforderlich'); return; }
    const wt = wageTypes.find(w => w.code === lineForm.wage_type_code);
    const { error } = await (supabase as any).from('finance_payroll_lines').insert({
      run_id: run.id,
      employee_name: lineForm.employee_name.trim(),
      employee_number: lineForm.employee_number.trim() || null,
      wage_type_code: wt?.code ?? null,
      wage_type_name: wt?.name ?? null,
      kind: wt?.kind ?? lineForm.kind,
      amount: Number(String(lineForm.amount).replace(',', '.')) || 0,
      account_number: wt?.account_number ?? null,
      cost_center: lineForm.cost_center.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Zeile erfasst');
    setLineForm({ ...lineForm, wage_type_code: '', amount: '' });
    setLineDialog(false);
    await loadLines(run.id);
    load();
  }

  async function removeLine(id: string) {
    const { error } = await (supabase as any).from('finance_payroll_lines').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (selectedRun) await loadLines(selectedRun);
    load();
  }

  async function importCsv(file: File) {
    if (!run) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean).map(r => r.split(/[;,\t]/).map(c => c.trim().replace(/^"|"$/g, '')));
    if (!rows.length) { toast.error('Datei leer'); return; }
    const start = /mitarbeiter|name/i.test(rows[0][0] || '') ? 1 : 0;
    const payload = rows.slice(start).map(r => {
      const code = r[2] || null;
      const wt = wageTypes.find(w => w.code === code);
      return {
        run_id: run.id,
        employee_name: r[0] || 'Unbekannt',
        employee_number: r[1] || null,
        wage_type_code: code,
        wage_type_name: wt?.name ?? null,
        kind: wt?.kind ?? 'earning',
        amount: Number(String(r[3] || '0').replace(/\./g, '').replace(',', '.')) || 0,
        account_number: wt?.account_number ?? r[4] ?? null,
        cost_center: r[5] || null,
      };
    }).filter(p => p.employee_name);
    const { error } = await (supabase as any).from('finance_payroll_lines').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.length} Zeilen importiert`);
    await loadLines(run.id);
    load();
  }

  function exportJournal() {
    if (!run) return;
    const head = ['Mitarbeiter', 'Personalnr.', 'Lohnart', 'Bezeichnung', 'Typ', 'Betrag', 'Konto', 'Kostenstelle'];
    const body = lines.map(l => [
      l.employee_name, l.employee_number ?? '', l.wage_type_code ?? '', l.wage_type_name ?? '',
      KIND_LABEL[l.kind] ?? l.kind, Number(l.amount || 0), l.account_number ?? '', l.cost_center ?? '',
    ]);
    download(`lohnjournal_${region}_${run.period_year}-${String(run.period_month).padStart(2, '0')}.csv`, csv([head, ...body]));
    toast.success('Lohnjournal exportiert');
  }

  function exportBuchungssatz() {
    if (!run) return;
    const map = new Map<string, number>();
    for (const l of lines) {
      const key = `${l.account_number ?? '—'}|${l.kind}`;
      map.set(key, (map.get(key) || 0) + Number(l.amount || 0));
    }
    const head = ['Konto', 'Typ', 'Soll', 'Haben', 'Text'];
    const body = [...map.entries()].map(([k, v]) => {
      const [acc, kind] = k.split('|');
      const isDebit = kind === 'earning' || kind === 'employer_contribution';
      return [acc, KIND_LABEL[kind] ?? kind, isDebit ? v : 0, isDebit ? 0 : v, `Lohnlauf ${run.label ?? ''}`];
    });
    download(`lohnbuchungssaetze_${region}_${run.period_year}-${String(run.period_month).padStart(2, '0')}.csv`, csv([head, ...body]));
    toast.success('Buchungssätze exportiert');
  }

  const statusVariant = (s: string) => s === 'verbucht' ? 'default' : s === 'freigegeben' ? 'secondary' : 'outline';

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Lohnbuchhaltung & Sozialversicherungen"
        subtitle={`Lohnläufe, Lohnjournal und SV-Sätze ${region === 'CH' ? '🇨🇭 Schweiz (AHV/ALV/BVG)' : '🇪🇺 EU (RV/KV/PV/AV)'} · ${year}`}
        icon={Users}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>Geschäftsjahr</Label>
            <Input type="number" className="w-32" value={year} onChange={e => setYear(Number(e.target.value) || year)} />
          </div>
          <Badge variant="outline">{runs.length} Lohnläufe</Badge>
          <Badge variant="outline">Währung {cur}</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiTile label={`Bruttolohn ${year}`} value={fmt(totals.gross)} icon={Users} />
        <KpiTile label="Abzüge AN" value={fmt(totals.deductions)} icon={Users} />
        <KpiTile label="Nettolohn" value={fmt(totals.net)} icon={Users} />
        <KpiTile label="AG-Kosten" value={fmt(totals.employer)} icon={Users} />
      </div>

      <Tabs defaultValue="laeufe">
        <TabsList>
          <TabsTrigger value="laeufe">Lohnläufe</TabsTrigger>
          <TabsTrigger value="journal">Lohnjournal</TabsTrigger>
          <TabsTrigger value="lohnarten">Lohnarten</TabsTrigger>
          <TabsTrigger value="sv">SV-Sätze</TabsTrigger>
        </TabsList>

        {/* ---------- Lohnläufe ---------- */}
        <TabsContent value="laeufe" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lohnläufe {year}</CardTitle>
              <Dialog open={runDialog} onOpenChange={setRunDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Neuer Lohnlauf</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Lohnlauf anlegen</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Monat</Label>
                      <Select value={String(newRunMonth)} onValueChange={v => setNewRunMonth(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">Region {region} · Jahr {year} · Währung {cur}</p>
                  </div>
                  <DialogFooter><Button onClick={createRun}>Anlegen</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">MA</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead className="text-right">Abzüge</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">AG-Kosten</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map(r => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${r.id === selectedRun ? 'bg-muted/50' : ''}`}
                      onClick={() => setSelectedRun(r.id)}
                    >
                      <TableCell className="font-medium">{r.label || `${MONTHS[r.period_month - 1]} ${r.period_year}`}</TableCell>
                      <TableCell><Badge variant={statusVariant(r.status) as any}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right">{r.employee_count ?? 0}</TableCell>
                      <TableCell className="text-right">{fmt(Number(r.total_gross || 0))}</TableCell>
                      <TableCell className="text-right">{fmt(Number(r.total_deductions || 0))}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(r.total_net || 0))}</TableCell>
                      <TableCell className="text-right">{fmt(Number(r.total_employer_cost || 0))}</TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                  {!runs.length && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Keine Lohnläufe für {year} · {region}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Lohnjournal ---------- */}
        <TabsContent value="journal" className="mt-4 space-y-4">
          {!run ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Bitte zuerst einen Lohnlauf auswählen.
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{run.label}</span>
                  <Badge variant={statusVariant(run.status) as any}>{run.status}</Badge>
                  <div className="flex-1" />
                  {run.status === 'entwurf' && (
                    <Button size="sm" variant="outline" onClick={() => setStatus('freigegeben')}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Freigeben
                    </Button>
                  )}
                  {run.status === 'freigegeben' && (
                    <Button size="sm" onClick={() => setStatus('verbucht')}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Verbuchen
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={exportJournal}>
                    <Download className="h-4 w-4 mr-2" /> Journal CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportBuchungssatz}>
                    <Download className="h-4 w-4 mr-2" /> Buchungssätze
                  </Button>
                  <label className="inline-flex">
                    <input
                      type="file" accept=".csv,text/csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ''; }}
                    />
                    <span className="inline-flex items-center h-8 px-3 text-sm rounded-md border border-input hover:bg-accent cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" /> Import CSV
                    </span>
                  </label>
                  <Dialog open={lineDialog} onOpenChange={setLineDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Zeile</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Lohnzeile erfassen</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Mitarbeiter</Label>
                            <Input value={lineForm.employee_name} onChange={e => setLineForm({ ...lineForm, employee_name: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label>Personalnr.</Label>
                            <Input value={lineForm.employee_number} onChange={e => setLineForm({ ...lineForm, employee_number: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Lohnart</Label>
                          <Select value={lineForm.wage_type_code} onValueChange={v => setLineForm({ ...lineForm, wage_type_code: v })}>
                            <SelectTrigger><SelectValue placeholder="Lohnart wählen" /></SelectTrigger>
                            <SelectContent>
                              {wageTypes.filter(w => w.is_active).map(w => (
                                <SelectItem key={w.id} value={w.code}>{w.code} · {w.name} ({KIND_LABEL[w.kind]})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Betrag ({cur})</Label>
                            <Input value={lineForm.amount} onChange={e => setLineForm({ ...lineForm, amount: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label>Kostenstelle</Label>
                            <Input value={lineForm.cost_center} onChange={e => setLineForm({ ...lineForm, cost_center: e.target.value })} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter><Button onClick={addLine}>Erfassen</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {canDelete && (
                    <Button size="sm" variant="destructive" onClick={deleteRun}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Zusammenfassung je Mitarbeiter</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mitarbeiter</TableHead>
                        <TableHead>Personalnr.</TableHead>
                        <TableHead className="text-right">Brutto</TableHead>
                        <TableHead className="text-right">Abzüge</TableHead>
                        <TableHead className="text-right">Netto</TableHead>
                        <TableHead className="text-right">AG-Kosten</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {perEmployee.map(e => (
                        <TableRow key={e.name}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell>{e.number}</TableCell>
                          <TableCell className="text-right">{fmt(e.gross)}</TableCell>
                          <TableCell className="text-right">{fmt(e.deductions)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(e.gross - e.deductions)}</TableCell>
                          <TableCell className="text-right">{fmt(e.employer)}</TableCell>
                        </TableRow>
                      ))}
                      {!perEmployee.length && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Keine Zeilen erfasst
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Lohnjournal-Zeilen ({lines.length})</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mitarbeiter</TableHead>
                        <TableHead>Lohnart</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Konto</TableHead>
                        <TableHead>KST</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{l.employee_name}</TableCell>
                          <TableCell>{l.wage_type_code} · {l.wage_type_name}</TableCell>
                          <TableCell><Badge variant="outline">{KIND_LABEL[l.kind] ?? l.kind}</Badge></TableCell>
                          <TableCell>{l.account_number}</TableCell>
                          <TableCell>{l.cost_center}</TableCell>
                          <TableCell className="text-right">{fmt(Number(l.amount || 0))}</TableCell>
                          <TableCell className="text-right">
                            {canDelete && (
                              <Button size="icon" variant="ghost" onClick={() => removeLine(l.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ---------- Lohnarten ---------- */}
        <TabsContent value="lohnarten" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lohnarten {region === 'CH' ? '🇨🇭' : '🇪🇺'}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                download(`lohnarten_${region}.csv`, csv([
                  ['Code', 'Bezeichnung', 'Typ', 'Prozent', 'Konto', 'Aktiv'],
                  ...wageTypes.map(w => [w.code, w.name, KIND_LABEL[w.kind] ?? w.kind, w.percentage ?? '', w.account_number ?? '', w.is_active ? 'ja' : 'nein']),
                ]));
              }}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Prozent</TableHead>
                    <TableHead>Konto</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wageTypes.map(w => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono">{w.code}</TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell><Badge variant="outline">{KIND_LABEL[w.kind] ?? w.kind}</Badge></TableCell>
                      <TableCell className="text-right">{w.percentage != null ? `${Number(w.percentage).toFixed(2)} %` : '—'}</TableCell>
                      <TableCell>{w.account_number ?? '—'}</TableCell>
                      <TableCell>{w.is_active ? <Badge>aktiv</Badge> : <Badge variant="outline">inaktiv</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {!wageTypes.length && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Keine Lohnarten</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- SV-Sätze ---------- */}
        <TabsContent value="sv" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sozialversicherungssätze {region === 'CH' ? '🇨🇭 AHV / ALV / BVG / UVG / KTG' : '🇪🇺 RV / KV / PV / AV'}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                download(`sv_saetze_${region}.csv`, csv([
                  ['Code', 'Bezeichnung', 'AN %', 'AG %', 'Total %', 'Gültig ab', 'Konto'],
                  ...rates.map(r => [r.code, r.name, r.employee_rate, r.employer_rate, Number(r.employee_rate) + Number(r.employer_rate), r.valid_from, r.account_number ?? '']),
                ]));
              }}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead className="text-right">Arbeitnehmer</TableHead>
                    <TableHead className="text-right">Arbeitgeber</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Gültig ab</TableHead>
                    <TableHead>Konto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{Number(r.employee_rate).toFixed(2)} %</TableCell>
                      <TableCell className="text-right">{Number(r.employer_rate).toFixed(2)} %</TableCell>
                      <TableCell className="text-right font-semibold">{(Number(r.employee_rate) + Number(r.employer_rate)).toFixed(2)} %</TableCell>
                      <TableCell>{r.valid_from}</TableCell>
                      <TableCell>{r.account_number ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!rates.length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Sätze hinterlegt</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
