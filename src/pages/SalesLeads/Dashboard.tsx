import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Inbox, Star, TrendingUp, FilePlus, ArrowRight, Trophy } from 'lucide-react';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { PageHeader } from '@/components/infinity/PageHeader';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';

type Row = {
  id: string;
  created_at: string;
  lead_status: string;
  source: string | null;
  device_category: string | null;
  service_rating: number | null;
  converted_offer_id: string | null;
};

function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }

export default function SalesLeadsDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sales_leads')
        .select('id, created_at, lead_status, source, device_category, service_rating, converted_offer_id')
        .order('created_at', { ascending: false })
        .limit(5000);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const today = startOfToday().getTime();
    const month = startOfMonth().getTime();
    const total = rows.length;
    const today_count = rows.filter(r => new Date(r.created_at).getTime() >= today).length;
    const month_count = rows.filter(r => new Date(r.created_at).getTime() >= month).length;
    const offers = rows.filter(r => r.lead_status === 'Angebot erstellt' || r.converted_offer_id).length;
    const won = rows.filter(r => r.lead_status === 'Gewonnen').length;
    const lost = rows.filter(r => r.lead_status === 'Verloren').length;
    const closeRate = (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;
    const rated = rows.filter(r => r.service_rating != null) as Row[];
    const avgRating = rated.length ? (rated.reduce((s, r) => s + (r.service_rating ?? 0), 0) / rated.length) : 0;

    const byCat = new Map<string, number>();
    rows.forEach(r => {
      const k = r.device_category || '—';
      byCat.set(k, (byCat.get(k) ?? 0) + 1);
    });
    const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const bySource = new Map<string, number>();
    rows.forEach(r => {
      const k = r.source || 'manual';
      bySource.set(k, (bySource.get(k) ?? 0) + 1);
    });
    const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

    return { total, today_count, month_count, offers, won, closeRate, avgRating, topCats, sources };
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Verkaufsanfragen"
        subtitle={`Auswertung aller Leads (Top ${Math.min(rows.length, 5000)})`}
        icon={BarChart3}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : 'Live'} pulse={!loading} dotOnly />}
        actions={
          <Link to="/verkauf/anfragen" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            Zur Anfragenliste <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {loading ? (
        <SkeletonKpiGrid count={7} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Neue Leads heute" value={kpis.today_count} icon={Inbox} accent="sky" />
          <KpiTile label="Neue Leads diesen Monat" value={kpis.month_count} icon={Inbox} accent="violet" />
          <KpiTile label="Angebote erstellt" value={kpis.offers} icon={FilePlus} accent="gold" />
          <KpiTile label="Abschlussquote" value={`${kpis.closeRate.toFixed(0)} %`} icon={TrendingUp} accent="emerald" />
          <KpiTile label="Ø Bewertung" value={kpis.avgRating ? kpis.avgRating.toFixed(1) : '—'} icon={Star} accent="gold" />
          <KpiTile label="Leads gesamt" value={kpis.total} icon={BarChart3} accent="sky" />
          <KpiTile label="Gewonnen" value={kpis.won} icon={Trophy} accent="emerald" />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-medium mb-3">Top Geräteklassen</h3>
          <ul className="space-y-2 text-sm">
            {kpis.topCats.length === 0 && <li className="text-muted-foreground">Keine Daten.</li>}
            {kpis.topCats.map(([cat, count]) => (
              <li key={cat} className="flex items-center justify-between border-b last:border-0 py-1.5">
                <span>{cat}</span>
                <Badge variant="outline">{count}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="font-medium mb-3">Aufschlüsselung nach Quelle</h3>
          <ul className="space-y-2 text-sm">
            {kpis.sources.map(([src, count]) => (
              <li key={src} className="flex items-center justify-between border-b last:border-0 py-1.5">
                <span className="capitalize">{src.replace('_', ' ')}</span>
                <Badge variant="outline">{count}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: any; icon?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}
