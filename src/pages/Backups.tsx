import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Shield, Database, Download, Loader2, Trash2, RefreshCw, Mail, Clock, HardDrive, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface BackupRow {
  id: string;
  backup_type: string;
  backup_scope: string;
  backup_status: string;
  started_at: string | null;
  completed_at: string | null;
  backup_size_bytes: number | null;
  storage_location: string | null;
  storage_path: string | null;
  file_count: number | null;
  notify_email: string | null;
  message: string | null;
  created_at: string;
}

const fmtSize = (b: number | null) => {
  if (!b) return '–';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleString('de-DE') : '–';

export default function Backups() {
  const { profile } = useAuth();
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notify, setNotify] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.email && !notifyEmail) setNotifyEmail(profile.email);
  }, [profile?.email]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('backups_metadata')
      .select('*')
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) {
      toast.error('Backups konnten nicht geladen werden: ' + error.message);
    } else {
      setBackups((data ?? []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runBackup = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-full-backup', {
        body: { source: 'manual', notify, notify_email: notifyEmail || undefined, scope: 'full' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unbekannter Fehler');
      toast.success(`Backup erstellt (${fmtSize(data.size_bytes)})${data.email_sent ? ' • E-Mail versendet' : ''}`);
      await load();
    } catch (e: any) {
      toast.error('Backup fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setRunning(false);
    }
  };

  const downloadBackup = async (b: BackupRow) => {
    if (!b.storage_path) {
      toast.error('Kein Pfad hinterlegt – diese Sicherung enthält keine Datei zum Download.');
      return;
    }
    setDownloadingId(b.id);
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .createSignedUrl(b.storage_path, 60 * 60);
      if (error || !data?.signedUrl) throw new Error(error?.message || 'Signierter Link fehlgeschlagen');
      window.open(data.signedUrl, '_blank');
    } catch (e: any) {
      toast.error('Download fehlgeschlagen: ' + (e?.message ?? String(e)));
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteBackup = async (b: BackupRow) => {
    if (!confirm('Sicherung unwiderruflich löschen?')) return;
    try {
      if (b.storage_path) {
        await supabase.storage.from('backups').remove([b.storage_path]);
      }
      const { error } = await supabase.from('backups_metadata').delete().eq('id', b.id);
      if (error) throw error;
      toast.success('Sicherung gelöscht');
      await load();
    } catch (e: any) {
      toast.error('Löschen fehlgeschlagen: ' + (e?.message ?? String(e)));
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'success' || s === 'completed') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Erfolgreich</Badge>;
    if (s === 'failed') return <Badge className="bg-destructive/10 text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Fehlgeschlagen</Badge>;
    return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />{s}</Badge>;
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Datensicherung</h1>
          <p className="text-sm text-muted-foreground">
            Vollständige Sicherung aller Datenbanktabellen und Storage-Inventar – verschlüsselt im privaten Bucket gespeichert.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Automatik</CardDescription>
            <CardTitle className="text-base">Wöchentlich</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Sonntags 03:00 UTC – automatisches Vollbackup.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5" /> Speicherort</CardDescription>
            <CardTitle className="text-base">Privater Bucket</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Zugriff nur für Administratoren via signierte Links.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Benachrichtigung</CardDescription>
            <CardTitle className="text-base">E-Mail mit Link</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Optionaler Versand des Download-Links (7 Tage gültig).</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Manuelles Backup erstellen</CardTitle>
          <CardDescription>
            Dumpt alle Tabellen und das Storage-Inventar als JSON, lädt es in den privaten <code>backups</code>-Bucket
            und liefert einen signierten Download-Link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">E-Mail-Benachrichtigung mit Download-Link</Label>
              <p className="text-xs text-muted-foreground">Der Link ist 7 Tage gültig.</p>
            </div>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </div>
          {notify && (
            <div className="space-y-2">
              <Label htmlFor="notify-email">Empfänger-E-Mail</Label>
              <Input
                id="notify-email"
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="admin@beispiel.de"
              />
            </div>
          )}
          <Button onClick={runBackup} disabled={running} className="w-full sm:w-auto">
            {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sicherung läuft …</> : <><Database className="w-4 h-4 mr-2" /> Jetzt sichern</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sicherungsverlauf</CardTitle>
            <CardDescription>Letzte 50 Sicherungen</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Noch keine Sicherungen vorhanden.
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {statusBadge(b.backup_status)}
                      <Badge variant="outline" className="text-xs">{b.backup_type}</Badge>
                      <Badge variant="outline" className="text-xs">{b.backup_scope}</Badge>
                      {b.notify_email && <Badge variant="outline" className="text-xs"><Mail className="w-3 h-3 mr-1" />{b.notify_email}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {fmtDate(b.started_at)} • {fmtSize(b.backup_size_bytes)}
                      {b.file_count != null && ` • ${b.file_count} Storage-Dateien`}
                    </div>
                    {b.message && <div className="text-xs text-muted-foreground mt-1 truncate">{b.message}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.storage_path && b.backup_status === 'completed' && (
                      <Button size="sm" variant="outline" onClick={() => downloadBackup(b)} disabled={downloadingId === b.id}>
                        {downloadingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteBackup(b)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
