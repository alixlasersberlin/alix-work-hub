import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, FolderTree, FileText, Inbox, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AlixDocs2Dashboard() {
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, unassigned: 0, ocr_errors: 0, servers: 0, folders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [total, today, week, unassigned, ocrErr, servers, folders] = await Promise.all([
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', startToday),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).gte('created_at', startWeek),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'importiert'),
        supabase.from('alixdocs2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'ocr_fehler'),
        supabase.from('alixdocs2_nc_servers').select('*', { count: 'exact', head: true }),
        supabase.from('alixdocs2_nc_watched_folders').select('*', { count: 'exact', head: true }).eq('active', true),
      ]);
      setStats({
        total: total.count ?? 0, today: today.count ?? 0, week: week.count ?? 0,
        unassigned: unassigned.count ?? 0, ocr_errors: ocrErr.count ?? 0,
        servers: servers.count ?? 0, folders: folders.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const tiles = [
    { label: 'Dokumente gesamt', value: stats.total, icon: FileText, to: '/alixdocs2/inbox' },
    { label: 'Importiert heute', value: stats.today, icon: Inbox, to: '/alixdocs2/inbox' },
    { label: 'Importiert (7 Tage)', value: stats.week, icon: Inbox, to: '/alixdocs2/inbox' },
    { label: 'Nicht zugeordnet', value: stats.unassigned, icon: AlertCircle, to: '/alixdocs2/inbox?filter=unassigned' },
    { label: 'OCR-Fehler', value: stats.ocr_errors, icon: AlertCircle, to: '/alixdocs2/inbox?filter=ocr_errors' },
    { label: 'Nextcloud-Server', value: stats.servers, icon: Server, to: '/alixdocs2/nextcloud' },
    { label: 'Überwachte Ordner', value: stats.folders, icon: FolderTree, to: '/alixdocs2/nextcloud' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-display gold-text flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6" /> ALIXDocs AI 2.0 — Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Zentrales KI-Dokumentenmanagement mit Nextcloud-Anbindung. Bestehendes AlixDocs bleibt parallel verfügbar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(t => (
          <Link key={t.label} to={t.to}>
            <Card className="hover:border-primary transition">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.label}</p>
                    <p className="text-3xl font-display gold-text mt-2">{loading ? '—' : t.value}</p>
                  </div>
                  <t.icon className="w-6 h-6 text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Nächste Schritte</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. <Link to="/alixdocs2/nextcloud" className="text-primary underline">Nextcloud-Server anbinden</Link> und Ordner überwachen.</p>
          <p>2. Neue Dateien werden automatisch importiert und im <Link to="/alixdocs2/inbox" className="text-primary underline">Posteingang</Link> angezeigt.</p>
          <p>3. Phase 3+ (OCR, KI-Analyse, Auto-Zuordnung, Volltextsuche) wird im nächsten Rollout aktiviert.</p>
        </CardContent>
      </Card>
    </div>
  );
}
