import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

type Post = {
  id: string;
  client_id: string;
  platform: string;
  title: string | null;
  body: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  pending_approval: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  scheduled: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  published: 'bg-primary/20 text-primary border-primary/40',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function SocialKalender() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name').then(({ data }) => setClients(data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase.from('social_posts').select('id,client_id,platform,title,body,scheduled_at,published_at,status').is('deleted_at', null).order('scheduled_at', { ascending: true });
      if (clientFilter !== 'all') q = q.eq('client_id', clientFilter);
      const { data } = await q;
      setPosts((data ?? []) as Post[]);
    })();
  }, [clientFilter]);

  const { grid, monthLabel } = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startDay = (first.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ date: Date | null; posts: Post[] }> = [];
    for (let i = 0; i < startDay; i++) cells.push({ date: null, posts: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const dayPosts = posts.filter(p => {
        const t = p.scheduled_at ?? p.published_at;
        if (!t) return false;
        const dt = new Date(t);
        return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
      });
      cells.push({ date, posts: dayPosts });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, posts: [] });
    return { grid: cells, monthLabel: cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  }, [cursor, posts]);

  const unscheduled = posts.filter(p => !p.scheduled_at && p.status === 'draft');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content-Kalender</h1>
          <p className="text-muted-foreground mt-1">Redaktionsplan & Veröffentlichungs-Timeline</p>
        </div>
        <div className="flex gap-2">
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Kunde" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kunden</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button asChild><Link to="/social/beitrag/neu"><Plus className="mr-2 h-4 w-4" />Neuer Beitrag</Link></Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />{monthLabel}</CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Heute</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
              <div key={d} className="bg-muted/50 p-2 text-xs font-medium text-center text-muted-foreground">{d}</div>
            ))}
            {grid.map((c, i) => (
              <div key={i} className="bg-card min-h-[100px] p-2 text-xs">
                {c.date && <div className="text-muted-foreground mb-1">{c.date.getDate()}</div>}
                <div className="space-y-1">
                  {c.posts.slice(0, 3).map(p => (
                    <Link key={p.id} to={`/social/beitrag/${p.id}`} className={`block truncate rounded px-1.5 py-0.5 border ${STATUS_COLOR[p.status] ?? ''}`}>
                      {p.platform} · {p.title ?? (p.body ?? '').slice(0, 30)}
                    </Link>
                  ))}
                  {c.posts.length > 3 && <div className="text-muted-foreground">+{c.posts.length - 3} mehr</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {unscheduled.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Nicht geplante Entwürfe ({unscheduled.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unscheduled.map(p => (
              <Link key={p.id} to={`/social/beitrag/${p.id}`} className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/40 transition">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.title ?? (p.body ?? '').slice(0, 60)}</div>
                  <div className="text-xs text-muted-foreground">{p.platform}</div>
                </div>
                <Badge variant="outline" className={STATUS_COLOR[p.status]}>{p.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
