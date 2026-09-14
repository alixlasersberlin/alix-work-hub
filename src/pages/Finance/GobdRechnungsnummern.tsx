import { useEffect, useMemo, useState } from 'react';
import { Hash, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type Finding = {
  check_type: string; severity: string; tenant_id: string | null;
  invoice_id: string | null; number: string | null; detail: string;
};

const TITEL: Record<string, string> = {
  DUPLIKAT: 'Doppelte Rechnungsnummer',
  DUPLIKAT_BELEG_ID: 'Doppelte Beleg-ID',
  FORMATFEHLER: 'Formatabweichung',
  OHNE_NUMMER: 'Rechnung ohne Nummer',
  LUECKE: 'Nummernlücke',
  NUMMER_GEAENDERT: 'Nachträgliche Nummernänderung',
  NUMMER_OHNE_RECHNUNG: 'Nummer ohne Rechnung',
};

export default function GobdRechnungsnummern() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ count }, { count: numbered }, res] = await Promise.all([
      supabase.from('zoho_invoices').select('id', { count: 'exact', head: true }),
      supabase.from('zoho_invoices').select('id', { count: 'exact', head: true }).not('legal_invoice_number', 'is', null),
      (supabase as any).rpc('gobd_invoice_number_check', { _tenant_id: null }),
    ]);
    setTotal(count ?? 0);
    setChecked(numbered ?? 0);
    if (res.error) toast.error(res.error.message); else setFindings((res.data ?? []) as Finding[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.check_type] = (c[f.check_type] ?? 0) + 1;
    return c;
  }, [findings]);

  const fehler = findings.filter(f => f.severity === 'FEHLER').length;
  const warnungen = findings.filter(f => f.severity === 'WARNUNG').length;
  const status = fehler > 0 ? 'FEHLER' : warnungen > 0 ? 'WARNUNG' : 'BESTANDEN';

  const kpi = [
    { label: 'Rechnungen gesamt', value: total },
    { label: 'Geprüfte Nummern', value: checked },
    { label: 'Dubletten', value: (counts.DUPLIKAT ?? 0) + (counts.DUPLIKAT_BELEG_ID ?? 0) },
    { label: 'Lücken', value: counts.LUECKE ?? 0 },
    { label: 'Formatfehler', value: counts.FORMATFEHLER ?? 0 },
    { label: 'Ohne Nummer', value: counts.OHNE_NUMMER ?? 0 },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={Hash}
        title="Rechnungsnummern-Prüfung"
        subtitle="Automatische Auswertung auf Dubletten, Lücken und Formatfehler — reine Prüfung ohne Reparatur"
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>}
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpi.map(k => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold mt-1">{loading ? '…' : k.value.toLocaleString('de-DE')}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Ergebnis</CardTitle>
          <Badge variant={status === 'BESTANDEN' ? 'outline' : status === 'WARNUNG' ? 'secondary' : 'destructive'}>
            {loading ? 'Prüfung läuft…' : status}
          </Badge>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Art</TableHead><TableHead>Schwere</TableHead><TableHead>Nummer</TableHead>
                <TableHead>Mandant</TableHead><TableHead>Hinweis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && findings.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Keine Auffälligkeiten gefunden
                </TableCell></TableRow>
              )}
              {findings.slice(0, 500).map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{TITEL[f.check_type] ?? f.check_type}</TableCell>
                  <TableCell><Badge variant={f.severity === 'FEHLER' ? 'destructive' : 'secondary'}>{f.severity}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{f.number ?? '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{f.tenant_id ? f.tenant_id.slice(0, 8) : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-4">
            Stornierte Belege behalten ihre Nummer und gelten nicht als Lücke. Es werden keine Nummern vergeben oder verändert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
