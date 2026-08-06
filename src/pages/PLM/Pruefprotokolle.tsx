import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardList, Loader2, Search, CheckCircle2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { INSPECTION_RESULT, plmLabel, statusTone } from '@/lib/plm/config';

interface Row { id: string; [k: string]: any }

const toneClass: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  warn: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  bad: 'bg-destructive/15 text-destructive border-destructive/30',
  muted: 'bg-muted text-muted-foreground border-border',
};

export default function PlmPruefprotokolle() {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [parts, setParts] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [items, setItems] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'offen' | 'alle'>('offen');
  const [active, setActive] = useState<Row | null>(null);
  const [result, setResult] = useState('freigegeben');
  const [deviation, setDeviation] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [g, p, s, pl, it] = await Promise.all([
      supabase.from('plm_goods_receipts' as any).select('*').order('received_at', { ascending: false }).limit(1000),
      supabase.from('plm_parts' as any).select('id,name,part_number,criticality').limit(5000),
      supabase.from('plm_suppliers' as any).select('id,name').limit(1000),
      supabase.from('plm_inspection_plans' as any).select('id,name,plan_number,plan_type').limit(1000),
      supabase.from('plm_inspection_items' as any).select('*').order('position_no').limit(5000),
    ]);
    const err = g.error || p.error || s.error || pl.error || it.error;
    if (err) toast.error(err.message);
    setReceipts((g.data as any[]) || []);
    setParts((p.data as any[]) || []);
    setSuppliers((s.data as any[]) || []);
    setPlans((pl.data as any[]) || []);
    setItems((it.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const partMap = useMemo(() => Object.fromEntries(parts.map(p => [p.id, p])), [parts]);
  const supMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const planMap = useMemo(() => Object.fromEntries(plans.map(p => [p.id, p])), [plans]);

  const filtered = receipts.filter(r => {
    if (tab === 'offen' && r.inspection_result && r.inspection_result !== 'offen' && r.inspection_result !== 'in_pruefung') return false;
    if (!search) return true;
    const s = search.toLowerCase();
    const part = partMap[r.part_id];
    return `${r.receipt_number || ''} ${r.batch_number || ''} ${part?.name || ''} ${part?.part_number || ''}`.toLowerCase().includes(s);
  });

  const openDialog = (r: Row) => {
    setActive(r);
    setResult(r.inspection_result && r.inspection_result !== 'offen' ? r.inspection_result : 'freigegeben');
    setDeviation(r.deviation || '');
    setBlocked(!!r.blocked);
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('plm_goods_receipts' as any).update({
      inspection_result: result,
      deviation: deviation || null,
      blocked: blocked || ['gesperrt', 'rueckgesendet'].includes(result),
      inspected_by: auth.user?.id ?? null,
      inspected_at: new Date().toISOString(),
    } as any).eq('id', active.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await supabase.from('plm_audit_log' as any).insert({
      entity_type: 'goods_receipt', entity_id: active.id, action: 'inspection',
      changes: { inspection_result: result, blocked, deviation }, user_id: auth.user?.id ?? null,
    } as any);
    toast.success('Prüfergebnis gespeichert');
    setActive(null);
    load();
  };

  const activePlanItems = active?.inspection_plan_id ? items.filter(i => i.plan_id === active.inspection_plan_id) : [];

  const kpis = [
    { label: 'Offene Prüfungen', value: receipts.filter(r => !r.inspection_result || ['offen', 'in_pruefung'].includes(r.inspection_result)).length },
    { label: 'Freigegeben', value: receipts.filter(r => r.inspection_result === 'freigegeben').length },
    { label: 'Abweichungen', value: receipts.filter(r => ['abweichung', 'rueckgesendet'].includes(r.inspection_result)).length },
    { label: 'Gesperrt', value: receipts.filter(r => r.blocked || r.inspection_result === 'gesperrt').length },
  ];

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Prüfprotokolle"
        subtitle="Wareneingangsprüfung dokumentieren: Ergebnis, Abweichung, Sperrung – revisionssicher protokolliert."
        noBreadcrumbs
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(['offen', 'alle'] as const).map(t => (
              <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
                {t === 'offen' ? 'Offene Prüfungen' : 'Alle'}
              </Button>
            ))}
          </div>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="WE-Nr., Charge, Teil …" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WE-Nr.</TableHead><TableHead>Eingang</TableHead><TableHead>Teil</TableHead>
                <TableHead>Lieferant</TableHead><TableHead>Charge</TableHead><TableHead className="text-right">Menge</TableHead>
                <TableHead>Prüfplan</TableHead><TableHead>Ergebnis</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">Keine Wareneingänge.</TableCell></TableRow>}
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.receipt_number || '—'}</TableCell>
                  <TableCell>{r.received_at ? new Date(r.received_at).toLocaleDateString('de-DE') : '—'}</TableCell>
                  <TableCell>{partMap[r.part_id]?.name || '—'}</TableCell>
                  <TableCell>{supMap[r.supplier_id]?.name || '—'}</TableCell>
                  <TableCell>{r.batch_number || '—'}</TableCell>
                  <TableCell className="text-right">{r.quantity} {r.unit || ''}</TableCell>
                  <TableCell>{planMap[r.inspection_plan_id]?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={toneClass[statusTone(r.inspection_result)]}>{plmLabel(r.inspection_result)}</Badge>
                    {r.blocked && <Ban className="ml-2 inline h-3.5 w-3.5 text-destructive" />}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openDialog(r)}>Prüfen</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={o => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prüfprotokoll {active?.receipt_number || ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Teil: </span>{partMap[active?.part_id]?.name || '—'}</div>
              <div><span className="text-muted-foreground">Charge: </span>{active?.batch_number || '—'}</div>
              <div><span className="text-muted-foreground">Menge: </span>{active?.quantity} {active?.unit || ''}</div>
              <div><span className="text-muted-foreground">Lieferant: </span>{supMap[active?.supplier_id]?.name || '—'}</div>
            </div>

            {activePlanItems.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Pos.</TableHead><TableHead>Merkmal</TableHead><TableHead>Methode</TableHead><TableHead>Soll</TableHead><TableHead>Toleranz</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {activePlanItems.map(i => (
                      <TableRow key={i.id}>
                        <TableCell>{i.position_no}</TableCell>
                        <TableCell>{i.characteristic}{i.is_critical && <Badge variant="outline" className={`ml-2 ${toneClass.bad}`}>kritisch</Badge>}</TableCell>
                        <TableCell>{i.method || '—'}</TableCell>
                        <TableCell>{i.nominal || '—'} {i.unit || ''}</TableCell>
                        <TableCell>{i.tolerance_min ?? '—'} … {i.tolerance_max ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Prüfergebnis</label>
              <select value={result} onChange={e => setResult(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {INSPECTION_RESULT.map(r => <option key={r} value={r}>{plmLabel(r)}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Abweichung / Bemerkung</label>
              <Textarea value={deviation} onChange={e => setDeviation(e.target.value)} rows={3} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={blocked} onChange={e => setBlocked(e.target.checked)} /> Material sperren
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Prüfung speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
