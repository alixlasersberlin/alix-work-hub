// Mediapaket Extras Panel: Timeline (25), Versionen, Workflow, Chat (31), Sign-Off & Audit (35)

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, History as HistoryIcon, GitBranch, Send, Package, CheckCircle2, PlayCircle, Eye, Download, MessageCircle, Upload, Mail, Copy as CopyIcon, PenTool, FileDown } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  mpId: string;
  status: string;
  onChanged: () => void;
}

const NEXT_STATUS: Record<string, { label: string; next: string; icon: any; color: string }[]> = {
  submitted: [{ label: 'In Prüfung setzen', next: 'in_review', icon: Eye, color: 'bg-blue-500/20 text-blue-500 border-blue-500/40' }],
  in_review: [{ label: 'Freigeben & an Produktion', next: 'in_production', icon: PlayCircle, color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40' }],
  in_production: [{ label: 'Als abgeschlossen markieren', next: 'completed', icon: CheckCircle2, color: 'bg-primary/20 text-primary border-primary/40' }],
};

const ACTION_LABEL: Record<string, { label: string; icon: any; color: string }> = {
  submitted: { label: 'Kunde eingereicht', icon: Send, color: 'text-emerald-500' },
  customer_link_sent: { label: 'Kundenlink gesendet', icon: Mail, color: 'text-blue-500' },
  customer_answered: { label: 'Kunde geantwortet', icon: MessageCircle, color: 'text-amber-500' },
  question_email_sent: { label: 'Rückfrage gesendet', icon: MessageCircle, color: 'text-amber-500' },
  submit_email_sent: { label: 'Team benachrichtigt', icon: Mail, color: 'text-blue-500' },
  answer_email_sent: { label: 'Team benachrichtigt (Antwort)', icon: Mail, color: 'text-blue-500' },
  reminder_sent_customer: { label: 'Erinnerung an Kunde', icon: Mail, color: 'text-orange-500' },
  overdue_alert_staff: { label: 'Überfälligkeits-Alert', icon: Mail, color: 'text-red-500' },
  file_uploaded: { label: 'Datei hochgeladen', icon: Upload, color: 'text-blue-500' },
  file_downloaded: { label: 'Datei heruntergeladen', icon: Download, color: 'text-blue-500' },
  status_changed: { label: 'Status geändert', icon: GitBranch, color: 'text-purple-500' },
};

export default function MediapaketExtrasPanel({ mpId, status, onChanged }: Props) {
  const [history, setHistory] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotOpen, setSnapshotOpen] = useState<any | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [h, d, c] = await Promise.all([
      supabase.from('media_package_history').select('*').eq('media_package_id', mpId).order('created_at', { ascending: false }).limit(200),
      supabase.from('media_package_file_downloads').select('id, file_id, downloaded_by, downloader_type, created_at, media_package_files(original_filename)').eq('media_package_id', mpId).order('created_at', { ascending: false }).limit(100),
      supabase.from('media_package_comments').select('id, subject, comment, author_type, created_at, internal_only').eq('media_package_id', mpId).order('created_at', { ascending: false }).limit(100),
    ]);
    setHistory((h.data as any[]) || []);
    setDownloads((d.data as any[]) || []);
    setComments((c.data as any[]) || []);
    setLoading(false);
  }, [mpId]);

  useEffect(() => { load(); }, [load]);

  const snapshots = history.filter(h => h.action === 'submitted' && h.new_value);

  const timeline = [
    ...history.map(h => ({ kind: 'history' as const, id: h.id, at: h.created_at, action: h.action, data: h })),
    ...downloads.map(d => ({ kind: 'download' as const, id: d.id, at: d.created_at, action: 'file_downloaded', data: d })),
    ...comments.map(c => ({ kind: 'comment' as const, id: c.id, at: c.created_at, action: c.author_type === 'customer' ? 'customer_answered' : (c.internal_only ? 'status_changed' : 'question_email_sent'), data: c })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const transition = async (next: string, label: string) => {
    if (!confirm(`Status ändern auf "${label}"?`)) return;
    setTransitioning(next);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('media_packages').update({ status: next as any }).eq('id', mpId);
    if (!error) {
      await supabase.from('media_package_history').insert({
        media_package_id: mpId, action: 'status_changed', user_id: userData.user?.id ?? null,
        old_value: { status } as any, new_value: { status: next } as any,
      });
      // Phase 34 — Production Handoff: auf 'completed' automatisch Grafik-Task erzeugen
      if (next === 'completed') {
        try {
          await supabase.functions.invoke('mediapaket-portal', { body: { action: 'handoff_production', mp_id: mpId } });
          toast.success('Grafik-Team benachrichtigt');
        } catch (e) { /* nicht kritisch */ }
      }
      // Phase 31 — Kunde informieren bei relevantem Status
      if (['in_review', 'in_production', 'completed'].includes(next)) {
        try {
          await supabase.functions.invoke('mediapaket-portal', { body: { action: 'notify_customer_status', mp_id: mpId, new_status: next } });
        } catch (e) { /* nicht kritisch */ }
      }
      toast.success(`Status: ${label}`);
      onChanged(); load();
    } else toast.error(error.message);
    setTransitioning(null);
  };

  const duplicate = async () => {
    if (!confirm('Dieses Mediapaket komplett duplizieren (ohne Dateien)?')) return;
    setDuplicating(true);
    try {
      const { data, error } = await supabase.functions.invoke('mediapaket-portal', {
        body: { action: 'duplicate', mp_id: mpId },
      });
      if (error) throw error;
      toast.success('Dupliziert. Neues Paket-ID: ' + data?.new_mp_id);
      if (data?.order_id) window.open(`/auftraege/${data.order_id}?tab=mediapaket`, '_blank');
    } catch (e: any) { toast.error(e.message); }
    finally { setDuplicating(false); }
  };

  const downloadAll = async () => {
    setZipping(true);
    try {
      const { data: files } = await supabase.from('media_package_files').select('storage_path, original_filename').eq('media_package_id', mpId);
      if (!files?.length) { toast.info('Keine Dateien vorhanden'); return; }
      for (const f of files) {
        const { data: url } = await supabase.storage.from('mediapaket-files').createSignedUrl(f.storage_path, 3600);
        if (url?.signedUrl) {
          const a = document.createElement('a');
          a.href = url.signedUrl;
          a.download = f.original_filename;
          a.target = '_blank';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          await new Promise(r => setTimeout(r, 300));
        }
      }
      toast.success(`${files.length} Datei${files.length === 1 ? '' : 'en'} heruntergeladen`);
    } catch (e: any) { toast.error(e.message); }
    finally { setZipping(false); }
  };

  const copyPreviewLink = async () => {
    try {
      const { data } = await supabase.functions.invoke('mediapaket-portal', {
        body: { action: 'issue_token', mp_id: mpId },
      });
      if (data?.token) {
        const url = `${window.location.origin}/preview/mediapaket?token=${encodeURIComponent(data.token)}`;
        await navigator.clipboard.writeText(url);
        toast.success('Vorschau-Link kopiert');
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const nextActions = NEXT_STATUS[status] || [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-glow">
      <Tabs defaultValue="workflow">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflow"><GitBranch className="w-3 h-3 mr-1" />Workflow</TabsTrigger>
          <TabsTrigger value="timeline"><HistoryIcon className="w-3 h-3 mr-1" />Timeline</TabsTrigger>
          <TabsTrigger value="versions"><Package className="w-3 h-3 mr-1" />Versionen ({snapshots.length})</TabsTrigger>
          <TabsTrigger value="tools">Extras</TabsTrigger>
        </TabsList>

        {/* WORKFLOW / Phase 26 */}
        <TabsContent value="workflow" className="space-y-3 pt-3">
          <div className="text-xs text-muted-foreground">Aktueller Status: <Badge variant="outline">{status}</Badge></div>
          {nextActions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine automatischen Übergänge verfügbar. Nutze das Review-Panel für weitere Aktionen.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {nextActions.map(a => (
                <Button key={a.next} onClick={() => transition(a.next, a.label)} disabled={transitioning === a.next} size="sm" className="gap-2">
                  {transitioning === a.next ? <Loader2 className="w-3 h-3 animate-spin" /> : <a.icon className="w-3 h-3" />}
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-border/40 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadAll} disabled={zipping} className="gap-2">
              {zipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Alle Dateien herunterladen
            </Button>
          </div>
        </TabsContent>

        {/* TIMELINE / Phase 28 */}
        <TabsContent value="timeline" className="pt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Lade…</div>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine Ereignisse.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {timeline.map(e => {
                const meta = ACTION_LABEL[e.action] || { label: e.action, icon: HistoryIcon, color: 'text-muted-foreground' };
                const Icon = meta.icon;
                let detail = '';
                if (e.kind === 'download') detail = `${(e.data as any).media_package_files?.original_filename || '—'} (${(e.data as any).downloader_type})`;
                else if (e.kind === 'comment') detail = ((e.data as any).subject || (e.data as any).comment || '').slice(0, 80);
                else if (e.kind === 'history') {
                  const v = (e.data as any).new_value;
                  if (v?.status) detail = `→ ${v.status}`;
                  else if (v?.email) detail = String(v.email);
                  else if (v?.to) detail = Array.isArray(v.to) ? v.to.join(', ') : String(v.to);
                }
                return (
                  <div key={e.kind + e.id} className="flex items-start gap-2 text-xs border-b border-border/30 pb-1.5">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{meta.label}</span>
                        {detail && <span className="text-muted-foreground truncate">— {detail}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(e.at).toLocaleString('de-DE')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* VERSIONEN / Phase 25 */}
        <TabsContent value="versions" className="pt-3">
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine Snapshots. Ein Snapshot wird automatisch beim Einreichen erstellt.</p>
          ) : (
            <div className="space-y-1.5">
              {snapshots.map((s, i) => (
                <div key={s.id} className="flex items-center justify-between gap-2 border border-border/40 rounded-lg p-2">
                  <div className="text-xs">
                    <div className="font-medium text-foreground">Version {snapshots.length - i} · {new Date(s.created_at).toLocaleString('de-DE')}</div>
                    <div className="text-muted-foreground">Snapshot beim Einreichen</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSnapshotOpen(s)}><Eye className="w-3 h-3 mr-1" />Ansehen</Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* EXTRAS / Phase 27 & 30 */}
        <TabsContent value="tools" className="pt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={duplicate} disabled={duplicating} className="gap-2">
              {duplicating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CopyIcon className="w-3 h-3" />}
              Mediapaket duplizieren
            </Button>
            <Button variant="outline" size="sm" onClick={copyPreviewLink} className="gap-2">
              <Eye className="w-3 h-3" />Kunden-Vorschau-Link
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <strong>Duplizieren</strong>: kopiert alle Angaben (ohne Dateien) in ein neues Paket für einen anderen Auftrag.<br />
            <strong>Vorschau-Link</strong>: schreibgeschützte Ansicht für den Kunden zur Endabnahme.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={!!snapshotOpen} onOpenChange={o => !o && setSnapshotOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Snapshot vom {snapshotOpen && new Date(snapshotOpen.created_at).toLocaleString('de-DE')}</DialogTitle></DialogHeader>
          <pre className="text-[10px] bg-muted p-3 rounded overflow-auto max-h-[60vh]">{snapshotOpen && JSON.stringify(snapshotOpen.new_value, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
