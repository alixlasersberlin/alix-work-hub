import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, RefreshCw, Users, Hash, Sparkles } from 'lucide-react';

type Client = { id: string; company_name: string };
type Comp = { id: string; platform: string; handle: string; display_name: string | null; last_snapshot_at: string | null };
type Snap = { competitor_id: string; snapshot_date: string; followers: number; posts_count: number; avg_engagement_rate: number; top_hashtags: string[] | null };

export default function SocialWettbewerber() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [comps, setComps] = useState<Comp[]>([]);
  const [snaps, setSnaps] = useState<Record<string, Snap | undefined>>({});
  const [hashtags, setHashtags] = useState<any[]>([]);
  const [form, setForm] = useState({ platform: 'instagram', handle: '', display_name: '' });
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name')
      .then(({ data }) => setClients(data ?? []));
  }, []);

  async function load() {
    if (!clientId) return;
    const { data: c } = await supabase.from('social_competitors').select('*').eq('client_id', clientId).order('handle');
    setComps((c ?? []) as any);
    if (c?.length) {
      const { data: s } = await supabase.from('social_competitor_snapshots')
        .select('*').in('competitor_id', c.map((x: any) => x.id))
        .order('snapshot_date', { ascending: false });
      const latest: Record<string, Snap> = {};
      for (const row of s ?? []) if (!latest[row.competitor_id]) latest[row.competitor_id] = row as any;
      setSnaps(latest);
    }
    const { data: h } = await supabase.from('social_hashtag_research')
      .select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30);
    setHashtags(h ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  async function addComp() {
    if (!clientId || !form.handle) return;
    const { error } = await supabase.from('social_competitors').insert({ client_id: clientId, ...form });
    if (error) return toast.error(error.message);
    setForm({ platform: 'instagram', handle: '', display_name: '' });
    toast.success('Wettbewerber hinzugefügt');
    load();
  }

  async function sync() {
    setLoading(true);
    const { error } = await supabase.functions.invoke('social-competitors-sync', { body: { client_id: clientId } });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Snapshots aktualisiert');
    load();
  }

  async function research() {
    if (!clientId || !topic) return;
    setLoading(true);
    const { error } = await supabase.functions.invoke('social-hashtag-research', {
      body: { client_id: clientId, platform: form.platform, topic },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setTopic('');
    toast.success('Hashtags recherchiert');
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wettbewerber & Trends</h1>
        <p className="text-muted-foreground mt-1">Benchmarking der Mitbewerber und KI-Hashtag-Analyse</p>
      </div>

      <Card><CardContent className="pt-6">
        <Label>Kunde</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="max-w-md mt-1"><SelectValue placeholder="Kunde…" /></SelectTrigger>
          <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent></Card>

      {clientId && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Wettbewerber</CardTitle>
              <Button onClick={sync} disabled={loading || !comps.length} variant="outline" size="sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Snapshots aktualisieren
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-4">
                <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['instagram','facebook','linkedin','tiktok','youtube'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Handle" value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} />
                <Input placeholder="Anzeigename (optional)" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
                <Button onClick={addComp}><Plus className="mr-2 h-4 w-4" />Hinzufügen</Button>
              </div>

              {comps.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Noch keine Wettbewerber angelegt.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr><th className="text-left py-2">Wettbewerber</th><th>Follower</th><th>Posts</th><th>Ø Engagement</th><th>Top Hashtags</th></tr>
                    </thead>
                    <tbody>
                      {comps.map(c => {
                        const s = snaps[c.id];
                        return (
                          <tr key={c.id} className="border-b border-border/40">
                            <td className="py-2"><div className="font-medium">{c.display_name ?? c.handle}</div><div className="text-xs text-muted-foreground">{c.platform} · {c.handle}</div></td>
                            <td className="text-center">{s ? s.followers.toLocaleString('de-DE') : '—'}</td>
                            <td className="text-center">{s?.posts_count ?? '—'}</td>
                            <td className="text-center">{s ? `${s.avg_engagement_rate}%` : '—'}</td>
                            <td className="text-center text-xs">{s?.top_hashtags?.join(' ') ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Hash className="h-5 w-5" />KI-Hashtag-Recherche</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['instagram','facebook','linkedin','tiktok','youtube'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Thema, z.B. 'Laser Haarentfernung'" value={topic} onChange={e => setTopic(e.target.value)} />
                <Button onClick={research} disabled={loading || !topic}>
                  <Sparkles className="mr-2 h-4 w-4" />Recherchieren
                </Button>
              </div>

              {hashtags.length > 0 && (
                <div className="grid gap-2 md:grid-cols-2">
                  {hashtags.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                      <div>
                        <div className="font-mono text-sm">{h.hashtag}</div>
                        <div className="text-xs text-muted-foreground">{h.platform} · Vol {Number(h.volume).toLocaleString('de-DE')}</div>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px]">Diff {h.difficulty}</Badge>
                        <Badge variant={h.trend === 'rising' ? 'default' : 'outline'} className="text-[10px]">{h.trend}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
