import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Row { id: string; [k: string]: any }
const num = (n: any) => Number(n ?? 0) || 0;
const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

export default function PlmLieferantenbewertung() {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<Row[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const [s, g] = await Promise.all([
        supabase.from('plm_suppliers' as any).select('*').limit(1000),
        supabase.from('plm_goods_receipts' as any).select('supplier_id,inspection_result,blocked,quantity,received_at').limit(5000),
      ]);
      if (s.error || g.error) toast.error((s.error || g.error)!.message);
      setSuppliers((s.data as any[]) || []);
      setReceipts((g.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    return suppliers.map((s): Row => {
      const rs = receipts.filter(r => r.supplier_id === s.id);
      const total = rs.length;
      const bad = rs.filter(r => r.blocked || ['abweichung', 'gesperrt', 'rueckgesendet'].includes(r.inspection_result)).length;
      const ok = rs.filter(r => r.inspection_result === 'freigegeben').length;
      const defectRate = total ? bad / total : 0;
      const certValid = s.cert_valid_until ? new Date(s.cert_valid_until) >= new Date() : null;

      // Score 0-100: Qualität 50, Zertifikate 20, QSV/NDA 15, manuelle Bewertung 15
      let score = 50 * (total ? 1 - defectRate : 0.8);
      score += certValid === true ? 20 : certValid === false ? 0 : 10;
      score += (s.quality_agreement ? 10 : 0) + (s.nda_signed ? 5 : 0);
      score += (num(s.rating) / 5) * 15;
      score = Math.round(Math.max(0, Math.min(100, score)));

      const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
      return { ...s, total, bad, ok, defectRate, certValid, score, grade };
    }).sort((a, b) => b.score - a.score);
  }, [suppliers, receipts]);

  const filtered = rows.filter(r =>
    !search || `${r.name} ${r.supplier_number || ''} ${r.city || ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  const gradeClass: Record<string, string> = {
    A: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    B: 'bg-sky-500/15 text-sky-500 border-sky-500/30',
    C: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    D: 'bg-destructive/15 text-destructive border-destructive/30',
  };

  const kpis = [
    { label: 'Lieferanten', value: rows.length },
    { label: 'Klasse A', value: rows.filter(r => r.grade === 'A').length },
    { label: 'Zertifikat abgelaufen', value: rows.filter(r => r.certValid === false).length },
    { label: 'Ohne QSV', value: rows.filter(r => !r.quality_agreement).length },
  ];

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <PageHeader
        icon={Award}
        title="Lieferantenbewertung"
        subtitle="Scoring nach ISO 13485: Wareneingangsqualität, Zertifikate, QSV/NDA und manuelle Bewertung."
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
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Lieferant, Nummer, Ort …" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead><TableHead>Lieferant</TableHead><TableHead>Ort</TableHead>
                  <TableHead className="text-right">WE</TableHead><TableHead className="text-right">Abweichungen</TableHead>
                  <TableHead className="text-right">Fehlerquote</TableHead><TableHead>Zertifikat</TableHead>
                  <TableHead className="text-right">Score</TableHead><TableHead>Klasse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-muted-foreground">Keine Lieferanten gefunden.</TableCell></TableRow>}
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.supplier_number || '—'}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.city || '—'}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.bad}</TableCell>
                    <TableCell className="text-right">{r.total ? pct(r.defectRate) : '—'}</TableCell>
                    <TableCell>
                      {r.certValid === null ? <span className="text-muted-foreground">—</span>
                        : r.certValid ? <Badge variant="outline" className={gradeClass.A}>gültig</Badge>
                        : <Badge variant="outline" className={gradeClass.D}>abgelaufen</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.score}</TableCell>
                    <TableCell><Badge variant="outline" className={gradeClass[r.grade]}>{r.grade}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
