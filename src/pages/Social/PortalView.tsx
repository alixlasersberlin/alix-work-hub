import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Heart, Eye } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function SocialPortalView() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/social-portal?token=${token}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Fehler');
        setData(j);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [token]);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <div className="text-2xl mb-2">🔒</div>
        <div className="font-semibold">Link ungültig oder abgelaufen</div>
        <div className="text-sm text-muted-foreground mt-1">{error}</div>
      </CardContent></Card>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lade…</div>;

  const KPI = ({ icon: Icon, label, value }: any) => (
    <Card><CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1">{value}</div>
        </div>
        <Icon className="h-8 w-8 text-primary/70" />
      </div>
    </CardContent></Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="border-b pb-4">
          <div className="text-sm text-muted-foreground">Social-Media-Analytics</div>
          <h1 className="text-3xl font-bold">{data.client}</h1>
          <div className="text-sm text-muted-foreground mt-1">Letzte 30 Tage</div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <KPI icon={Eye} label="Impressions" value={Number(data.kpis.impressions).toLocaleString('de-DE')} />
          <KPI icon={TrendingUp} label="Reichweite" value={Number(data.kpis.reach).toLocaleString('de-DE')} />
          <KPI icon={Heart} label="Likes" value={Number(data.kpis.likes).toLocaleString('de-DE')} />
          <KPI icon={BarChart3} label="Ø Engagement" value={`${data.kpis.avg_engagement_rate}%`} />
        </div>

        <Card>
          <CardHeader><CardTitle>Aktuelle Beiträge</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.recent_posts?.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Noch keine veröffentlichten Beiträge.</div>}
            {data.recent_posts?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{p.title || '(ohne Titel)'}</div>
                  <div className="text-xs text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleString('de-DE') : ''}</div>
                </div>
                <Badge variant="outline">{p.platform}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground pt-8">
          Bereitgestellt von AlixWork · Social Media Management
        </div>
      </div>
    </div>
  );
}
