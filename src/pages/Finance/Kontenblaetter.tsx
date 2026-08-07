import { useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

interface JournalRow {
  id: string; journal_number: string | null; booking_date: string; account: string | null;
  contra_account: string | null; description: string | null; reference: string | null;
  amount_net: number | null; amount_vat: number | null; amount_gross: number | null; status: string | null;
}

export default function Kontenblaetter() {
  const { region } = useAccountingRegion();
  const cur = region === 'CH' ? 'CHF' : 'EUR';
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: cur });

  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [account, setAccount] = useState('alle');
  const [accounts, setAccounts] = useState<{ account_number: string; name: string }[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAccounts() {
    const { data } = await (supabase as any)
      .from('finance_chart_of_accounts')
      .select('account_number, name')
      .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region])
      .order('account_number');
    setAccounts((data || []) as any[]);
  }

  async function load() {
    setLoading(true);
    let q: any = (supabase as any)
      .from('finance_journal')
      .select('id, journal_number, booking_date, account, contra_account, description, reference, amount_net, amount_vat, amount_gross, status')
      .in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region])
      .gte('booking_date', from)
      .lte('booking_date', to)
      .order('booking_date', { ascending: true })
      .limit(5000);
    if (account !== 'alle') q = q.eq('account', account);
    const { data, error } = await q;
    if (error) toast.error(error.message); else setRows((data || []) as JournalRow[]);
    setLoading(false);
  }

  useEffect(() => { loadAccounts(); /* eslint-disable-line */ }, [region]);
  useEffect(() => { load(); /* eslint-disable-line */ }, [region, from, to, account]);

  const groups = useMemo(() => {
    const map = new Map<string, JournalRow[]>();
    for (const r of rows) {
      const key = r.account || '(ohne Konto)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const accountName = (nr: string) => accounts.find(a => a.account_number === nr)?.name || '';

  function exportCsv() {
    const head = ['Konto', 'Kontobezeichnung', 'Beleg', 'Datum', 'Referenz', 'Text', 'Gegenkonto', 'Netto', 'MwSt', 'Brutto', 'Status'];
    const lines = [head.join(';')];
    for (const [acc, list] of groups) {
      for (const r of list) {
        lines.push([
          acc, accountName(acc), r.journal_number ?? '', r.booking_date, r.reference ?? '',
          (r.description ?? '').replace(/[;\n\r]/g, ' '), r.contra_account ?? '',
          String(r.amount_net ?? 0), String(r.amount_vat ?? 0), String(r.amount_gross ?? 0), r.status ?? '',
        ].join(';'));
      }
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kontenblaetter_${region}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={BookOpen}
        title={`Kontenblätter ${region === 'CH' ? '🇨🇭 CH' : '🇪🇺 EU'}`}
        subtitle="Kontobezogene Einzelnachweise mit laufendem Saldo (Revisionssicht)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Aktualisieren</Button>
            <Button onClick={exportCsv} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="min-w-[280px]">
            <Label>Konto</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="alle">Alle Konten</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.account_number} value={a.account_number}>{a.account_number} · {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Lädt…</CardContent></Card>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Keine Buchungen im gewählten Zeitraum</CardContent></Card>
      ) : (
        groups.map(([acc, list]) => {
          let saldo = 0;
          const total = list.reduce((s, r) => s + Number(r.amount_gross || 0), 0);
          return (
            <Card key={acc}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  {acc} {accountName(acc) && <span className="text-muted-foreground font-normal">· {accountName(acc)}</span>}
                </CardTitle>
                <Badge variant="outline">Saldo {fmt(total)}</Badge>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beleg</TableHead><TableHead>Datum</TableHead><TableHead>Text</TableHead>
                      <TableHead>Gegenkonto</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                      <TableHead className="text-right">MwSt</TableHead>
                      <TableHead className="text-right">Brutto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(r => {
                      saldo += Number(r.amount_gross || 0);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.journal_number || '–'}</TableCell>
                          <TableCell className="text-xs">{new Date(r.booking_date).toLocaleDateString('de-DE')}</TableCell>
                          <TableCell className="max-w-[320px] truncate text-xs">{r.description || r.reference || '–'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.contra_account || '–'}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(Number(r.amount_net || 0))}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(Number(r.amount_vat || 0))}</TableCell>
                          <TableCell className="text-right text-xs">{fmt(Number(r.amount_gross || 0))}</TableCell>
                          <TableCell className="text-right text-xs font-medium">{fmt(saldo)}</TableCell>
                        </TableRow>
                      );
                    })}
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
