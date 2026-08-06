import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Gauge, Plus, Search, Loader2, CheckCircle2, AlertTriangle, History } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('de-DE') : '—');

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function PlmPruefmittel() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));

  const [gauges, setGauges] = useState<any[]>([]);
  const [cals, setCals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gaugeOpen, setGaugeOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [histOpen, setHistOpen] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [gForm, setGForm] = useState<any>({});
  const [cForm, setCForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [g, c] = await Promise.all([
      supabase.from('plm_gauges' as any).select('*').order('gauge_number', { ascending: true }).limit(1000),
      supabase.from('plm_calibrations' as any).select('*').order('calibrated_at', { ascending: false }).limit(2000),
    ]);
    if (g.error || c.error) toast.error((g.error || c.error)!.message);
    setGauges((g.data as any[]) || []);
    setCals((c.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const soon = addMonths(new Date(), 1);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return gauges
      .filter(g => !s || JSON.stringify(g).toLowerCase().includes(s))
      .map(g => {
        const due = g.next_calibration as string | null;
        const state = !due ? 'unbekannt' : due < today ? 'überfällig' : due <= soon ? 'faellig_bald' : 'ok';
        return { ...g, state };
      })
      .sort((a, b) => (a.next_calibration || '9999').localeCompare(b.next_calibration || '9999'));
  }, [gauges, search, today, soon]);

  const kpi = useMemo(() => ({
    total: rows.length,
    overdue: rows.filter(r => r.state === 'überfällig').length,
    soon: rows.filter(r => r.state === 'faellig_bald').length,
    ok: rows.filter(r => r.state === 'ok').length,
  }), [rows]);

  function openGauge(row?: any) {
    setGForm(row ? { ...row } : { calibration_interval_months: 12, status: 'aktiv' });
    setGaugeOpen(true);
  }

  async function saveGauge() {
    if (!gForm.name) { toast.error('Bezeichnung fehlt'); return; }
    setSaving(true);
    const payload: any = {
      gauge_number: gForm.gauge_number || null,
      name: gForm.name,
      gauge_type: gForm.gauge_type || null,
      manufacturer: gForm.manufacturer || null,
      serial_number: gForm.serial_number || null,
      location: gForm.location || null,
      calibration_interval_months: Number(gForm.calibration_interval_months) || 12,
      last_calibration: gForm.last_calibration || null,
      next_calibration: gForm.next_calibration || null,
      status: gForm.status || 'aktiv',
      notes: gForm.notes || null,
    };
    const { error } = gForm.id
      ? await (supabase.from('plm_gauges' as any) as any).update(payload).eq('id', gForm.id)
      : await (supabase.from('plm_gauges' as any) as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Prüfmittel gespeichert');
    setGaugeOpen(false);
    load();
  }

  function openCal(gauge: any) {
    setCForm({
      gauge_id: gauge.id,
      gauge_name: [gauge.gauge_number, gauge.name].filter(Boolean).join(' · '),
      interval: gauge.calibration_interval_months || 12,
      calibrated_at: today,
      next_due: addMonths(new Date(), gauge.calibration_interval_months || 12),
      result: 'io',
    });
    setCalOpen(true);
  }

  async function saveCal() {
    setSaving(true);
    const { error } = await (supabase.from('plm_calibrations' as any) as any).insert({
      gauge_id: cForm.gauge_id,
      calibrated_at: cForm.calibrated_at,
      next_due: cForm.next_due || null,
      result: cForm.result,
      certificate_number: cForm.certificate_number || null,
      provider: cForm.provider || null,
      deviation: cForm.deviation || null,
      document_url: cForm.document_url || null,
      notes: cForm.notes || null,
    });
    if (!error) {
      await (supabase.from('plm_gauges' as any) as any).update({
        last_calibration: cForm.calibrated_at,
        next_calibration: cForm.next_due || null,
        status: cForm.result === 'nio' ? 'gesperrt' : 'aktiv',
      }).eq('id', cForm.gauge_id);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Kalibrierung erfasst');
    setCalOpen(false);
    load();
  }

  const stateBadge = (s: string) =>
    s === 'überfällig' ? <Badge variant="outline" className="border-destructive/50 text-destructive">Überfällig</Badge>
    : s === 'faellig_bald' ? <Badge variant="outline" className="border-amber-500/40 text-amber-500">Fällig &lt; 30 Tage</Badge>
    : s === 'ok' ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">Gültig</Badge>
    : <Badge variant="outline" className="border-border text-muted-foreground">Unbekannt</Badge>;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Prüfmittel & Kalibrierung"
        subtitle="Prüfmittelverwaltung mit Kalibrierfristen, Zertifikaten und Historie."
        icon={Gauge}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Prüfmittel', value: kpi.total, icon: Gauge, cls: 'text-foreground' },
          { label: 'Überfällig', value: kpi.overdue, icon: AlertTriangle, cls: 'text-destructive' },
          { label: 'Bald fällig', value: kpi.soon, icon: AlertTriangle, cls: 'text-amber-500' },
          { label: 'Gültig', value: kpi.ok, icon: CheckCircle2, cls: 'text-emerald-500' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-2xl font-semibold ${k.cls}`}>{k.value}</p>
              </div>
              <k.icon className={`h-5 w-5 ${k.cls}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Suche Prüfmittel, Seriennummer, Standort…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {canWrite && (
              <Button onClick={() => openGauge()}><Plus className="mr-2 h-4 w-4" />Prüfmittel</Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nummer</TableHead>
                    <TableHead>Bezeichnung</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Serien-Nr.</TableHead>
                    <TableHead>Standort</TableHead>
                    <TableHead>Intervall</TableHead>
                    <TableHead>Letzte</TableHead>
                    <TableHead>Nächste</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.gauge_number || '—'}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.gauge_type || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.serial_number || '—'}</TableCell>
                      <TableCell>{r.location || '—'}</TableCell>
                      <TableCell>{r.calibration_interval_months} Mon.</TableCell>
                      <TableCell>{dt(r.last_calibration)}</TableCell>
                      <TableCell>{dt(r.next_calibration)}</TableCell>
                      <TableCell>{stateBadge(r.state)}</TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setHistOpen(r)}><History className="h-4 w-4" /></Button>
                        {canWrite && <Button size="sm" variant="outline" onClick={() => openGauge(r)}>Bearbeiten</Button>}
                        {canWrite && <Button size="sm" onClick={() => openCal(r)}>Kalibrieren</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Keine Prüfmittel erfasst.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prüfmittel-Dialog */}
      <Dialog open={gaugeOpen} onOpenChange={setGaugeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{gForm.id ? 'Prüfmittel bearbeiten' : 'Neues Prüfmittel'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['gauge_number', 'Prüfmittel-Nr.'], ['name', 'Bezeichnung'], ['gauge_type', 'Typ'],
              ['manufacturer', 'Hersteller'], ['serial_number', 'Seriennummer'], ['location', 'Standort'],
            ].map(([k, l]) => (
              <div key={k} className="space-y-1">
                <Label>{l}</Label>
                <Input value={gForm[k] || ''} onChange={e => setGForm({ ...gForm, [k]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Kalibrierintervall (Monate)</Label>
              <Input type="number" value={gForm.calibration_interval_months ?? 12} onChange={e => setGForm({ ...gForm, calibration_interval_months: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={gForm.status || 'aktiv'} onChange={e => setGForm({ ...gForm, status: e.target.value })}>
                {['aktiv', 'in_kalibrierung', 'gesperrt', 'ausgemustert'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Letzte Kalibrierung</Label>
              <Input type="date" value={gForm.last_calibration || ''} onChange={e => setGForm({ ...gForm, last_calibration: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Nächste Kalibrierung</Label>
              <Input type="date" value={gForm.next_calibration || ''} onChange={e => setGForm({ ...gForm, next_calibration: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notizen</Label>
              <Textarea value={gForm.notes || ''} onChange={e => setGForm({ ...gForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGaugeOpen(false)}>Abbrechen</Button>
            <Button onClick={saveGauge} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kalibrier-Dialog */}
      <Dialog open={calOpen} onOpenChange={setCalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Kalibrierung erfassen — {cForm.gauge_name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kalibriert am</Label>
              <Input type="date" value={cForm.calibrated_at || ''} onChange={e => {
                const v = e.target.value;
                setCForm({ ...cForm, calibrated_at: v, next_due: v ? addMonths(new Date(v), cForm.interval || 12) : '' });
              }} />
            </div>
            <div className="space-y-1">
              <Label>Nächste Fälligkeit</Label>
              <Input type="date" value={cForm.next_due || ''} onChange={e => setCForm({ ...cForm, next_due: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Ergebnis</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cForm.result || 'io'} onChange={e => setCForm({ ...cForm, result: e.target.value })}>
                <option value="io">i.O.</option>
                <option value="mit_abweichung">i.O. mit Abweichung</option>
                <option value="nio">n.i.O. (sperren)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Zertifikatsnummer</Label>
              <Input value={cForm.certificate_number || ''} onChange={e => setCForm({ ...cForm, certificate_number: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Dienstleister</Label>
              <Input value={cForm.provider || ''} onChange={e => setCForm({ ...cForm, provider: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Zertifikat-Link</Label>
              <Input value={cForm.document_url || ''} onChange={e => setCForm({ ...cForm, document_url: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Abweichung / Notizen</Label>
              <Textarea value={cForm.deviation || ''} onChange={e => setCForm({ ...cForm, deviation: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalOpen(false)}>Abbrechen</Button>
            <Button onClick={saveCal} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historie */}
      <Dialog open={!!histOpen} onOpenChange={() => setHistOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Kalibrierhistorie — {histOpen?.name}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead><TableHead>Ergebnis</TableHead><TableHead>Zertifikat</TableHead>
                <TableHead>Dienstleister</TableHead><TableHead>Fällig</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cals.filter(c => c.gauge_id === histOpen?.id).map(c => (
                <TableRow key={c.id}>
                  <TableCell>{dt(c.calibrated_at)}</TableCell>
                  <TableCell>{c.result}</TableCell>
                  <TableCell className="font-mono text-xs">{c.certificate_number || '—'}</TableCell>
                  <TableCell>{c.provider || '—'}</TableCell>
                  <TableCell>{dt(c.next_due)}</TableCell>
                </TableRow>
              ))}
              {!cals.filter(c => c.gauge_id === histOpen?.id).length && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Keine Kalibrierungen erfasst.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
