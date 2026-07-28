import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Inbox, AlertCircle, CheckCircle2, Star, Clock, Search, Workflow,
  Sparkles, Users, ListChecks, Activity, FolderKanban, GitBranch, Bot, Database
} from 'lucide-react';

type Doc = {
  id: string;
  title: string | null;
  doc_type: string | null;
  status: string | null;
  updated_at: string;
  created_at: string;
};

type Task = {
  id: string;
  doc_id: string | null;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
};

type ActivityItem = {
  id: string;
  doc_id: string | null;
  actor_id: string | null;
  action: string;
  detail: any;
  created_at: string;
};

export default function AlixDocsEnterpriseHub() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0, today: 0, week: 0, unassigned: 0, ocrErr: 0,
    approvals: 0, tasksOpen: 0, favs: 0,
  });
  const [recent, setRecent] = useState<Doc[]>([]);
  const [favorites, setFavorites] = useState<Doc[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Doc[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [total, today, week, unassigned, ocrErr, approvals, tasksOpen, favIds, recentQ, actQ, myTasks] = await Promise.all([
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', startToday),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', startWeek),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'importiert'),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'ocr_fehler'),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('approval_status', 'pending'),
        supabase.from('alixdocs2_tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('alixdocs2_favorites').select('doc_id').eq('user_id', user?.id ?? '00000000-0000-0000-0000-000000000000'),
        supabase.from('alixdocs2_documents').select('id,title,doc_type,status,created_at,updated_at').is('deleted_at', null).order('updated_at', { ascending: false }).limit(8),
        supabase.from('alixdocs2_activity').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('alixdocs2_tasks').select('*').or(`assignee.eq.${user?.id ?? '00000000-0000-0000-0000-000000000000'},created_by.eq.${user?.id ?? '00000000-0000-0000-0000-000000000000'}`).neq('status', 'done').order('due_at', { ascending: true, nullsFirst: false }).limit(8),
      ]);

      setStats({
        total: total.count ?? 0,
        today: today.count ?? 0,
        week: week.count ?? 0,
        unassigned: unassigned.count ?? 0,
        ocrErr: ocrErr.count ?? 0,
        approvals: approvals.count ?? 0,
        tasksOpen: tasksOpen.count ?? 0,
        favs: favIds.data?.length ?? 0,
      });
      setRecent((recentQ.data as Doc[]) ?? []);
      setActivity((actQ.data as ActivityItem[]) ?? []);
      setTasks((myTasks.data as Task[]) ?? []);

      const favDocIds = (favIds.data ?? []).map((r: any) => r.doc_id);
      if (favDocIds.length) {
        const { data: favDocs } = await supabase
          .from('alixdocs2_documents')
          .select('id,title,doc_type,status,created_at,updated_at')
          .in('id', favDocIds).is('deleted_at', null).limit(8);
        setFavorites((favDocs as Doc[]) ?? []);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  // Debounced global search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('alixdocs2_documents')
        .select('id,title,doc_type,status,created_at,updated_at')
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,ocr_text.ilike.%${query}%`)
        .order('updated_at', { ascending: false })
        .limit(15);
      setResults((data as Doc[]) ?? []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const tiles = useMemo(() => [
    { label: 'Dokumente gesamt', value: stats.total, icon: FileText, to: '/alixdocs2/suche', accent: 'text-primary' },
    { label: 'Heute importiert', value: stats.today, icon: Inbox, to: '/alixdocs2/inbox' },
    { label: 'Diese Woche', value: stats.week, icon: Clock, to: '/alixdocs2/inbox' },
    { label: 'Freigaben offen', value: stats.approvals, icon: CheckCircle2, to: '/alixdocs2/workflows', accent: 'text-amber-500' },
    { label: 'Meine Aufgaben', value: stats.tasksOpen, icon: ListChecks, to: '/alixdocs/aufgaben', accent: 'text-blue-500' },
    { label: 'Favoriten', value: stats.favs, icon: Star, to: '#favs', accent: 'text-yellow-500' },
    { label: 'Nicht zugeordnet', value: stats.unassigned, icon: AlertCircle, to: '/alixdocs2/inbox?filter=unassigned', accent: 'text-orange-500' },
    { label: 'OCR-Fehler', value: stats.ocrErr, icon: AlertCircle, to: '/alixdocs2/inbox?filter=ocr_errors', accent: 'text-red-500' },
  ], [stats]);

  const quickLinks = [
    { to: '/alixdocs2/suche', label: 'Suche', icon: Search },
    { to: '/alixdocs2/ai', label: 'KI-Suche', icon: Sparkles },
    { to: '/alixdocs2/inbox', label: 'Posteingang', icon: Inbox },
    { to: '/alixdocs2/workflows', label: 'Workflows', icon: Workflow },
    { to: '/alixdocs/aufgaben', label: 'Aufgaben', icon: ListChecks },
    { to: '/alixdocs2/nextcloud', label: 'Nextcloud', icon: FolderKanban },
    { to: '/alixdocs2/compliance', label: 'Compliance', icon: GitBranch },
    { to: '/alixdocs2/doctypes', label: 'Dokumententypen', icon: Database },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display gold-text flex items-center gap-2">
            <Sparkles className="w-7 h-7" /> ALIXDocs Enterprise 3.0
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ein zentrales Dokumenten-Betriebssystem – Suche, Freigaben, Aufgaben, KI-Copilot & Live-Kollaboration.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickLinks.map(l => (
            <Button key={l.to} variant="outline" size="sm" asChild>
              <Link to={l.to}><l.icon className="w-4 h-4 mr-1" />{l.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Global Search */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Alle Dokumente durchsuchen – Titel, OCR-Text, Metadaten…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 text-base"
            />
            {searching && <span className="text-xs text-muted-foreground">sucht…</span>}
          </div>
          {results.length > 0 && (
            <div className="mt-3 divide-y border rounded-md">
              {results.map(d => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/alixdocs2/dokument/${d.id}`)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center justify-between"
                >
                  <span className="truncate">
                    <FileText className="w-3.5 h-3.5 inline mr-2 text-muted-foreground" />
                    {d.title || '(ohne Titel)'}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {d.doc_type && <Badge variant="outline">{d.doc_type}</Badge>}
                    {d.status && <Badge variant="secondary">{d.status}</Badge>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {tiles.map(t => (
          <Link key={t.label} to={t.to}>
            <Card className="hover:border-primary transition h-full">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{t.label}</p>
                    <p className={`text-2xl font-display gold-text mt-1 ${t.accent ?? ''}`}>{loading ? '—' : t.value}</p>
                  </div>
                  <t.icon className={`w-5 h-5 ${t.accent ?? 'text-primary'}`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Zuletzt bearbeitet</CardTitle>
            <Link to="/alixdocs2/suche" className="text-xs text-primary hover:underline">Alle</Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.length === 0 && !loading && <p className="text-sm text-muted-foreground">Noch keine Dokumente.</p>}
            {recent.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/alixdocs2/dokument/${d.id}`)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 flex items-center justify-between"
              >
                <span className="truncate text-sm">
                  <FileText className="w-3.5 h-3.5 inline mr-2 text-muted-foreground" />
                  {d.title || '(ohne Titel)'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(d.updated_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-4 h-4" /> Meine Aufgaben</CardTitle>
            <Link to="/alixdocs/aufgaben" className="text-xs text-primary hover:underline">Alle</Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {tasks.length === 0 && !loading && <p className="text-sm text-muted-foreground">Keine offenen Aufgaben.</p>}
            {tasks.map(t => (
              <div key={t.id} className="px-2 py-1.5 rounded hover:bg-muted/50 flex items-center justify-between">
                <span className="truncate text-sm">
                  {t.priority === 'urgent' && <span className="text-red-500 mr-1">●</span>}
                  {t.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.due_at ? new Date(t.due_at).toLocaleDateString('de-DE') : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Favorites */}
        <Card id="favs">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Favoriten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {favorites.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                Noch keine Favoriten. Markiere ein Dokument mit ⭐ um es hier zu sehen.
              </p>
            )}
            {favorites.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/alixdocs2/dokument/${d.id}`)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted/50 flex items-center justify-between"
              >
                <span className="truncate text-sm">
                  <Star className="w-3.5 h-3.5 inline mr-2 text-yellow-500" />
                  {d.title || '(ohne Titel)'}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Aktivität</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">Noch keine Aktivität aufgezeichnet.</p>
            )}
            {activity.map(a => (
              <div key={a.id} className="px-2 py-1.5 text-sm flex items-center justify-between border-b last:border-0">
                <span className="truncate">
                  <Badge variant="outline" className="mr-2 text-[10px]">{a.action}</Badge>
                  {a.detail?.title ?? a.detail?.text ?? (a.doc_id ? `Dokument ${a.doc_id.slice(0,8)}…` : '—')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Roadmap footer */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Bot className="w-4 h-4" /> Enterprise 3.0 – Roadmap</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1 text-muted-foreground">
          <p>✅ <strong>E1</strong> Enterprise-Hub & Globale Suche <span className="text-primary">(aktiv)</span></p>
          <p>🚧 <strong>E2</strong> Diskussion, @Mentions & Aufgaben-Panel</p>
          <p>🚧 <strong>E3</strong> Konfigurierbare Workflow-Engine & Version-Diff</p>
          <p>🚧 <strong>E4</strong> KI-Copilot (Zusammenfassen, Klassifizieren, Fragen zum Dokument)</p>
          <p>🚧 <strong>E5</strong> Semantische Suche (pgvector) & OCR-Backfill</p>
          <p>🚧 <strong>E6</strong> Office-Editor (TipTap / Univer Sheets)</p>
          <p>🚧 <strong>E7</strong> Live-Kollaboration (Y.js) & Mobile-Polish</p>
        </CardContent>
      </Card>
    </div>
  );
}
