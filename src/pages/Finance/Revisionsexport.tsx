import { useEffect, useState } from 'react';
import { Archive, Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

type Pack = { key: string; label: string; table: string; dateCol: string | null; description: string };

const PACKS: Pack[] = [
  { key: 'journal', label: 'Buchungsjournal', table: 'finance_journal', dateCol: 'booking_date', description: 'Alle Journalbuchungen (append-only)' },
  { key: 'cashbook', label: 'Kassenbuch', table: 'finance_cashbook', dateCol: 'booking_date', description: 'Kassenbewegungen inkl. Storni' },
  { key: 'closures', label: 'Kassenabschlüsse', table: 'finance_cashbook_closures', dateCol: 'closure_date', description: 'Gezählte Kassenabschlüsse' },
  { key: 'transactions', label: 'Finanztransaktionen', table: 'finance_transactions', dateCol: 'booking_date', description: 'Zahlungen, Anzahlungen, Raten' },
  { key: 'periods', label: 'Perioden', table: 'finance_periods', dateCol: null, description: 'Periodenstatus / Sperren' },
  { key: 'audit', label: 'Audit-Trail', table: 'finance_audit_trail', dateCol: 'created_at', description: 'Änderungsprotokoll (GoBD)' },
];

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.replace(/[;\r\n]/g, ' ');
  };
  return [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
}

function download(name: string, content: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Revisionsexport() {
  const { region } = useAccountingRegion();
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRows(p: Pack) {
    let q: any = (supabase as any).from(p.table).select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).limit(10000);
    if (p.dateCol) q = q.gte(p.dateCol, from).lte(p.dateCol, p.dateCol === 'created_at' ? `${to}T23:59:59` : to).order(p.dateCol, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as any[];
  }

  async function loadCounts() {
    setLoading(true);
    const next: Record<string, number> = {};
    for (const p of PACKS) {
      try {
        let q: any = (supabase as any).from(p.table).select('id', { count: 'exact', head: true }).in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]);
        if (p.dateCol) q = q.gte(p.dateCol, from).lte(p.dateCol, p.dateCol === 'created_at' ? `${to}T23:59:59` : to);
        const { count } = await q;
        next[p.key] = count ?? 0;
      } catch { next[p.key] = 0; }
    }
    setCounts(next);
    setLoading(false);
  }

  useEffect(() => { loadCounts(); /* eslint-disable-line */ }, [region, from, to]);

  async function exportOne(p: Pack) {
    setBusy(p.key);
    try {
      const rows = await fetchRows(p);
      if (!rows.length) { toast.info(`${p.label}: keine Daten im Zeitraum`); return; }
      download(`revision_${region}_${p.key}_${from}_${to}.csv`, toCsv(rows));
      toast.success(`${p.label}: ${rows.length} Datensätze exportiert`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Export fehlgeschlagen');
    } finally { setBusy(null); }
  }

  async function exportAll() {
    setBusy('all');
    try {
      for (const p of PACKS) {
        const rows = await fetchRows(p).catch(() => []);
        if (rows.length) download(`revision_${region}_${p.key}_${from}_${to}.csv`, toCsv(rows));
      }
      toast.success('Revisionspaket exportiert');
    } finally { setBusy(null); }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={Archive}
        title={`Revisionsexport ${region === 'CH' ? '🇨🇭 CH' : '🇪🇺 EU'}`}
        subtitle="Vollständiges Prüferpaket: Journal, Kassenbuch, Abschlüsse, Transaktionen, Perioden, Audit-Trail"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadCounts}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
            <Button onClick={exportAll} disabled={busy !== null}><Download className="mr-2 h-4 w-4" />Gesamtpaket</Button>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Prüfzeitraum</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PACKS.map(p => (
          <Card key={p.key}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{p.label}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              </div>
              <Badge variant="outline">{loading ? '…' : counts[p.key] ?? 0}</Badge>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full" disabled={busy !== null} onClick={() => exportOne(p)}>
                <Download className="mr-2 h-4 w-4" />{busy === p.key ? 'Exportiert…' : 'CSV exportieren'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
