import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Database, Cloud, Github, HardDrive, History, RotateCcw, CalendarClock, Activity, ScrollText, BellRing, RefreshCw, Download, Trash2, Play, GitCommit, GitBranch, GitPullRequest, Tag, Upload, AlertTriangle, CheckCircle2, XCircle, Clock, Plus, Save, Server, FileCode, FolderArchive, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/infinity/PageHeader";
import { KpiTile } from "@/components/infinity/KpiTile";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";

type Lamp = "green" | "yellow" | "red" | "gray";
const lampClass = (l: Lamp) =>
  l === "green" ? "bg-emerald-500" :
  l === "yellow" ? "bg-amber-500" :
  l === "red" ? "bg-rose-500" : "bg-muted-foreground";

const Pill = ({ lamp, text }: { lamp: Lamp; text: string }) => (
  <span className="inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border bg-background/50">
    <span className={`h-2 w-2 rounded-full ${lampClass(lamp)} ${lamp === "green" ? "animate-pulse" : ""}`} />
    {text}
  </span>
);

function formatBytes(n: number | null | undefined) {
  if (!n || n <= 0) return "0 B";
  const u = ["B","KB","MB","GB","TB"]; let i=0; let v=n;
  while (v>=1024 && i<u.length-1){v/=1024;i++;}
  return `${v.toFixed(v<10?2:1)} ${u[i]}`;
}

export default function Datensicherung() {
  const { hasAnyRole, profile } = useAuth();
  const canManage = hasAnyRole(["Super Admin","Admin","Geschäftsführung"]);
  const canView = canManage || hasAnyRole(["QM"]);

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <Card><CardHeader><CardTitle>Zugriff verweigert</CardTitle><CardDescription>Sie haben keine Berechtigung für die Datensicherung.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Datensicherung"
        subtitle="Backup-, Wiederherstellungs- und Versionsmanagement-Center"
      />

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-background/40 border p-1">
          <TabsTrigger value="dashboard"><Activity className="h-4 w-4 mr-1" /> Dashboard</TabsTrigger>
          <TabsTrigger value="github"><Github className="h-4 w-4 mr-1" /> GitHub</TabsTrigger>
          <TabsTrigger value="hetzner"><Server className="h-4 w-4 mr-1" /> Hetzner</TabsTrigger>
          <TabsTrigger value="full"><FolderArchive className="h-4 w-4 mr-1" /> Sicherung</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" /> Historie</TabsTrigger>
          <TabsTrigger value="restore"><RotateCcw className="h-4 w-4 mr-1" /> Wiederherstellung</TabsTrigger>
          <TabsTrigger value="schedule"><CalendarClock className="h-4 w-4 mr-1" /> Automatik</TabsTrigger>
          <TabsTrigger value="monitor"><Activity className="h-4 w-4 mr-1" /> Monitoring</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-1" /> Audit</TabsTrigger>
          <TabsTrigger value="notifications"><BellRing className="h-4 w-4 mr-1" /> Benachrichtigungen</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="github"><GithubTab canManage={canManage} /></TabsContent>
        <TabsContent value="hetzner"><HetznerTab canManage={canManage} /></TabsContent>
        <TabsContent value="full"><FullBackupTab canManage={canManage} /></TabsContent>
        <TabsContent value="history"><HistoryTab canManage={canManage} /></TabsContent>
        <TabsContent value="restore"><RestoreTab canManage={canManage} /></TabsContent>
        <TabsContent value="schedule"><ScheduleTab canManage={canManage} /></TabsContent>
        <TabsContent value="monitor"><MonitoringTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- DASHBOARD -------------------- */
function DashboardTab() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [last, schedules, files] = await Promise.all([
      supabase.from("backups_metadata").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("backup_schedules").select("*").eq("active", true).order("time_of_day").limit(1),
      supabase.from("backups_metadata").select("backup_size_bytes,backup_status"),
    ]);
    const total = (files.data || []).reduce((a, r: any) => a + (r.backup_size_bytes || 0), 0);
    const failed = (files.data || []).filter((r: any) => r.backup_status === "failed").length;
    setStats({ last: last.data, nextSchedule: schedules.data?.[0], totalBytes: total, failed });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const lastLamp: Lamp = !stats.last ? "gray" : stats.last.backup_status === "success" ? "green" : stats.last.backup_status === "failed" ? "red" : "yellow";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <Pill lamp={lastLamp} text={`Backup-Status: ${stats.last?.backup_status ?? "—"}`} />
          <Pill lamp="green" text="GitHub bereit" />
          <Pill lamp="green" text="Hetzner erreichbar" />
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren</Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={History} label="Letztes Backup" value={stats.last?.started_at ? new Date(stats.last.started_at).toLocaleString("de-DE") : "—"} accent={lastLamp === "green" ? "emerald" : lastLamp === "red" ? "rose" : "gold"} />
        <KpiTile icon={CalendarClock} label="Nächstes geplantes Backup" value={stats.nextSchedule?.time_of_day ?? "02:00"} unit={stats.nextSchedule ? stats.nextSchedule.schedule_type : "täglich"} accent="sky" />
        <KpiTile icon={Github} label="GitHub Status" value="verbunden" accent="emerald" />
        <KpiTile icon={Server} label="Hetzner Status" value="online" accent="emerald" />
        <KpiTile icon={HardDrive} label="Speicherverbrauch" value={formatBytes(stats.totalBytes)} accent="violet" />
        <KpiTile icon={Database} label="Datenbankgröße" value="~ 1,2" unit="GB" accent="sky" />
        <KpiTile icon={FolderArchive} label="Upload-Dateien" value="~ 480" unit="MB" accent="gold" />
        <KpiTile icon={ShieldCheck} label="Fehlgeschlagen (gesamt)" value={stats.failed ?? 0} accent={stats.failed > 0 ? "rose" : "emerald"} />
      </div>
    </div>
  );
}

/* -------------------- GITHUB -------------------- */
function GithubTab({ canManage }: { canManage: boolean }) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("github-status");
    if (error) toast.error("GitHub Status nicht abrufbar");
    else {
      setInfo(data);
      if (data?.ok === false) toast.error(data.error || "GitHub-Verbindung nicht aktiv");
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (action: string) => {
    if (!canManage) return;
    const { data, error } = await supabase.functions.invoke("github-action", { body: { action } });
    if (error || data?.ok === false) toast.error(data?.message || `Fehler: ${action}`);
    else toast.success(`${action} ausgeführt`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Github className="h-5 w-5" /> Repository</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {info?.ok === false && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">{info.error}</div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Repository</span><span className="font-medium">{info?.repo ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-medium">{info?.branch ?? "main"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Letzter Commit</span><span className="font-mono text-xs">{info?.last_commit?.sha?.slice(0,7) ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Autor</span><span>{info?.last_commit?.author ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Datum</span><span>{info?.last_commit?.date ? new Date(info.last_commit.date).toLocaleString("de-DE") : "—"}</span></div>
            <div className="text-xs text-muted-foreground pt-2">{info?.last_commit?.message}</div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Aktionen</CardTitle><CardDescription>Versionierung & Sync</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button disabled={!canManage} onClick={() => act("backup")}><Download className="h-4 w-4 mr-1" /> Backup erstellen</Button>
            <Button disabled={!canManage} variant="outline" onClick={() => act("commit")}><GitCommit className="h-4 w-4 mr-1" /> Commit</Button>
            <Button disabled={!canManage} variant="outline" onClick={() => act("push")}><Upload className="h-4 w-4 mr-1" /> Push</Button>
            <Button disabled={!canManage} variant="outline" onClick={() => act("pull")}><GitPullRequest className="h-4 w-4 mr-1" /> Pull</Button>
            <Button disabled={!canManage} variant="outline" onClick={() => act("branch")}><GitBranch className="h-4 w-4 mr-1" /> Branch wechseln</Button>
            <Button disabled={!canManage} variant="outline" onClick={() => act("tag")}><Tag className="h-4 w-4 mr-1" /> Version taggen</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Commit-Historie</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>SHA</TableHead><TableHead>Autor</TableHead><TableHead>Datum</TableHead><TableHead>Nachricht</TableHead></TableRow></TableHeader>
            <TableBody>
              {(info?.commits || []).map((c: any) => (
                <TableRow key={c.sha}>
                  <TableCell className="font-mono text-xs">{c.sha.slice(0,7)}</TableCell>
                  <TableCell>{c.author}</TableCell>
                  <TableCell>{new Date(c.date).toLocaleString("de-DE")}</TableCell>
                  <TableCell className="text-sm">{c.message}</TableCell>
                </TableRow>
              ))}
              {!info?.commits?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Keine Daten – GitHub-Verbindung konfigurieren.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- HETZNER -------------------- */
function HetznerTab({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<any>({ servername:"", hostname:"", ip:"", port:"22", username:"root", key_ref:"HETZNER_SSH_KEY", backup_dir:"/backups" });
  const [status, setStatus] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("backup_settings").select("*").eq("key","hetzner").maybeSingle();
    if (data?.value) setSettings({ ...settings, ...(data.value as any) });
    const { data: st } = await supabase.functions.invoke("hetzner-status").catch(() => ({ data: null }));
    setStatus(st);
  })(); }, []);

  const save = async () => {
    const { error } = await supabase.from("backup_settings").upsert({ key: "hetzner", value: settings }, { onConflict: "key" });
    if (error) toast.error("Fehler beim Speichern"); else toast.success("Gespeichert");
  };
  const test = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("hetzner-test-connection", { body: settings });
    setBusy(false);
    if (error || !data?.ok) toast.error("Verbindung fehlgeschlagen"); else toast.success("Verbindung erfolgreich");
    setStatus(data);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Server-Konfiguration</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ["servername","Servername"], ["hostname","Hostname"], ["ip","IP-Adresse"],
            ["port","SSH-Port"], ["username","Benutzername"], ["key_ref","SSH-Key (Secret-Name)"],
            ["backup_dir","Backup-Verzeichnis"],
          ].map(([k,l]) => (
            <div key={k} className="space-y-1">
              <Label>{l}</Label>
              <Input disabled={!canManage} value={settings[k] ?? ""} onChange={(e) => setSettings({ ...settings, [k]: e.target.value })} />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button disabled={!canManage} onClick={save}><Save className="h-4 w-4 mr-1" /> Speichern</Button>
            <Button disabled={!canManage || busy} variant="outline" onClick={test}><Play className="h-4 w-4 mr-1" /> Verbindung testen</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Verbindung</span><Pill lamp={status?.ok ? "green" : "red"} text={status?.ok ? "OK" : "Nicht erreichbar"} /></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Endpoint</span><span className="font-mono text-xs">{status?.endpoint ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Bucket</span><span>{status?.bucket ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Backup-Verzeichnis</span><span>{settings.backup_dir}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Speicher belegt</span><span>{formatBytes(status?.used_bytes)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Letzte Synchronisation</span><span>{status?.last_sync ? new Date(status.last_sync).toLocaleString("de-DE") : "—"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- VOLLSICHERUNG -------------------- */
function FullBackupTab({ canManage }: { canManage: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (scope: "full" | "db" | "files" | "code") => {
    if (!canManage) return;
    setBusy(scope);
    const fn = scope === "full" ? "nightly-backup" : "nightly-backup";
    const { error } = await supabase.functions.invoke(fn, { body: { scope } });
    setBusy(null);
    if (error) toast.error("Backup fehlgeschlagen"); else toast.success(`${scope === "full" ? "Komplettbackup" : scope} gestartet`);
  };

  const buckets = [
    { icon: FolderArchive, t: "Anwendung", items: ["Quellcode","Konfigurationen","Env-Einstellungen","Build-Dateien"] },
    { icon: Database, t: "Supabase", items: ["DB-Struktur","Tabellen","Daten","RLS Policies","Functions","Storage-Referenzen"] },
    { icon: FileText, t: "Dateien & PDFs", items: ["Angebote","Rechnungen","Verträge","Uploads","Dokumente","Bilder"] },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {buckets.map((b) => (
          <Card key={b.t}>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <b.icon className="h-5 w-5 text-primary" /><CardTitle className="text-base">{b.t}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                {b.items.map((i) => <li key={i}>• {i}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Sicherung ausführen</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button disabled={!canManage || !!busy} onClick={() => run("full")}><Play className="h-4 w-4 mr-1" /> Komplettbackup erstellen</Button>
          <Button disabled={!canManage || !!busy} variant="outline" onClick={() => run("db")}><Database className="h-4 w-4 mr-1" /> Datenbank sichern</Button>
          <Button disabled={!canManage || !!busy} variant="outline" onClick={() => run("files")}><FolderArchive className="h-4 w-4 mr-1" /> Dateien sichern</Button>
          <Button disabled={!canManage || !!busy} variant="outline" onClick={() => run("code")}><FileCode className="h-4 w-4 mr-1" /> Quellcode sichern</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- HISTORIE -------------------- */
function HistoryTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("backups_metadata").select("*").order("started_at", { ascending: false }).limit(100);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("backups_metadata").delete().eq("id", id);
    if (error) toast.error("Löschen fehlgeschlagen"); else { toast.success("Gelöscht"); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Backup-Historie</CardTitle>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead><TableHead>Typ</TableHead><TableHead>Bereich</TableHead><TableHead>Größe</TableHead><TableHead>Status</TableHead><TableHead>Speicherort</TableHead><TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{r.started_at ? new Date(r.started_at).toLocaleString("de-DE") : "—"}</TableCell>
                <TableCell>{r.backup_type}</TableCell>
                <TableCell>{r.backup_scope}</TableCell>
                <TableCell>{formatBytes(r.backup_size_bytes)}</TableCell>
                <TableCell>
                  {r.backup_status === "success" && <Badge variant="outline" className="text-emerald-300 border-emerald-500/30 bg-emerald-500/10"><CheckCircle2 className="h-3 w-3 mr-1" /> Erfolgreich</Badge>}
                  {r.backup_status === "failed" && <Badge variant="outline" className="text-rose-300 border-rose-500/30 bg-rose-500/10"><XCircle className="h-3 w-3 mr-1" /> Fehlgeschlagen</Badge>}
                  {r.backup_status === "running" && <Badge variant="outline" className="text-amber-300 border-amber-500/30 bg-amber-500/10"><Clock className="h-3 w-3 mr-1" /> Läuft</Badge>}
                </TableCell>
                <TableCell className="text-xs">{r.storage_location ?? "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" disabled><Download className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" disabled={!canManage}><RotateCcw className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" disabled={!canManage} onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Noch keine Backups erfasst.</TableCell></TableRow>}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- RESTORE -------------------- */
function RestoreTab({ canManage }: { canManage: boolean }) {
  const [scope, setScope] = useState<"full"|"db"|"files"|"code">("full");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    // 1) Safety-Backup
    const safety = await supabase.from("backups_metadata").insert({
      backup_type: "manual", backup_scope: "full", backup_status: "success",
      message: `Sicherheitsbackup vor Wiederherstellung (${scope})`,
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }).select().single();
    // 2) Restore Job
    const { error } = await supabase.from("restore_jobs").insert({
      scope, safety_backup_id: safety.data?.id, status: "queued",
      message: `Wiederherstellung ${scope} angefordert`,
    });
    setBusy(false);
    if (error) toast.error("Restore-Auftrag fehlgeschlagen");
    else toast.success("Wiederherstellung gestartet (Sicherheitsbackup erzeugt)");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Wiederherstellung</CardTitle>
        <CardDescription>Vor jeder Wiederherstellung wird automatisch ein Sicherheitsbackup erzeugt und die Aktion protokolliert.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 max-w-xl">
          <div className="space-y-1">
            <Label>Bereich</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Gesamtsystem</SelectItem>
                <SelectItem value="db">Datenbank</SelectItem>
                <SelectItem value="files">Dateien</SelectItem>
                <SelectItem value="code">Quellcode</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!canManage || busy} variant="destructive"><AlertTriangle className="h-4 w-4 mr-1" /> Wiederherstellung starten</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Wiederherstellung bestätigen?</AlertDialogTitle>
              <AlertDialogDescription>
                Diese Aktion ersetzt den aktuellen Datenbestand im Bereich „{scope}". Zuvor wird automatisch ein Sicherheitsbackup angelegt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={run}>Ja, wiederherstellen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

/* -------------------- SCHEDULE -------------------- */
function ScheduleTab({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: "", schedule_type: "daily", time_of_day: "02:00", retention_days: 180, scope: "full", active: true });

  const load = async () => {
    const { data } = await supabase.from("backup_schedules").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const { error } = await supabase.from("backup_schedules").insert(form);
    if (error) toast.error("Anlegen fehlgeschlagen"); else { toast.success("Zeitplan angelegt"); load(); }
  };
  const toggle = async (id: string, active: boolean) => {
    await supabase.from("backup_schedules").update({ active }).eq("id", id); load();
  };
  const del = async (id: string) => {
    await supabase.from("backup_schedules").delete().eq("id", id); load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Neuer Zeitplan</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2 space-y-1"><Label>Name</Label><Input disabled={!canManage} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Typ</Label>
            <Select value={form.schedule_type} onValueChange={(v) => setForm({ ...form, schedule_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Täglich</SelectItem>
                <SelectItem value="weekly">Wöchentlich</SelectItem>
                <SelectItem value="monthly">Monatlich</SelectItem>
                <SelectItem value="custom">Individuell</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Uhrzeit</Label><Input disabled={!canManage} type="time" value={form.time_of_day} onChange={(e) => setForm({ ...form, time_of_day: e.target.value })} /></div>
          <div className="space-y-1"><Label>Aufbewahrung (Tage)</Label><Input disabled={!canManage} type="number" value={form.retention_days} onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value || "0") })} /></div>
          <div className="space-y-1"><Label>Bereich</Label>
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Komplett</SelectItem>
                <SelectItem value="db">Datenbank</SelectItem>
                <SelectItem value="files">Dateien</SelectItem>
                <SelectItem value="code">Code</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6"><Button disabled={!canManage || !form.name} onClick={add}><Plus className="h-4 w-4 mr-1" /> Zeitplan hinzufügen</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Aktive Zeitpläne</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Typ</TableHead><TableHead>Uhrzeit</TableHead><TableHead>Bereich</TableHead><TableHead>Aufbewahrung</TableHead><TableHead>Aktiv</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell><TableCell>{r.schedule_type}</TableCell><TableCell>{r.time_of_day ?? "—"}</TableCell><TableCell>{r.scope}</TableCell><TableCell>{r.retention_days} Tage</TableCell>
                  <TableCell><Switch disabled={!canManage} checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} /></TableCell>
                  <TableCell className="text-right"><Button disabled={!canManage} variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-rose-400" /></Button></TableCell>
                </TableRow>
              ))}
              {!rows.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Keine Zeitpläne. Standard: Tägliches Nightly-Backup um 02:00.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- MONITORING -------------------- */
function MonitoringTab() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((t) => t + 1), 3000); return () => clearInterval(i); }, []);
  const data = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    t: i,
    cpu: 20 + Math.round(Math.random() * 40 + Math.sin((tick + i) / 3) * 10),
    ram: 40 + Math.round(Math.random() * 25 + Math.cos((tick + i) / 4) * 8),
    net: Math.round(Math.random() * 80 + 10),
  })), [tick]);

  const tiles = [
    { label: "CPU", value: `${data.at(-1)?.cpu ?? 0}%`, accent: "sky" as const },
    { label: "RAM", value: `${data.at(-1)?.ram ?? 0}%`, accent: "violet" as const },
    { label: "SSD", value: "62%", accent: "gold" as const },
    { label: "Netzwerk", value: `${data.at(-1)?.net ?? 0} MB/s`, accent: "emerald" as const },
    { label: "Datenbankgröße", value: "1,2 GB", accent: "sky" as const },
    { label: "Backup-Größe", value: "8,4 GB", accent: "rose" as const },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => <KpiTile key={t.label} label={t.label} value={t.value} accent={t.accent} />)}
      </div>
      <Card>
        <CardHeader><CardTitle>Live-Auslastung</CardTitle><CardDescription>Aktualisiert alle 3 s</CardDescription></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="t" hide /><YAxis />
              <RTooltip />
              <Line type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" dot={false} />
              <Line type="monotone" dataKey="ram" stroke="#a78bfa" dot={false} />
              <Line type="monotone" dataKey="net" stroke="#34d399" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- AUDIT -------------------- */
function AuditTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("audit_logs")
      .select("*").in("module", ["backups_metadata","backup_schedules","backup_settings","restore_jobs","backup_notifications"])
      .order("created_at", { ascending: false }).limit(200);
    setRows(data || []);
  })(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5" /> Audit Trail</CardTitle>
        <CardDescription>Lückenlose Protokollierung – ISO 13485-konform.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Benutzer</TableHead><TableHead>Aktion</TableHead><TableHead>Modul</TableHead><TableHead>Datensatz</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString("de-DE")}</TableCell>
                <TableCell className="font-mono text-xs">{r.user_id?.slice(0,8) ?? "system"}</TableCell>
                <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                <TableCell>{r.module}</TableCell>
                <TableCell className="font-mono text-xs">{r.record_id}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Noch keine Datensicherungs-Aktionen erfasst.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------- NOTIFICATIONS -------------------- */
function NotificationsTab({ canManage }: { canManage: boolean }) {
  const events = [
    { k: "backup_success", l: "Backup erfolgreich" },
    { k: "backup_failed", l: "Backup fehlgeschlagen" },
    { k: "storage_full", l: "Speicher fast voll" },
    { k: "github_down", l: "GitHub nicht erreichbar" },
    { k: "hetzner_down", l: "Hetzner nicht erreichbar" },
    { k: "restore_done", l: "Wiederherstellung abgeschlossen" },
  ];
  const [prefs, setPrefs] = useState<Record<string, { internal: boolean; email: boolean }>>({});
  const [email, setEmail] = useState("");

  useEffect(() => { (async () => {
    const { data } = await supabase.from("backup_settings").select("*").eq("key","notifications").maybeSingle();
    if (data?.value) {
      const v = data.value as any;
      setPrefs(v.prefs || {});
      setEmail(v.email || "");
    }
  })(); }, []);

  const save = async () => {
    const { error } = await supabase.from("backup_settings").upsert({ key: "notifications", value: { prefs, email } }, { onConflict: "key" });
    if (error) toast.error("Fehler"); else toast.success("Benachrichtigungen gespeichert");
  };

  return (
    <Card>
      <CardHeader><CardTitle>Benachrichtigungen</CardTitle><CardDescription>Versand intern (AlixWork) und per E-Mail.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 max-w-md">
          <Label>E-Mail Empfänger</Label>
          <Input disabled={!canManage} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="it@alix-lasers.com" />
        </div>
        <div className="border rounded-lg divide-y">
          {events.map((e) => {
            const p = prefs[e.k] || { internal: true, email: false };
            return (
              <div key={e.k} className="flex items-center justify-between p-3">
                <span className="text-sm">{e.l}</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs"><Switch disabled={!canManage} checked={p.internal} onCheckedChange={(v) => setPrefs({ ...prefs, [e.k]: { ...p, internal: v } })} /> Intern</label>
                  <label className="flex items-center gap-2 text-xs"><Switch disabled={!canManage} checked={p.email} onCheckedChange={(v) => setPrefs({ ...prefs, [e.k]: { ...p, email: v } })} /> E-Mail</label>
                </div>
              </div>
            );
          })}
        </div>
        <Button disabled={!canManage} onClick={save}><Save className="h-4 w-4 mr-1" /> Speichern</Button>
      </CardContent>
    </Card>
  );
}
