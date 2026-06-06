import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Download, Calendar, RefreshCw, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMailPermissions } from '@/hooks/useMailPermissions';

const TABLES = [
  'mail_messages', 'mail_templates', 'mail_campaigns', 'mail_automations',
  'mail_phone_notes', 'mail_tasks', 'mail_followups', 'mail_audit_logs',
  'mail_unsubscribes', 'mail_events', 'mail_domains', 'mail_internal_messages',
];

const CFG_KEY = 'mailcenter_backup_config';
interface Cfg { schedule: 'manual' | 'taeglich' | 'woechentlich' | 'monatlich'; retention: '30' | '90' | '180' | 'unbegrenzt'; lastBackup?: string }

export default function BackupCenter() {
  const { isAdmin } = useMailPermissions();
  const [cfg, setCfg] = useState<Cfg>({ schedule: 'manual', retention: '90' });
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<{ name: string; size: number; createdAt: string }[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem(CFG_KEY); if (s) setCfg(JSON.parse(s)); } catch {}
    listBackups();
  }, []);

  async function listBackups() {
    const { data } = await supabase.storage.from('backups').list('mailcenter', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    setHistory((data || []).map((f: any) => ({ name: f.name, size: f.metadata?.size || 0, createdAt: f.created_at })));
  }

  function saveCfg(next: Cfg) {
    setCfg(next);
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
    toast.success('Backup-Plan gespeichert');
  }

  async function runBackup() {
    if (!isAdmin) { toast.error('Nur Super Admin'); return; }
    setRunning(true);
    try {
      const dump: Record<string, any[]> = {};
      for (const t of TABLES) {
        const { data, error } = await supabase.from(t as any).select('*').limit(10000);
        if (!error) dump[t] = data || [];
      }
      const json = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: dump }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const filename = `mailcenter-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const { error: upErr } = await supabase.storage.from('backups').upload(`mailcenter/${filename}`, blob, { contentType: 'application/json', upsert: false });
      if (upErr) {
        // fallback: trigger download locally
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
        toast.warning('Backup lokal heruntergeladen (Upload fehlgeschlagen): ' + upErr.message);
      } else {
        toast.success('Backup gespeichert');
        await listBackups();
      }
      saveCfg({ ...cfg, lastBackup: new Date().toISOString() });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setRunning(false); }
  }

  async function downloadBackup(name: string) {
    const { data, error } = await supabase.storage.from('backups').download(`mailcenter/${name}`);
    if (error || !data) { toast.error(error?.message || 'Download fehlgeschlagen'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Backup Center</h2></div>

      <Card>
        <CardHeader><CardTitle className="text-base">Backup ausführen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Sichert die MailCenter-Tabellen ({TABLES.length}) in den Storage-Bucket <code>backups/mailcenter/</code>.</p>
          <Button onClick={runBackup} disabled={running || !isAdmin}><Save className="w-4 h-4 mr-2" />{running ? 'Sichere…' : 'Jetzt sichern'}</Button>
          {!isAdmin && <p className="text-xs text-amber-500">Nur Super Admin</p>}
          {cfg.lastBackup && <p className="text-xs text-muted-foreground">Letztes Backup: {new Date(cfg.lastBackup).toLocaleString('de-DE')}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Zeitplan & Aufbewahrung</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 max-w-xl">
          <div>
            <label className="text-sm font-medium">Plan</label>
            <Select value={cfg.schedule} onValueChange={(v: any) => saveCfg({ ...cfg, schedule: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manuell</SelectItem>
                <SelectItem value="taeglich">Täglich</SelectItem>
                <SelectItem value="woechentlich">Wöchentlich</SelectItem>
                <SelectItem value="monatlich">Monatlich</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Aufbewahrung</label>
            <Select value={cfg.retention} onValueChange={(v: any) => saveCfg({ ...cfg, retention: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 Tage</SelectItem>
                <SelectItem value="90">90 Tage</SelectItem>
                <SelectItem value="180">180 Tage</SelectItem>
                <SelectItem value="unbegrenzt">Unbegrenzt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Automatische Ausführung erfordert einen Cron-Job (pg_cron + Edge Function) — kann separat aktiviert werden.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Backup-Historie</CardTitle>
          <Button size="sm" variant="ghost" onClick={listBackups}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40"><tr className="text-left">
              <th className="p-3">Datei</th><th className="p-3">Größe</th><th className="p-3">Erstellt</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.name} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{h.name}</td>
                  <td className="p-3">{(h.size / 1024).toFixed(1)} KB</td>
                  <td className="p-3 text-muted-foreground">{new Date(h.createdAt).toLocaleString('de-DE')}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => downloadBackup(h.name)}><Download className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Noch keine Backups</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm">Wiederherstellung muss aus Sicherheitsgründen vom Super Admin per Edge Function (<code>mailcenter-restore</code>) ausgelöst werden. Bei Bedarf separat einrichten.</p>
        </CardContent>
      </Card>
    </div>
  );
}
