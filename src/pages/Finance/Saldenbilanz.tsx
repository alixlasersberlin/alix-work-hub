import { useEffect, useMemo, useState } from 'react';
import { Scale, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiTile } from '@/components/infinity/KpiTile';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

interface Acc { account_number: string; name: string; account_class: string | null; account_type: string | null; }
interface Line {
  account: string; name: string; account_class: string; account_type: string;
  soll: number; haben: number; saldo: number; count: number;
}

const CLASS_ORDER = ['AKTIV', 'PASSIV', 'ERTRAG', 'AUFWAND', 'ABSCHLUSS', 'OHNE ZUORDNUNG'];

export default function Saldenbilanz() {
  const { region } = useAccountingRegion();
  const cur = region === 'CH' ? 'CHF' : 'EUR';
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: cur });

  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [journal, setJournal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [accRes, jRes] = await Promise.all([
      (supabase as any).from('finance_chart_of_accounts')
        .select('account_number, name, account_class, account_type')
        .eq('accounting_region', region).order('account_number'),
      (supabase as any).from('finance_journal')
        .select('account, contra_account, amount_gross, amount_net, booking_date, status')
        .eq('accounting_region', region)
        .gte('booking_date', from).lte('booking_date', to)
        .limit(10000),
    ]);
    if (accRes.error) toast.error(accRes.error.message);
    if (jRes.error) toast.error(jRes.error.message);
    setAccounts((accRes.data || []) as Acc[]);
    setJournal((jRes.data || []) as any[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [region, from, to]);

  const lines: Line[] = useMemo(() => {
    const meta = new Map(accounts.map(a => [a.account_number, a]));
    const map = new Map<string, Line>();
    const touch = (nr: string) => {
      if (!map.has(nr)) {
        const m = meta.get(nr);
        map.set(nr, {
          account: nr,
          name: m?.name ?? '(nicht im Kontenrahmen)',
          account_class: m?.account_class ?? 'OHNE ZUORDNUNG',
          account_type: m?.account_type ?? '–',
          soll: 0, haben: 0, saldo: 0, count: 0,
        });
      }
      return map.get(nr)!;
    };
    for (const j of journal) {
      if (j.status === 'storniert') continue;
      const amt = Number(j.amount_gross ?? j.amount_net ?? 0);
      if (!amt) continue;
      if (j.account) { const l = touch(String(j.account)); l.soll += amt; l.count++; }
      if (j.contra_account) { const l = touch(String(j.contra_account)); l.haben += amt; l.count++; }
    }
    for (const l of map.values()) l.saldo = l.soll - l.haben;
    return [...map.values()].sort((a, b) => a.account.localeCompare(b.account));
  }, [journal, accounts]);

  const grouped = useMemo(() => {
    const g = new Map<string, Line[]>();
    for (const l of lines) {
      const k = l.account_class || 'OHNE ZUORDNUNG';
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(l);
    }
    return [...g.entries()].sort(
      (a, b) => (CLASS_ORDER.indexOf(a[0]) + 99) % 99 - (CLASS_ORDER.indexOf(b[0]) + 99) % 99,
    );
  }, [lines]);

  const totalSoll = lines.reduce((s, l) => s + l.soll, 0);
  const totalHaben = lines.reduce((s, l) => s + l.haben, 0);
  const diff = totalSoll - totalHaben;
  const ertrag = lines.filter(l => l.account_class === 'ERTRAG').reduce((s, l) => s + (l.haben - l.soll), 0);
  const aufwand = lines.filter(l => l.account_class === 'AUFWAND').reduce((s, l) => s + (l.soll - l.haben), 0);

  function exportCsv() {
    const head = ['Klasse', 'Kontotyp', 'Konto', 'Bezeichnung', 'Soll', 'Haben', 'Saldo', 'Buchungen'];
    const rows = lines.map(l => [l.account_class, l.account_type, l.account, l.name.replace(/;/g, ' '),
      l.soll.toFixed(2), l.haben.toFixed(2), l.saldo.toFixed(2), String(l.count)].join(';'));
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saldenbilanz_${region}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={Scale}
        title={`Saldenbilanz ${region === 'CH' ? '🇨🇭 CH' : '🇪🇺 EU'}`}
        subtitle="Rohbilanz je Konto mit Soll/Haben, Saldo und Erfolgsrechnung nach Kontoklasse"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
            <Button onClick={exportCsv} disabled={!lines.length}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Zeitraum</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Summe Soll" value={fmt(totalSoll)} icon={Scale} accent="sky" />
        <KpiTile label="Summe Haben" value={fmt(totalHaben)} icon={Scale} accent="violet" />
        <KpiTile label="Differenz" value={fmt(diff)} icon={Scale} accent={Math.abs(diff) < 0.01 ? 'emerald' : 'rose'} />
        <KpiTile label="Ergebnis (Ertrag − Aufwand)" value={fmt(ertrag - aufwand)} icon={Scale} accent={ertrag - aufwand >= 0 ? 'emerald' : 'rose'} />
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Lädt…</CardContent></Card>
      ) : lines.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Keine Buchungen im gewählten Zeitraum</CardContent></Card>
      ) : (
        grouped.map(([klass, list]) => {
          const s = list.reduce((a, l) => a + l.soll, 0);
          const h = list.reduce((a, l) => a + l.haben, 0);
          return (
            <Card key={klass}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{klass}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">Soll {fmt(s)}</Badge>
                  <Badge variant="outline">Haben {fmt(h)}</Badge>
                  <Badge>Saldo {fmt(s - h)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Konto</TableHead><TableHead>Bezeichnung</TableHead><TableHead>Typ</TableHead>
                      <TableHead className="text-right">Soll</TableHead>
                      <TableHead className="text-right">Haben</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Buchungen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(l => (
                      <TableRow key={l.account}>
                        <TableCell className="font-mono text-xs">{l.account}</TableCell>
                        <TableCell className="text-xs">{l.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{l.account_type}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(l.soll)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(l.haben)}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(l.saldo)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{l.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
