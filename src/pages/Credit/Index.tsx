import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCreditPermissions } from '@/hooks/useCreditPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Plus, Gauge, AlertOctagon, TrendingUp, Users } from 'lucide-react';
import type { CreditAssessment, CreditAmpel } from '@/lib/credit/types';

const AMPEL_COLOR: Record<CreditAmpel, string> = {
  gruen: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  gelb: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  rot: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Entwurf', calculating: 'Berechnung', pending_review: 'Prüfung offen',
  approved: 'Freigegeben', approved_with_conditions: 'Freigegeben mit Auflagen',
  rejected: 'Abgelehnt', expired: 'Abgelaufen', cancelled: 'Storniert',
};

export default function CreditIndex() {
  const nav = useNavigate();
  const { canView, canWrite } = useCreditPermissions();
  const [items, setItems] = useState<CreditAssessment[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('credit_assessments' as any).select('*').order('created_at', { ascending: false }).limit(200);
      setItems((data ?? []) as unknown as CreditAssessment[]);
      setLoading(false);
    })();
  }, [canView]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => JSON.stringify(i.customer_snapshot).toLowerCase().includes(t) || String(i.score ?? '').includes(t) || i.status.includes(t));
  }, [items, q]);

  const kpi = useMemo(() => {
    const open = items.filter((i) => i.status === 'pending_review').length;
    const green = items.filter((i) => i.ampel === 'gruen').length;
    const red = items.filter((i) => i.ampel === 'rot').length;
    const avg = items.length ? Math.round(items.reduce((a, i) => a + (i.score ?? 0), 0) / items.length) : 0;
    return { open, green, red, avg };
  }, [items]);

  if (!canView) {
    return <div className="p-8 text-center text-muted-foreground">Kein Zugriff auf ALIX CREDIT SCORE®.</div>;
  }

  return (
    <div className="p-4 lg:p-6 animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[2px] text-primary/80">Bonität &amp; Finanzierung</div>
            <h1 className="text-2xl font-display font-bold text-foreground">ALIX CREDIT SCORE®</h1>
          </div>
        </div>
        {canWrite && (
          <Button onClick={() => nav('/bonitaet/neu')} className="gap-2">
            <Plus className="w-4 h-4" /> Neue Bonitätsprüfung
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<Gauge className="w-4 h-4" />} label="Ø Score" value={kpi.avg} />
        <Kpi icon={<Users className="w-4 h-4" />} label="Offene Prüfungen" value={kpi.open} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="🟢 Grün" value={kpi.green} />
        <Kpi icon={<AlertOctagon className="w-4 h-4" />} label="🔴 Rot" value={kpi.red} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Alle Bonitätsprüfungen</CardTitle>
          <Input placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Lade …</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Noch keine Prüfungen. Neue Bonitätsprüfung anlegen.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Ampel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stufe</TableHead>
                  <TableHead>Erstellt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => nav(`/bonitaet/${a.id}`)}>
                    <TableCell className="font-medium">
                      {(a.customer_snapshot as any)?.company_name || (a.customer_snapshot as any)?.name || '—'}
                    </TableCell>
                    <TableCell>{a.customer_type === 'company' ? 'Firma' : 'Privat'}</TableCell>
                    <TableCell className="font-mono">{a.score ?? '—'}</TableCell>
                    <TableCell>
                      {a.ampel ? <Badge variant="outline" className={AMPEL_COLOR[a.ampel]}>{a.ampel.toUpperCase()}</Badge> : '—'}
                    </TableCell>
                    <TableCell><Badge variant="outline">{STATUS_LABEL[a.status] ?? a.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.workflow_stage}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('de-DE')}</TableCell>
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

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">{icon}{label}</div>
        <div className="text-3xl font-display font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
