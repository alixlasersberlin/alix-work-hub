// Product Hub → Übersetzungen → Katalog-Audit (Englisch-Vorbereitung)
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { phListProducts } from '@/lib/producthub/api';
import { PH_TR_STATUS } from '@/lib/producthub/i18n';
import {
  PH_QA_LABEL, PH_READINESS_TONE, phBuildAudit, phLoadComMap, phLoadQa,
  phLoadTranslationsAllFields, type PhAuditRow,
} from '@/lib/producthub/enReadiness';

export function CatalogAuditPanel({ onOpen }: { onOpen?: (id: string) => void }) {
  const [rows, setRows] = useState<PhAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [prods, trs, qa, com] = await Promise.all([
        phListProducts(), phLoadTranslationsAllFields(['de', 'en']), phLoadQa('en'), phLoadComMap(),
      ]);
      setRows(phBuildAudit(prods, trs, qa, com));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => [r.product.name, r.hubId, r.product.model, r.product.sku]
      .some(v => (v || '').toLowerCase().includes(s)));
  }, [rows, q]);

  const badHubIds = rows.filter(r => !r.hubIdValid);
  const techText = rows.filter(r => r.technicalTextValues.length > 0);

  const kpi = [
    { label: 'Geräte gesamt', value: rows.length },
    { label: 'EN vorhanden', value: rows.filter(r => r.en).length },
    { label: 'PASS', value: rows.filter(r => r.qa?.status === 'pass').length },
    { label: 'WARNING', value: rows.filter(r => r.qa?.status === 'warning').length },
    { label: 'BLOCKED', value: rows.filter(r => r.qa?.status === 'blocked').length },
    { label: 'Hub-ID prüfen', value: badHubIds.length },
    { label: '.com-Zuordnung fehlt', value: rows.filter(r => !r.comMapped).length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpi.map(k => (
          <Card key={k.label}><CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-semibold">{k.value}</div>
          </CardContent></Card>
        ))}
      </div>

      {badHubIds.length > 0 && (
        <Card className="border-amber-500/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-500 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" /> Geräte mit fehlender oder unklarer Hub-ID – nicht automatisch bearbeitet
            </div>
            <ul className="text-sm text-muted-foreground list-disc pl-5">
              {badHubIds.map(r => (
                <li key={r.product.id}>{r.product.name} — Hub-ID: {r.hubId ?? '—'}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {techText.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="text-sm font-medium">Sprachabhängige technische Textwerte ({techText.length} Geräte)</div>
            <p className="text-xs text-muted-foreground">
              Diese Felder enthalten beschreibenden Text und werden über die Sprachpflege übersetzt.
              Zahlenwerte, Wellenlängen und Leistungsangaben bleiben unverändert.
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {[...new Set(techText.flatMap(r => r.technicalTextValues))].map(t => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px] space-y-1.5">
            <Label className="text-xs">Suche</Label>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Gerät, Hub-ID, Modell, SKU" />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Neu laden
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gerät</TableHead>
                <TableHead>Hub-ID</TableHead>
                <TableHead>Status DE</TableHead>
                <TableHead>EN vorhanden</TableHead>
                <TableHead>EN Status</TableHead>
                <TableHead className="w-[180px]">Vollständigkeit</TableHead>
                <TableHead>Website-Mapping</TableHead>
                <TableHead>Readiness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.product.id} className="cursor-pointer" onClick={() => onOpen?.(r.product.id)}>
                  <TableCell className="font-medium">{r.product.name}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {r.hubId ?? <span className="text-destructive">fehlt</span>}
                    {r.hubId && !r.hubIdValid && <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500/40">prüfen</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{r.deStatus}</TableCell>
                  <TableCell className="text-xs">{r.en ? 'ja' : 'nein'}</TableCell>
                  <TableCell className="text-xs">{PH_TR_STATUS[(r.enStatus as keyof typeof PH_TR_STATUS)]?.label ?? r.enStatus}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.completeness} className="h-1.5 w-24" />
                      <span className="text-xs text-muted-foreground">{r.completeness}%</span>
                    </div>
                    {r.missing.length > 0 && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[220px]" title={r.missing.join(', ')}>
                        fehlt: {r.missing.join(', ')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.comMapped ? 'alix-lasers.com' : '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PH_READINESS_TONE[r.readiness]}>{r.readiness}</Badge>
                    {r.qa && (
                      <Badge variant="outline" className={`ml-1 ${PH_QA_LABEL[r.qa.status].tone}`}>
                        {PH_QA_LABEL[r.qa.status].label}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && !loading && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Keine Geräte gefunden.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
