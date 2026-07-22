import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Server, FolderTree, Play, CheckCircle2, XCircle, RefreshCw, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type Server = {
  id: string; name: string; base_url: string; username: string;
  app_password_secret_name: string; verify_ssl: boolean; active: boolean; notes?: string;
};
type Folder = {
  id: string; server_id: string; path: string; doc_type_hint?: string;
  recursive: boolean; poll_interval_min: number; active: boolean; last_scanned_at?: string;
};
type Run = {
  id: string; server_id?: string; folder_id?: string;
  started_at: string; finished_at?: string;
  files_seen: number; files_new: number; files_updated: number;
  status: string; error?: string;
};

export default function AlixDocs2Nextcloud() {
  const [servers, setServers] = useState<Server[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [reconcileResult, setReconcileResult] = useState<any | null>(null);
  const [newServerOpen, setNewServerOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState<string | null>(null);

  const [srvForm, setSrvForm] = useState({
    name: '', base_url: '', username: '', app_password_secret_name: '', verify_ssl: true, notes: '',
  });
  const [fldForm, setFldForm] = useState({
    path: '', doc_type_hint: '', recursive: true, poll_interval_min: 5, active: true,
  });

  const load = async () => {
    setLoading(true);
    const [s, f, r] = await Promise.all([
      supabase.from('alixdocs2_nc_servers').select('*').order('name'),
      supabase.from('alixdocs2_nc_watched_folders').select('*').order('path'),
      supabase.from('alixdocs2_nc_sync_runs').select('*').order('started_at', { ascending: false }).limit(50),
    ]);
    setServers((s.data as Server[]) ?? []);
    setFolders((f.data as Folder[]) ?? []);
    setRuns((r.data as Run[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createServer = async () => {
    if (!srvForm.name || !srvForm.base_url || !srvForm.username || !srvForm.app_password_secret_name) {
      toast.error('Bitte alle Pflichtfelder ausfüllen'); return;
    }
    const { error } = await supabase.from('alixdocs2_nc_servers').insert(srvForm);
    if (error) return toast.error(error.message);
    toast.success('Server angelegt. Bitte Secret in Supabase hinterlegen.');
    setNewServerOpen(false);
    setSrvForm({ name: '', base_url: '', username: '', app_password_secret_name: '', verify_ssl: true, notes: '' });
    load();
  };

  const deleteServer = async (id: string) => {
    if (!confirm('Server wirklich löschen?')) return;
    const { error } = await supabase.from('alixdocs2_nc_servers').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const createFolder = async (server_id: string) => {
    if (!fldForm.path) { toast.error('Pfad erforderlich'); return; }
    const { error } = await supabase.from('alixdocs2_nc_watched_folders').insert({ ...fldForm, server_id });
    if (error) return toast.error(error.message);
    toast.success('Ordner überwacht');
    setNewFolderOpen(null);
    setFldForm({ path: '', doc_type_hint: '', recursive: true, poll_interval_min: 5, active: true });
    load();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm('Ordner-Überwachung entfernen?')) return;
    await supabase.from('alixdocs2_nc_watched_folders').delete().eq('id', id);
    load();
  };

  const testServer = async (server_id: string) => {
    setTesting(server_id);
    const { data, error } = await supabase.functions.invoke('alixdocs2-nc-test', { body: { server_id } });
    setTesting(null);
    if (error) return toast.error(error.message);
    if ((data as any)?.ok) toast.success(`Verbindung OK (HTTP ${(data as any).status})`);
    else toast.error(`Verbindung fehlgeschlagen: ${(data as any)?.hint ?? (data as any)?.error ?? 'Unbekannt'}`);
  };

  const scanFolder = async (folder_id: string) => {
    setScanning(folder_id);
    const { data, error } = await supabase.functions.invoke('alixdocs2-nc-scan', { body: { folder_id } });
    setScanning(null);
    if (error) return toast.error(error.message);
    const r = (data as any)?.results?.[0];
    if (r?.error) toast.error(`Scan-Fehler: ${r.error}`);
    else toast.success(`Scan OK: ${r?.files_seen ?? 0} Dateien, ${r?.files_new ?? 0} neu, ${r?.files_updated ?? 0} aktualisiert`);
    load();
  };

  const reconcileOrders = async (folder_id: string) => {
    setReconciling(folder_id);
    setReconcileResult(null);
    const { data, error } = await supabase.functions.invoke('alixdocs2-nc-order-reconcile', {
      body: { folder_id, import: true },
    });
    setReconciling(null);
    if (error) return toast.error(error.message);
    const d = data as any;
    setReconcileResult(d);
    if (d?.ok === false) {
      toast.error(`${d.error ?? 'Fehler'} — ${d.hint ?? ''}`);
      return;
    }
    toast.success(`Abgleich fertig · ${d.existing_count} vorhanden · ${d.imported_count} importiert · ${d.not_found_count} nicht gefunden`);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display gold-text flex items-center gap-2">
            <Server className="w-6 h-6" /> ALIXDocs AI 2.0 — Nextcloud
          </h1>
          <p className="text-sm text-muted-foreground">
            Nextcloud-Server anbinden und Ordner überwachen. Neue Dateien werden automatisch importiert und analysiert.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Neu laden</Button>
          <Dialog open={newServerOpen} onOpenChange={setNewServerOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Server</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuen Nextcloud-Server anbinden</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name*</Label><Input value={srvForm.name} onChange={e => setSrvForm({ ...srvForm, name: e.target.value })} placeholder="z. B. Firmencloud" /></div>
                <div><Label>Base URL*</Label><Input value={srvForm.base_url} onChange={e => setSrvForm({ ...srvForm, base_url: e.target.value })} placeholder="https://cloud.alix-lasers.com" /></div>
                <div><Label>Benutzer*</Label><Input value={srvForm.username} onChange={e => setSrvForm({ ...srvForm, username: e.target.value })} placeholder="alixwork" /></div>
                <div>
                  <Label>Supabase-Secret-Name für App-Password*</Label>
                  <Input value={srvForm.app_password_secret_name} onChange={e => setSrvForm({ ...srvForm, app_password_secret_name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} placeholder="NEXTCLOUD_FIRMEN_PASSWORD" />
                  <p className="text-xs text-muted-foreground mt-1">Nach dem Anlegen bitte im Supabase-Dashboard unter „Edge Function Secrets" ein Secret mit diesem Namen und dem App-Password der Nextcloud hinterlegen.</p>
                </div>
                <div className="flex items-center gap-2"><Switch checked={srvForm.verify_ssl} onCheckedChange={v => setSrvForm({ ...srvForm, verify_ssl: v })} /><Label>SSL prüfen</Label></div>
                <div><Label>Notizen</Label><Input value={srvForm.notes} onChange={e => setSrvForm({ ...srvForm, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={createServer}>Anlegen</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : servers.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Noch kein Nextcloud-Server angelegt.</CardContent></Card>
      ) : servers.map(srv => {
        const srvFolders = folders.filter(f => f.server_id === srv.id);
        const srvRuns = runs.filter(r => r.server_id === srv.id).slice(0, 5);
        return (
          <Card key={srv.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-4 h-4" /> {srv.name}
                  {srv.active ? <Badge variant="outline" className="text-green-500 border-green-500/50">aktiv</Badge> : <Badge variant="outline">inaktiv</Badge>}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{srv.base_url} · {srv.username} · Secret: <code className="text-xs">{srv.app_password_secret_name}</code></p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testServer(srv.id)} disabled={testing === srv.id}>
                  {testing === srv.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Test
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteServer(srv.id)}>Löschen</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2"><FolderTree className="w-4 h-4" /> Überwachte Ordner ({srvFolders.length})</h3>
                <Dialog open={newFolderOpen === srv.id} onOpenChange={o => setNewFolderOpen(o ? srv.id : null)}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" /> Ordner</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Ordner überwachen</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Pfad* (relativ zum Nextcloud-Root)</Label><Input value={fldForm.path} onChange={e => setFldForm({ ...fldForm, path: e.target.value })} placeholder="Rechnungen/2026" /></div>
                      <div><Label>Doku-Typ-Hinweis (optional)</Label><Input value={fldForm.doc_type_hint} onChange={e => setFldForm({ ...fldForm, doc_type_hint: e.target.value })} placeholder="rechnung" /></div>
                      <div><Label>Poll-Intervall (Minuten)</Label><Input type="number" value={fldForm.poll_interval_min} onChange={e => setFldForm({ ...fldForm, poll_interval_min: Number(e.target.value) })} /></div>
                      <div className="flex items-center gap-2"><Switch checked={fldForm.recursive} onCheckedChange={v => setFldForm({ ...fldForm, recursive: v })} /><Label>Rekursiv</Label></div>
                    </div>
                    <DialogFooter><Button onClick={() => createFolder(srv.id)}>Hinzufügen</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {srvFolders.length === 0 ? <p className="text-xs italic text-muted-foreground">Noch keine Ordner überwacht.</p> :
                <div className="space-y-1">
                  {srvFolders.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                      <FolderTree className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">/{f.path}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.doc_type_hint && <Badge variant="secondary" className="mr-1">{f.doc_type_hint}</Badge>}
                          alle {f.poll_interval_min} min · {f.recursive ? 'rekursiv' : 'flach'}
                          {f.last_scanned_at && <> · letzter Scan {new Date(f.last_scanned_at).toLocaleString('de-DE')}</>}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" title="Dateien scannen" onClick={() => scanFolder(f.id)} disabled={scanning === f.id}>
                        {scanning === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      </Button>
                      <Button size="sm" variant="outline" title="Aufträge abgleichen & fehlende importieren" onClick={() => reconcileOrders(f.id)} disabled={reconciling === f.id}>
                        {reconciling === f.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ClipboardCheck className="w-3 h-3 mr-1" />}
                        Aufträge abgleichen
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteFolder(f.id)}><XCircle className="w-3 h-3" /></Button>
                    </div>
                  ))}
                </div>}

              {srvRuns.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Letzte Sync-Runs</h4>
                  <div className="space-y-1">
                    {srvRuns.map(r => (
                      <div key={r.id} className="text-xs flex items-center gap-2 p-1 rounded bg-muted/30">
                        {r.status === 'ok' ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : r.status === 'error' ? <XCircle className="w-3 h-3 text-destructive" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>{new Date(r.started_at).toLocaleString('de-DE')}</span>
                        <span className="text-muted-foreground">· {r.files_seen} gesehen · {r.files_new} neu · {r.files_updated} aktualisiert</span>
                        {r.error && <span className="text-destructive truncate">— {r.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground text-center pt-4">
        <Link to="/alixdocs2" className="underline">Zurück zum ALIXDocs AI 2.0 Dashboard</Link>
      </p>

      <Dialog open={!!reconcileResult} onOpenChange={(o) => !o && setReconcileResult(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" /> Auftrags-Abgleich · Ergebnis
            </DialogTitle>
          </DialogHeader>
          {reconcileResult?.ok === false && (
            <div className="space-y-2 text-sm">
              <div className="rounded border border-destructive/40 bg-destructive/10 p-3">
                <div className="font-medium text-destructive">{reconcileResult.error}</div>
                {reconcileResult.hint && <div className="text-xs mt-1">{reconcileResult.hint}</div>}
                {reconcileResult.dav_url && (
                  <div className="text-[10px] mt-2 break-all opacity-70">URL: {reconcileResult.dav_url}</div>
                )}
              </div>
            </div>
          )}
          {reconcileResult && reconcileResult.ok !== false && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Badge variant="outline">Dateien: {reconcileResult.files_scanned}</Badge>
                <Badge variant="outline">Nummern: {reconcileResult.numbers_found}</Badge>
                <Badge className="bg-green-500/20 text-green-500 border-green-500/40">Vorhanden: {reconcileResult.existing_count}</Badge>
                <Badge className="bg-primary/20 text-primary border-primary/40">Importiert: {reconcileResult.imported_count}</Badge>
                <Badge variant="destructive">Nicht gefunden: {reconcileResult.not_found_count}</Badge>
              </div>

              <ScrollArea className="h-[420px] pr-3">
                {reconcileResult.imported?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-primary mb-1">Neu importiert ({reconcileResult.imported.length})</h4>
                    {reconcileResult.imported.map((it: any) => (
                      <div key={it.number} className="text-xs border-l-2 border-primary pl-2 py-1">
                        <div className="font-mono">{it.number}</div>
                        <div className="text-muted-foreground truncate">{it.source} · {it.files.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {reconcileResult.existing?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-green-500 mb-1">Vorhanden — übersprungen ({reconcileResult.existing.length})</h4>
                    {reconcileResult.existing.slice(0, 200).map((it: any) => (
                      <div key={it.number} className="text-xs border-l-2 border-green-500/50 pl-2 py-1">
                        <div className="font-mono">{it.number}</div>
                        <div className="text-muted-foreground truncate">{it.files.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {reconcileResult.not_found?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-destructive mb-1">Nicht in Zoho gefunden ({reconcileResult.not_found.length})</h4>
                    {reconcileResult.not_found.slice(0, 200).map((it: any) => (
                      <div key={it.number} className="text-xs border-l-2 border-destructive pl-2 py-1">
                        <div className="font-mono">{it.number}</div>
                        <div className="text-muted-foreground truncate">{it.files.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {reconcileResult.failed?.length > 0 && (
                  <div className="mb-3">
                    <h4 className="font-medium text-destructive mb-1">Import-Fehler ({reconcileResult.failed.length})</h4>
                    {reconcileResult.failed.map((it: any) => (
                      <div key={it.number} className="text-xs border-l-2 border-destructive pl-2 py-1">
                        <div className="font-mono">{it.number}</div>
                        <div className="text-destructive">{it.message}</div>
                      </div>
                    ))}
                  </div>
                )}
                {reconcileResult.files_without_number > 0 && (
                  <p className="text-xs italic text-muted-foreground">
                    {reconcileResult.files_without_number} Datei(en) enthielten kein erkennbares Auftrags-Muster (z. B. 2026-04226).
                  </p>
                )}
              </ScrollArea>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconcileResult(null)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
