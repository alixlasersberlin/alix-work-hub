import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { logGobdExport } from '@/lib/finance/gobd';

type Row = { bereich: string; pruefung: string; status: string; detail: string };

export default function GobdGesamtabschluss() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [geprueftAm, setGeprueftAm] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('gobd_compliance_check');
    if (error) toast.error(error.message);
    else {
      setRows((data ?? []) as Row[]);
      setGeprueftAm(new Date());
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const fehler = rows.filter(r => r.status === 'FEHLER');
  const hinweise = rows.filter(r => r.status === 'HINWEIS');
  const gesamt = loading ? '…' : fehler.length > 0 ? 'FEHLER' : hinweise.length > 0 ? 'MIT HINWEISEN' : 'BESTANDEN';

  const bereiche = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.bereich, [...(m.get(r.bereich) ?? []), r]);
    return Array.from(m.entries());
  }, [rows]);

  async function exportCsv() {
    const head = 'Bereich;Pruefung;Status;Detail';
    const body = rows.map(r => [r.bereich, r.pruefung, r.status, r.detail].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));
    const content = [`GoBD-Pruefnachweis AlixWork;erstellt am;${new Date().toLocaleString('de-DE')}`, '', head, ...body].join('\n');
    const fileName = `GoBD_Pruefnachweis_${new Date().toISOString().slice(0, 10)}.csv`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
    a.download = fileName;
    a.click();
    await logGobdExport({
      exportType: 'GOBD_COMPLIANCE_CHECK', fileName, recordCount: rows.length,
      content, status: 'CREATED', metadata: { gesamt, fehler: fehler.length, hinweise: hinweise.length },
    });
    toast.success('Prüfnachweis erstellt');
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="GoBD Gesamtabschluss"
        subtitle="Automatische Gesamtprüfung aller Schutzmechanismen für Rechnungen, Protokolle, Perioden und Exporte"
        actions={<>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />Prüfnachweis
          </Button>
        </>}
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Gesamtergebnis</div>
          <div className="mt-2">
            <Badge variant={gesamt === 'BESTANDEN' ? 'outline' : gesamt === 'FEHLER' ? 'destructive' : 'secondary'}>{gesamt}</Badge>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Prüfungen</div>
          <div className="text-2xl font-semibold mt-1">{loading ? '…' : rows.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Fehler</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">{loading ? '…' : fehler.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Hinweise</div>
          <div className="text-2xl font-semibold mt-1">{loading ? '…' : hinweise.length}</div>
        </CardContent></Card>
      </div>

      {bereiche.map(([bereich, list]) => (
        <Card key={bereich}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">{bereich}</CardTitle>
            <Badge variant={list.some(r => r.status === 'FEHLER') ? 'destructive' : 'outline'}>
              {list.filter(r => r.status === 'BESTANDEN').length}/{list.length}
            </Badge>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Prüfung</TableHead><TableHead className="w-32">Ergebnis</TableHead><TableHead>Detail</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{r.pruefung}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'BESTANDEN' ? 'outline' : r.status === 'FEHLER' ? 'destructive' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <p className="text-[11px] text-muted-foreground">
        Geprüft am {geprueftAm ? geprueftAm.toLocaleString('de-DE') : '—'}. Diese Prüfung weist die technischen
        Schutzmechanismen nach. Verfahrensdokumentation, Berechtigungsvergabe, Aufbewahrung und der organisatorische
        Betrieb sind gesondert zu dokumentieren.
      </p>
    </div>
  );
}
