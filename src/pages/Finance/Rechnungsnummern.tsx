import { useEffect, useMemo, useState } from 'react';
import { Hash, Loader2, RefreshCw, ShieldCheck, PlayCircle, Eye, History, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type RangeRow = {
  period: string;
  start_value: number;
  digits: number;
  last_value: number;
  status: string;
  invoice_count: number;
  first_number: string | null;
  last_number: string | null;
};

type PreviewRow = {
  invoice_id: string;
  old_number: string | null;
  invoice_date: string | null;
  period: string;
  planned_number: string;
};

type MigrationRow = {
  id: string;
  invoice_id: string;
  old_number: string | null;
  new_number: string;
  invoice_date: string | null;
  migrated_at: string;
  status: string;
};

type AuditRow = {
  id: string;
  invoice_id: string | null;
  beleg_id: string | null;
  old_number: string | null;
  new_number: string | null;
  action: string;
  reason: string | null;
  created_at: string;
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const ACTION_LABEL: Record<string, string> = {
  assign: 'Vergabe',
  migrate: 'Migration',
  correct: 'Korrektur',
};

export default function Rechnungsnummern() {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const canMigrate = isSuperAdmin || hasRole('Admin');

  const [loading, setLoading] = useState(true);
  const [ranges, setRanges] = useState<RangeRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [migrations, setMigrations] = useState<MigrationRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  // Korrektur-Dialog
  const [correctFor, setCorrectFor] = useState<{ id: string; current: string } | null>(null);
  const [correctNumber, setCorrectNumber] = useState('');
  const [correctReason, setCorrectReason] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, open, assigned, mig, aud] = await Promise.all([
      (supabase as any).from('invoice_number_range_overview').select('*').order('period', { ascending: false }),
      (supabase as any).from('zoho_invoices').select('id', { count: 'exact', head: true }).is('legal_invoice_number', null),
      (supabase as any).from('zoho_invoices').select('id', { count: 'exact', head: true }).not('legal_invoice_number', 'is', null),
      (supabase as any).from('invoice_number_migrations').select('*').order('migrated_at', { ascending: false }).limit(300),
      (supabase as any).from('invoice_number_audit').select('*').order('created_at', { ascending: false }).limit(300),
    ]);
    setRanges((r.data ?? []) as RangeRow[]);
    setOpenCount(open.count ?? 0);
    setAssignedCount(assigned.count ?? 0);
    setMigrations((mig.data ?? []) as MigrationRow[]);
    setAudit((aud.data ?? []) as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activePeriod = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const current = ranges.find((r) => r.period === activePeriod);
  const nextNumber = current
    ? `${activePeriod}-${String(Math.max(current.last_value + 1, current.start_value)).padStart(current.digits, '0')}`
    : `${activePeriod}-0001`;

  const runPreview = async () => {
    setPreviewing(true);
    const { data, error } = await (supabase as any).rpc('preview_invoice_renumbering', { p_period: null });
    setPreviewing(false);
    if (error) { toast({ title: 'Vorschau fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    setPreview((data ?? []) as PreviewRow[]);
  };

  const runMigration = async () => {
    if (!preview || preview.length === 0) { toast({ title: 'Bitte zuerst den Prüflauf starten' }); return; }
    if (!window.confirm(`${preview.length} Rechnungen erhalten jetzt dauerhaft eine neue Rechnungsnummer. Fortfahren?`)) return;
    setRunning(true);
    const { data, error } = await (supabase as any).rpc('run_invoice_renumbering', { p_period: null });
    setRunning(false);
    if (error) { toast({ title: 'Migration fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    const res = Array.isArray(data) ? data[0] : data;
    toast({ title: 'Migration abgeschlossen', description: `${res?.migrated ?? 0} Rechnungen nummeriert.` });
    setPreview(null);
    load();
  };

  const submitCorrection = async () => {
    if (!correctFor) return;
    setCorrecting(true);
    const { error } = await (supabase as any).rpc('correct_invoice_number', {
      p_invoice_id: correctFor.id,
      p_new_number: correctNumber.trim(),
      p_reason: correctReason.trim(),
    });
    setCorrecting(false);
    if (error) { toast({ title: 'Korrektur nicht möglich', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Rechnungsnummer korrigiert' });
    setCorrectFor(null); setCorrectNumber(''); setCorrectReason('');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rechnungsnummern"
        subtitle="Monatlicher Nummernkreis YYYY-MM-NNNN · Beleg-ID bleibt unverändert"
        icon={Hash}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Nummernkreis" value="YYYY-MM-NNNN" icon={Hash} />
        <KpiTile label="Nächste Rechnungsnummer" value={nextNumber} icon={ShieldCheck} />
        <KpiTile label="Vergeben" value={String(assignedCount)} icon={ShieldCheck} />
        <KpiTile label="Ohne Rechnungsnummer" value={String(openCount)} icon={Eye} />
      </div>

      <Tabs defaultValue="kreise">
        <TabsList>
          <TabsTrigger value="kreise">Nummernkreise</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
          <TabsTrigger value="protokoll">Protokoll</TabsTrigger>
        </TabsList>

        <TabsContent value="kreise" className="mt-4">
          <DataCard title="Monatliche Nummernkreise">
            {loading ? <SkeletonTable rows={6} /> : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Monat</th>
                      <th className="text-left px-3 py-2">Erste Nr.</th>
                      <th className="text-left px-3 py-2">Letzte Nr.</th>
                      <th className="text-right px-3 py-2">Rechnungen</th>
                      <th className="text-left px-3 py-2">Startwert</th>
                      <th className="text-left px-3 py-2">Ziffern</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranges.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Noch kein Nummernkreis angelegt.</td></tr>
                    )}
                    {ranges.map((r) => (
                      <tr key={r.period} className="border-t border-border/60">
                        <td className="px-3 py-2 font-medium">{r.period.slice(5)}/{r.period.slice(0, 4)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.first_number?.slice(8) ?? '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{r.last_number?.slice(8) ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.invoice_count}</td>
                        <td className="px-3 py-2 tabular-nums">{String(r.start_value).padStart(r.digits, '0')}</td>
                        <td className="px-3 py-2 tabular-nums">{r.digits}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={r.status === 'active'
                            ? 'border-emerald-500/40 text-emerald-500'
                            : 'border-muted-foreground/40 text-muted-foreground'}>
                            {r.status === 'active' ? 'aktiv' : 'geschlossen'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Vergebene Rechnungsnummern lassen sich nicht bearbeiten. Lücken durch Stornos bleiben bestehen und werden nie neu vergeben.
            </p>
          </DataCard>
        </TabsContent>

        <TabsContent value="migration" className="mt-4 space-y-4">
          <DataCard title="Prüflauf & einmalige Migration">
            <p className="text-sm text-muted-foreground">
              Der Prüflauf zeigt alle bisherigen Belege mit der geplanten neuen Rechnungsnummer. Nummeriert wird nach
              Rechnungsdatum, Erstellungszeit und bisheriger Nummer. Erst danach wird die Migration ausgeführt.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" onClick={runPreview} disabled={previewing}>
                {previewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                Prüflauf starten
              </Button>
              <Button onClick={runMigration} disabled={!canMigrate || running || !preview?.length}>
                {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                Migration ausführen
              </Button>
            </div>
            {preview && (
              <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Beleg-ID (bisher)</th>
                      <th className="text-left px-3 py-2">Rechnungsdatum</th>
                      <th className="text-left px-3 py-2">Neue Rechnungsnummer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p) => (
                      <tr key={p.invoice_id} className="border-t border-border/60">
                        <td className="px-3 py-2">{p.old_number ?? '—'}</td>
                        <td className="px-3 py-2">{fmtDate(p.invoice_date)}</td>
                        <td className="px-3 py-2 font-medium text-primary tabular-nums">{p.planned_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>

          <DataCard title="Migrationstabelle">
            {loading ? <SkeletonTable rows={5} /> : migrations.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Noch keine Migration ausgeführt.</div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground sticky top-0 bg-background">
                    <tr>
                      <th className="text-left px-3 py-2">Bisherige Nr.</th>
                      <th className="text-left px-3 py-2">Neue Nr.</th>
                      <th className="text-left px-3 py-2">Rechnungsdatum</th>
                      <th className="text-left px-3 py-2">Migration</th>
                      <th className="text-left px-3 py-2">Status</th>
                      {isSuperAdmin && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {migrations.map((m) => (
                      <tr key={m.id} className="border-t border-border/60">
                        <td className="px-3 py-2">{m.old_number ?? '—'}</td>
                        <td className="px-3 py-2 font-medium tabular-nums">{m.new_number}</td>
                        <td className="px-3 py-2">{fmtDate(m.invoice_date)}</td>
                        <td className="px-3 py-2">{fmtDateTime(m.migrated_at)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">{m.status}</Badge>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost"
                              onClick={() => { setCorrectFor({ id: m.invoice_id, current: m.new_number }); setCorrectNumber(m.new_number); }}>
                              <Pencil className="w-3.5 h-3.5 mr-1" /> korrigieren
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>

        <TabsContent value="protokoll" className="mt-4">
          <DataCard title="Prüfpfad" >
            {loading ? <SkeletonTable rows={6} /> : audit.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Noch keine Einträge.</div>
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground sticky top-0 bg-background">
                    <tr>
                      <th className="text-left px-3 py-2">Zeitpunkt</th>
                      <th className="text-left px-3 py-2">Vorgang</th>
                      <th className="text-left px-3 py-2">Beleg-ID</th>
                      <th className="text-left px-3 py-2">Alt</th>
                      <th className="text-left px-3 py-2">Neu</th>
                      <th className="text-left px-3 py-2">Begründung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="border-t border-border/60">
                        <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">{ACTION_LABEL[a.action] ?? a.action}</Badge>
                        </td>
                        <td className="px-3 py-2">{a.beleg_id ?? '—'}</td>
                        <td className="px-3 py-2">{a.old_number ?? '—'}</td>
                        <td className="px-3 py-2 font-medium tabular-nums">{a.new_number ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>
      </Tabs>

      <Dialog open={!!correctFor} onOpenChange={(v) => !v && setCorrectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-4 h-4" /> Rechnungsnummer korrigieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Bisher: <span className="font-medium text-foreground">{correctFor?.current}</span></div>
            <Input value={correctNumber} onChange={(e) => setCorrectNumber(e.target.value)} placeholder="2026-09-0140" />
            <Textarea value={correctReason} onChange={(e) => setCorrectReason(e.target.value)}
              placeholder="Begründung (Pflicht, wird dauerhaft protokolliert)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCorrectFor(null)}>Abbrechen</Button>
            <Button onClick={submitCorrection} disabled={correcting || correctReason.trim().length < 5}>
              {correcting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Korrektur speichern
            </Button>
          </DialogFooter>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
