import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, RefreshCw, TrendingUp, Users, Heart, MessageCircle, Share2, Eye, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';

type Metric = {
  post_id: string;
  client_id: string;
  platform: string;
  metric_date: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
  engagement_rate: number;
};

type Post = { id: string; title: string | null; platform: string; published_at: string | null; client_id: string };

const PLATFORMS = ['all', 'facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'x', 'pinterest'];

export default function SocialAnalytics() {
  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [clientId, setClientId] = useState<string>('all');
  const [platform, setPlatform] = useState<string>('all');
  const [days, setDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [posts, setPosts] = useState<Record<string, Post>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    let q = supabase.from('social_post_metrics')
      .select('post_id,client_id,platform,metric_date,impressions,reach,likes,comments,shares,clicks,saves,engagement_rate')
      .gte('metric_date', since)
      .order('metric_date', { ascending: false })
      .limit(2000);
    if (clientId !== 'all') q = q.eq('client_id', clientId);
    if (platform !== 'all') q = q.eq('platform', platform);
    const { data } = await q;
    setMetrics((data as Metric[]) ?? []);

    const ids = Array.from(new Set((data ?? []).map((m: any) => m.post_id)));
    if (ids.length) {
      const { data: p } = await supabase
        .from('social_posts')
        .select('id,title,platform,published_at,client_id')
        .in('id', ids);
      const map: Record<string, Post> = {};
      (p ?? []).forEach((x: any) => (map[x.id] = x));
      setPosts(map);
    } else {
      setPosts({});
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name').then(({ data }) => setClients(data ?? []));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId, platform, days]);

  const totals = useMemo(() => {
    const t = { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0 };
    metrics.forEach(m => {
      t.impressions += m.impressions; t.reach += m.reach; t.likes += m.likes;
      t.comments += m.comments; t.shares += m.shares; t.clicks += m.clicks; t.saves += m.saves;
    });
    const eng = t.reach > 0 ? (t.likes + t.comments + t.shares + t.saves) / t.reach : 0;
    return { ...t, engagement: eng };
  }, [metrics]);

  const byPlatform = useMemo(() => {
    const map: Record<string, { impressions: number; engagement: number; posts: Set<string> }> = {};
    metrics.forEach(m => {
      const b = map[m.platform] ??= { impressions: 0, engagement: 0, posts: new Set() };
      b.impressions += m.impressions;
      b.engagement += m.likes + m.comments + m.shares + m.saves;
      b.posts.add(m.post_id);
    });
    return Object.entries(map).map(([platform, v]) => ({
      platform, impressions: v.impressions, engagement: v.engagement, posts: v.posts.size,
    })).sort((a, b) => b.impressions - a.impressions);
  }, [metrics]);

  const topPosts = useMemo(() => {
    const agg: Record<string, { impressions: number; engagement: number; reach: number }> = {};
    metrics.forEach(m => {
      const b = agg[m.post_id] ??= { impressions: 0, engagement: 0, reach: 0 };
      b.impressions += m.impressions; b.reach += m.reach;
      b.engagement += m.likes + m.comments + m.shares + m.saves;
    });
    return Object.entries(agg)
      .map(([id, v]) => ({ id, ...v, rate: v.reach > 0 ? v.engagement / v.reach : 0 }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);
  }, [metrics]);

  const runSync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('social-metrics-sync', { body: { action: 'sync' } });
    setSyncing(false);
    if (error || (data as any)?.error) return toast.error(error?.message ?? (data as any)?.error);
    toast.success(`Metriken aktualisiert (${(data as any)?.updated ?? 0})`);
    load();
  };

  const fmt = (n: number) => new Intl.NumberFormat('de-DE').format(n);
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

  const KPI = ({ icon: Icon, label, value, hint }: any) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <Icon className="h-7 w-7 text-primary/70" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Analytics</h1>
          <p className="text-muted-foreground mt-1">Reichweite, Engagement & Top-Content pro Kunde und Plattform</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Kunde" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kunden</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Plattform" /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'Alle Plattformen' : p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Tage</SelectItem>
              <SelectItem value="30">30 Tage</SelectItem>
              <SelectItem value="90">90 Tage</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={runSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />Sync
          </Button>
          <Button asChild variant="outline"><Link to="/social/veroeffentlichung">Publishing-Queue</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPI icon={Eye} label="Impressionen" value={fmt(totals.impressions)} />
        <KPI icon={Users} label="Reichweite" value={fmt(totals.reach)} />
        <KPI icon={Heart} label="Likes" value={fmt(totals.likes)} />
        <KPI icon={MessageCircle} label="Kommentare" value={fmt(totals.comments)} />
        <KPI icon={Share2} label="Shares" value={fmt(totals.shares)} />
        <KPI icon={TrendingUp} label="Engagement" value={pct(totals.engagement)} hint={`${fmt(totals.clicks)} Klicks`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Nach Plattform</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="text-sm text-muted-foreground">lädt…</div> : byPlatform.length === 0 ? (
              <div className="text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</div>
            ) : (
              <div className="space-y-2">
                {byPlatform.map(row => {
                  const max = Math.max(...byPlatform.map(r => r.impressions), 1);
                  const w = Math.round((row.impressions / max) * 100);
                  return (
                    <div key={row.platform}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{row.platform} <Badge variant="outline" className="ml-1">{row.posts} Posts</Badge></span>
                        <span className="tabular-nums">{fmt(row.impressions)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-primary/40" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-primary" />Top 10 Beiträge</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="text-sm text-muted-foreground">lädt…</div> : topPosts.length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine Metriken.</div>
            ) : (
              <div className="space-y-2">
                {topPosts.map(p => {
                  const post = posts[p.id];
                  return (
                    <Link key={p.id} to={`/social/beitrag/${p.id}`} className="block rounded-md border border-border/50 p-3 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{post?.title || '(ohne Titel)'}</div>
                          <div className="text-xs text-muted-foreground capitalize">{post?.platform ?? '—'} · {post?.published_at ? new Date(post.published_at).toLocaleDateString('de-DE') : 'Entwurf'}</div>
                        </div>
                        <div className="text-right text-xs shrink-0">
                          <div className="tabular-nums">{fmt(p.impressions)} Impr.</div>
                          <div className="text-muted-foreground">ER {pct(p.rate)}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
