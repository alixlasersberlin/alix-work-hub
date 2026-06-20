import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/infinity/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sparkles, Database, BookOpen, Upload, Building2, Shield, FileText,
  Loader2, Plus, Trash2, Save, Search, AlertTriangle, Activity, History,
  CheckCircle2, XCircle, ListChecks, Globe,
} from "lucide-react";
import { toast } from "sonner";

const ALLOWED_ROLES = ["Super Admin", "Admin", "Geschäftsführung", "QM"];

const TONE_OPTIONS = [
  { value: "professional", label: "Professionell" },
  { value: "short", label: "Kurz" },
  { value: "detailed", label: "Ausführlich" },
  { value: "support", label: "Support" },
  { value: "sales", label: "Vertrieb" },
];

const SOURCE_TYPES = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "Word" },
  { value: "xlsx", label: "Excel/CSV" },
  { value: "csv", label: "CSV" },
  { value: "text", label: "Text/Wissen" },
  { value: "url", label: "Webseite / URL" },
  { value: "module", label: "AlixWork-Modul" },
];

// ----------------------- Types -----------------------
type Source = {
  id: string; title: string; description?: string | null; category?: string | null;
  department?: string | null; source_type: string; file_path?: string | null;
  url?: string | null; status: string; visible_to_copilot: boolean;
  last_import_at?: string | null; version?: string | null;
  valid_from?: string | null; valid_to?: string | null; tags?: string[] | null;
  created_at: string;
};
type Dept = {
  id: string; key: string; label: string; enabled: boolean;
  search_documents: boolean; search_tickets: boolean; search_customers: boolean;
  search_devices: boolean; search_repairs: boolean; search_offers: boolean;
  search_invoices: boolean; search_maintenance: boolean;
};
type Module = {
  id: string; module_key: string; label: string; enabled: boolean;
  read_allowed: boolean; write_allowed: boolean;
  data_scope?: string | null; role_restrictions?: string[] | null;
};
type ImportJob = {
  id: string; filename?: string | null; category?: string | null;
  department?: string | null; status: string; recognized_items?: number | null;
  error_message?: string | null; version?: string | null; created_at: string;
  finished_at?: string | null;
};
type Knowledge = {
  id: string; title: string; content: string; category?: string | null;
  department?: string | null; priority: string; source?: string | null;
  version?: string | null; status: string; valid_from?: string | null;
  valid_to?: string | null; tags?: string[] | null; created_at: string;
};
type Settings = {
  id?: string; key: string;
  only_approved_sources: boolean; cite_sources: boolean;
  prioritize_internal: boolean; prioritize_iso: boolean;
  restrict_customer_data: boolean; restrict_finance_data: boolean;
  restrict_pii: boolean; mark_uncertain: boolean;
  auto_language: boolean; tone: string;
};
type AuditRow = {
  id: string; entity: string; entity_id?: string | null; action: string;
  user_id?: string | null; created_at: string;
};

const DEFAULT_SETTINGS: Settings = {
  key: "global",
  only_approved_sources: true, cite_sources: true,
  prioritize_internal: true, prioritize_iso: true,
  restrict_customer_data: true, restrict_finance_data: true,
  restrict_pii: true, mark_uncertain: true,
  auto_language: true, tone: "professional",
};

// ----------------------- Helpers -----------------------
async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  const pages = Math.min(doc.numPages, 100);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    out += c.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
    if (out.length > 200_000) break;
  }
  return out.trim();
}

// ============================================================
export default function AlixCopilotConfig() {
  const { roles, loading: authLoading } = useAuth();
  const hasAccess = roles?.some((r) => ALLOWED_ROLES.includes(r));

  const [tab, setTab] = useState("overview");

  // Data state
  const [sources, setSources] = useState<Source[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [s, d, m, i, k, st, a] = await Promise.all([
      supabase.from("copilot_sources").select("*").order("created_at", { ascending: false }),
      supabase.from("copilot_departments").select("*").order("label"),
      supabase.from("copilot_module_access").select("*").order("label"),
      supabase.from("copilot_import_jobs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("copilot_knowledge_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("copilot_settings").select("*").eq("key", "global").maybeSingle(),
      supabase.from("copilot_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setSources((s.data as any) || []);
    setDepts((d.data as any) || []);
    setModules((m.data as any) || []);
    setImports((i.data as any) || []);
    setKnowledge((k.data as any) || []);
    if (st.data) setSettings({ ...DEFAULT_SETTINGS, ...(st.data as any) });
    setAudit((a.data as any) || []);
    setLoading(false);
  }

  useEffect(() => { if (hasAccess) loadAll(); }, [hasAccess]);

  if (authLoading) return null;
  if (!hasAccess) return <Navigate to="/" replace />;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <PageHeader
        icon={Sparkles}
        title="ALIX Copilot Konfiguration"
        subtitle="Verwalten Sie Datenquellen, Abteilungen, Wissensbereiche und Zugriffseinstellungen für den ALIX Copilot."
        noBreadcrumbs
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="overview"><Activity className="w-4 h-4 mr-1" /> Übersicht</TabsTrigger>
            <TabsTrigger value="sources"><Database className="w-4 h-4 mr-1" /> Datenquellen</TabsTrigger>
            <TabsTrigger value="departments"><Building2 className="w-4 h-4 mr-1" /> Abteilungen</TabsTrigger>
            <TabsTrigger value="modules"><ListChecks className="w-4 h-4 mr-1" /> Module</TabsTrigger>
            <TabsTrigger value="import"><Upload className="w-4 h-4 mr-1" /> KI-Import</TabsTrigger>
            <TabsTrigger value="knowledge"><BookOpen className="w-4 h-4 mr-1" /> Wissen</TabsTrigger>
            <TabsTrigger value="behavior"><Sparkles className="w-4 h-4 mr-1" /> Antwortverhalten</TabsTrigger>
            <TabsTrigger value="permissions"><Shield className="w-4 h-4 mr-1" /> Berechtigungen</TabsTrigger>
            <TabsTrigger value="audit"><History className="w-4 h-4 mr-1" /> Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><OverviewTab sources={sources} depts={depts} imports={imports} settings={settings} /></TabsContent>
          <TabsContent value="sources"><SourcesTab rows={sources} depts={depts} reload={loadAll} /></TabsContent>
          <TabsContent value="departments"><DepartmentsTab rows={depts} reload={loadAll} /></TabsContent>
          <TabsContent value="modules"><ModulesTab rows={modules} reload={loadAll} /></TabsContent>
          <TabsContent value="import"><ImportTab rows={imports} depts={depts} reload={loadAll} /></TabsContent>
          <TabsContent value="knowledge"><KnowledgeTab rows={knowledge} depts={depts} reload={loadAll} /></TabsContent>
          <TabsContent value="behavior"><BehaviorTab value={settings} setValue={setSettings} reload={loadAll} /></TabsContent>
          <TabsContent value="permissions"><PermissionsTab /></TabsContent>
          <TabsContent value="audit"><AuditTab rows={audit} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================
// Overview
function OverviewTab({ sources, depts, imports, settings }: any) {
  const activeSources = sources.filter((s: Source) => s.status === "active").length;
  const lastImport = imports[0]?.created_at;
  const failed = imports.filter((i: ImportJob) => i.status === "error").length;
  const enabledDepts = depts.filter((d: Dept) => d.enabled).length;

  const Tile = ({ icon: Icon, label, value, hint }: any) => (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="font-semibold text-lg">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile icon={Database} label="Aktive Datenquellen" value={activeSources} hint={`${sources.length} gesamt`} />
      <Tile icon={Upload} label="Importierte Dokumente" value={sources.filter((s: Source) => ["pdf","docx","xlsx","csv"].includes(s.source_type)).length} />
      <Tile icon={History} label="Letzter KI-Import" value={lastImport ? new Date(lastImport).toLocaleDateString("de-DE") : "—"} />
      <Tile icon={Building2} label="Abteilungen aktiv" value={`${enabledDepts}/${depts.length}`} />
      <Tile icon={Sparkles} label="KI-Suche" value={settings.only_approved_sources ? "Strikt" : "Offen"} hint={`Ton: ${settings.tone}`} />
      <Tile icon={AlertTriangle} label="Fehlerhafte Imports" value={failed} />
    </div>
  );
}

// ============================================================
// Sources
function SourcesTab({ rows, depts, reload }: { rows: Source[]; depts: Dept[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = rows.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase())
            || r.category?.toLowerCase().includes(search.toLowerCase())
            || r.department?.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleStatus(r: Source) {
    const next = r.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("copilot_sources").update({ status: next }).eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success("Status aktualisiert"); reload(); }
  }
  async function toggleVisible(r: Source) {
    const { error } = await supabase.from("copilot_sources").update({ visible_to_copilot: !r.visible_to_copilot }).eq("id", r.id);
    if (error) toast.error(error.message); else reload();
  }
  async function remove(r: Source) {
    if (!confirm(`Datenquelle „${r.title}" löschen?`)) return;
    const { error } = await supabase.from("copilot_sources").delete().eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success("Gelöscht"); reload(); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Datenquellen ({rows.length})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche…" className="pl-7 h-8 w-48" />
          </div>
          <SourceDialog open={open} setOpen={setOpen} depts={depts} reload={reload} />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Datenquellen vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Abteilung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sichtbar</TableHead>
                  <TableHead>Letzter Import</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell><Badge variant="outline">{r.source_type}</Badge></TableCell>
                    <TableCell>{r.category || "—"}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>
                      <button onClick={() => toggleStatus(r)}>
                        <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                      </button>
                    </TableCell>
                    <TableCell><Switch checked={r.visible_to_copilot} onCheckedChange={() => toggleVisible(r)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.last_import_at ? new Date(r.last_import_at).toLocaleString("de-DE") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceDialog({ open, setOpen, depts, reload }: any) {
  const [form, setForm] = useState<any>({
    title: "", description: "", category: "", department: "",
    source_type: "text", url: "", version: "",
    valid_from: "", valid_to: "", tags: "",
    visible_to_copilot: true, status: "active",
  });
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function save() {
    if (!form.title.trim()) { toast.error("Titel ist Pflicht."); return; }
    setBusy(true);
    try {
      let description = form.description;
      let extracted_chars = 0;
      if (file) {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
          if (file.size > 20_000_000) throw new Error("PDF zu groß (max. 20 MB).");
          const text = await extractPdfText(file);
          if (!text) throw new Error("Kein Text in PDF gefunden (evtl. gescannt).");
          description = (description ? description + "\n\n" : "") + text.slice(0, 100_000);
          extracted_chars = text.length;
        } else if (file.size <= 500_000) {
          const text = await file.text();
          description = (description ? description + "\n\n" : "") + text.slice(0, 100_000);
          extracted_chars = text.length;
        } else {
          throw new Error("Nur PDF (≤20 MB) oder Text/CSV/JSON (≤500 KB) werden inline extrahiert.");
        }
      }

      const payload: any = {
        title: form.title.trim(),
        description: description || null,
        category: form.category || null,
        department: form.department || null,
        source_type: form.source_type,
        url: form.url || null,
        version: form.version || null,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        visible_to_copilot: form.visible_to_copilot,
        status: form.status,
        last_import_at: file ? new Date().toISOString() : null,
      };
      const { data: src, error } = await supabase.from("copilot_sources").insert(payload).select().single();
      if (error) throw error;

      if (file) {
        await supabase.from("copilot_source_files").insert({
          source_id: (src as any).id, filename: file.name, mime: file.type,
          size_bytes: file.size, extracted_chars,
        });
        await supabase.from("copilot_import_jobs").insert({
          source_id: (src as any).id, filename: file.name, category: form.category,
          department: form.department, tags: payload.tags, status: "done",
          recognized_items: 1, finished_at: new Date().toISOString(),
        });
      }
      toast.success("Datenquelle gespeichert");
      setOpen(false); setFile(null); reload();
      setForm({ title: "", description: "", category: "", department: "", source_type: "text",
        url: "", version: "", valid_from: "", valid_to: "", tags: "",
        visible_to_copilot: true, status: "active" });
    } catch (e: any) {
      toast.error(e.message || "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Neue Datenquelle</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Neue Datenquelle</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Titel *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Typ</Label>
              <Select value={form.source_type} onValueChange={(v) => setForm({ ...form, source_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategorie</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Abteilung</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{depts.map((d: Dept) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
            <div>
              <Label>Gültig ab</Label>
              <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
            </div>
            <div>
              <Label>Gültig bis</Label>
              <Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
            </div>
            {form.source_type === "url" && (
              <div className="col-span-2">
                <Label>URL</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
              </div>
            )}
            {["pdf","docx","xlsx","csv","text"].includes(form.source_type) && (
              <div className="col-span-2">
                <Label>Datei (PDF/Text/CSV/JSON) – optional</Label>
                <Input type="file" accept=".pdf,.txt,.md,.csv,.json,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <p className="text-[11px] text-muted-foreground mt-1">PDF wird extrahiert (max. 100 Seiten / 200k Zeichen).</p>
              </div>
            )}
            <div className="col-span-2">
              <Label>Beschreibung / Inhalt</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Tags (Komma-getrennt)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.visible_to_copilot} onCheckedChange={(v) => setForm({ ...form, visible_to_copilot: v })} />
                Für Copilot sichtbar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                Aktiv
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Departments
function DepartmentsTab({ rows, reload }: { rows: Dept[]; reload: () => void }) {
  async function update(d: Dept, patch: Partial<Dept>) {
    const { error } = await supabase.from("copilot_departments").update(patch).eq("id", d.id);
    if (error) toast.error(error.message); else reload();
  }
  const SEARCH_KEYS: { key: keyof Dept; label: string }[] = [
    { key: "search_documents", label: "Dokumente" },
    { key: "search_tickets", label: "Tickets" },
    { key: "search_customers", label: "Kundenakten" },
    { key: "search_devices", label: "Geräteakten" },
    { key: "search_repairs", label: "Reparaturen" },
    { key: "search_offers", label: "Angebote" },
    { key: "search_invoices", label: "Rechnungen" },
    { key: "search_maintenance", label: "Wartungen" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map(d => (
        <Card key={d.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> {d.label}
            </CardTitle>
            <Switch checked={d.enabled} onCheckedChange={(v) => update(d, { enabled: v })} />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pt-2">
            {SEARCH_KEYS.map(({ key, label }) => (
              <label key={key as string} className="flex items-center justify-between gap-2 text-sm rounded border border-border px-2 py-1.5">
                <span className={d.enabled ? "" : "text-muted-foreground"}>{label}</span>
                <Switch disabled={!d.enabled} checked={!!d[key]} onCheckedChange={(v) => update(d, { [key]: v } as any)} />
              </label>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Modules
function ModulesTab({ rows, reload }: { rows: Module[]; reload: () => void }) {
  async function update(m: Module, patch: Partial<Module>) {
    const { error } = await supabase.from("copilot_module_access").update(patch).eq("id", m.id);
    if (error) toast.error(error.message); else reload();
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-primary" /> AlixWork Module</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modul</TableHead>
              <TableHead>Aktiv</TableHead>
              <TableHead>Lesen</TableHead>
              <TableHead>Schreiben</TableHead>
              <TableHead>Datenbereich</TableHead>
              <TableHead>Rollenbeschränkung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.label}<div className="text-[11px] text-muted-foreground">{m.module_key}</div></TableCell>
                <TableCell><Switch checked={m.enabled} onCheckedChange={(v) => update(m, { enabled: v })} /></TableCell>
                <TableCell><Switch disabled={!m.enabled} checked={m.read_allowed} onCheckedChange={(v) => update(m, { read_allowed: v })} /></TableCell>
                <TableCell><Switch disabled={!m.enabled} checked={m.write_allowed} onCheckedChange={(v) => update(m, { write_allowed: v })} /></TableCell>
                <TableCell>
                  <Input className="h-8" defaultValue={m.data_scope || ""} placeholder="z. B. nur Stammdaten"
                    onBlur={(e) => e.target.value !== (m.data_scope || "") && update(m, { data_scope: e.target.value || null })} />
                </TableCell>
                <TableCell>
                  <Input className="h-8" defaultValue={(m.role_restrictions || []).join(", ")} placeholder="Rolle1, Rolle2"
                    onBlur={(e) => {
                      const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                      const cur = (m.role_restrictions || []).join(",");
                      if (arr.join(",") !== cur) update(m, { role_restrictions: arr });
                    }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Import
function ImportTab({ rows, depts, reload }: { rows: ImportJob[]; depts: Dept[]; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: "", department: "", tags: "" });
  const [file, setFile] = useState<File | null>(null);

  async function startImport() {
    if (!file) { toast.error("Bitte Datei wählen."); return; }
    setBusy(true);
    let jobId: string | null = null;
    try {
      const { data: job, error: jerr } = await supabase.from("copilot_import_jobs").insert({
        filename: file.name, category: form.category || null, department: form.department || null,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        status: "pending",
      }).select().single();
      if (jerr) throw jerr;
      jobId = (job as any).id;

      let text = "";
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        if (file.size > 20_000_000) throw new Error("PDF zu groß.");
        text = await extractPdfText(file);
      } else if (file.size <= 500_000) {
        text = await file.text();
      } else {
        throw new Error("Nur PDF (≤20 MB) oder Text/CSV (≤500 KB).");
      }
      if (!text) throw new Error("Kein Text extrahiert.");

      const { data: src, error: serr } = await supabase.from("copilot_sources").insert({
        title: file.name,
        description: text.slice(0, 100_000),
        category: form.category || null,
        department: form.department || null,
        source_type: isPdf ? "pdf" : (file.name.endsWith(".csv") ? "csv" : "text"),
        status: "active", visible_to_copilot: true,
        last_import_at: new Date().toISOString(),
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      }).select().single();
      if (serr) throw serr;

      await supabase.from("copilot_source_files").insert({
        source_id: (src as any).id, filename: file.name, mime: file.type,
        size_bytes: file.size, extracted_chars: text.length,
      });
      await supabase.from("copilot_import_jobs").update({
        source_id: (src as any).id, status: "done",
        recognized_items: 1, finished_at: new Date().toISOString(),
      }).eq("id", jobId);

      toast.success("Import erfolgreich");
      setFile(null); setForm({ category: "", department: "", tags: "" });
      reload();
    } catch (e: any) {
      if (jobId) await supabase.from("copilot_import_jobs").update({
        status: "error", error_message: e.message, finished_at: new Date().toISOString(),
      }).eq("id", jobId);
      toast.error(e.message || "Import fehlgeschlagen");
      reload();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Neuer KI-Import</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Datei</Label>
            <Input type="file" accept=".pdf,.txt,.md,.csv,.json,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Kategorie</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <Label>Abteilung</Label>
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{depts.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="komma, getrennt" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={startImport} disabled={busy || !file} className="gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import starten
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Import-Historie</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Imports.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Datei</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Abteilung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inhalte</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("de-DE")}</TableCell>
                    <TableCell>{r.filename || "—"}</TableCell>
                    <TableCell>{r.category || "—"}</TableCell>
                    <TableCell>{r.department || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "done" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.recognized_items ?? 0}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[260px] truncate">{r.error_message || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Knowledge
function KnowledgeTab({ rows, depts, reload }: { rows: Knowledge[]; depts: Dept[]; reload: () => void }) {
  const [editing, setEditing] = useState<Partial<Knowledge> | null>(null);
  async function save() {
    if (!editing?.title?.trim()) { toast.error("Titel ist Pflicht."); return; }
    const payload = {
      title: editing.title, content: editing.content || "",
      category: editing.category || null, department: editing.department || null,
      priority: editing.priority || "mittel", source: editing.source || null,
      version: editing.version || null, status: editing.status || "active",
      valid_from: editing.valid_from || null, valid_to: editing.valid_to || null,
      tags: (editing.tags as any) || [],
    };
    const { error } = editing.id
      ? await supabase.from("copilot_knowledge_entries").update(payload).eq("id", editing.id)
      : await supabase.from("copilot_knowledge_entries").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Gespeichert"); setEditing(null); reload(); }
  }
  async function remove(id: string) {
    if (!confirm("Eintrag löschen?")) return;
    const { error } = await supabase.from("copilot_knowledge_entries").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Gelöscht"); reload(); }
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Wissensdatenbank ({rows.length})</CardTitle>
        <Button size="sm" onClick={() => setEditing({ priority: "mittel", status: "active" })} className="gap-1">
          <Plus className="w-4 h-4" /> Neuer Eintrag
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Einträge.</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gültig bis</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setEditing(r)}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.category || "—"}</TableCell>
                  <TableCell>{r.department || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.priority}</Badge></TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.valid_to || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Eintrag bearbeiten" : "Neuer Eintrag"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Titel *</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Kategorie</Label>
                <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              </div>
              <div>
                <Label>Abteilung</Label>
                <Select value={editing.department || ""} onValueChange={(v) => setEditing({ ...editing, department: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{depts.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorität</Label>
                <Select value={editing.priority || "mittel"} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoch">Hoch</SelectItem>
                    <SelectItem value="mittel">Mittel</SelectItem>
                    <SelectItem value="niedrig">Niedrig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status || "active"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                    <SelectItem value="archived">Archiviert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Version</Label>
                <Input value={editing.version || ""} onChange={(e) => setEditing({ ...editing, version: e.target.value })} />
              </div>
              <div>
                <Label>Quelle</Label>
                <Input value={editing.source || ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
              </div>
              <div>
                <Label>Gültig ab</Label>
                <Input type="date" value={editing.valid_from || ""} onChange={(e) => setEditing({ ...editing, valid_from: e.target.value })} />
              </div>
              <div>
                <Label>Gültig bis</Label>
                <Input type="date" value={editing.valid_to || ""} onChange={(e) => setEditing({ ...editing, valid_to: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Inhalt</Label>
                <Textarea rows={6} value={editing.content || ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={save} className="gap-2"><Save className="w-4 h-4" /> Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============================================================
// Behavior
function BehaviorTab({ value, setValue, reload }: { value: Settings; setValue: (s: Settings) => void; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { error } = await supabase.from("copilot_settings")
      .update({ ...value }).eq("key", "global");
    if (error) toast.error(error.message); else { toast.success("Gespeichert"); reload(); }
    setBusy(false);
  }
  const Row = ({ k, label, hint }: { k: keyof Settings; label: string; hint?: string }) => (
    <label className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={value[k] as boolean} onCheckedChange={(v) => setValue({ ...value, [k]: v })} />
    </label>
  );
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Antwortverhalten</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Row k="only_approved_sources" label="Nur freigegebene Quellen verwenden" />
          <Row k="cite_sources" label="Antwort mit Quellenhinweis" />
          <Row k="prioritize_internal" label="Interne Daten priorisieren" />
          <Row k="prioritize_iso" label="ISO/QM-Dokumente priorisieren" />
          <Row k="restrict_customer_data" label="Kundendaten nur rollenbasiert" />
          <Row k="restrict_finance_data" label="Finanzdaten nur Finance/Admin" />
          <Row k="restrict_pii" label="Personenbezogene Daten schützen" />
          <Row k="mark_uncertain" label="Unsichere Antworten markieren" />
          <Row k="auto_language" label="Sprache automatisch erkennen" />
        </div>
        <div className="flex items-center gap-3">
          <Label className="min-w-[80px]">Tonalität</Label>
          <Select value={value.tone} onValueChange={(v) => setValue({ ...value, tone: v })}>
            <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
            <SelectContent>{TONE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Permissions
function PermissionsTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Berechtigungen</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Diese Konfigurationsseite ist sichtbar für folgende Rollen:</p>
        <div className="flex flex-wrap gap-2">
          {ALLOWED_ROLES.map(r => <Badge key={r} variant="default">{r}</Badge>)}
        </div>
        <Separator />
        <p className="text-muted-foreground">
          Der ALIX Copilot darf später nur Daten verwenden, die <b>aktiv</b>, <b>freigegeben</b>,
          einer <b>erlaubten Abteilung</b> zugeordnet sind, innerhalb der
          <b> Rollenberechtigung</b> des aktuellen Nutzers liegen, <b>nicht abgelaufen</b> und
          <b> nicht archiviert</b> wurden.
        </p>
        <p className="text-muted-foreground">
          Die Anbindung dieser Steuerzentrale an die Copilot-Edge-Function erfolgt im nächsten Rollout.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Audit
function AuditTab({ rows }: { rows: AuditRow[] }) {
  const [search, setSearch] = useState("");
  const filtered = rows.filter(r =>
    !search || r.entity.toLowerCase().includes(search.toLowerCase())
            || r.action.toLowerCase().includes(search.toLowerCase())
            || (r.entity_id || "").includes(search)
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Audit Log ({rows.length})</CardTitle>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche…" className="pl-7 h-8 w-48" />
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Keine Einträge.</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeit</TableHead>
                <TableHead>Entität</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Benutzer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("de-DE")}</TableCell>
                  <TableCell><Badge variant="outline">{r.entity}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.action === "DELETE" ? "destructive" : r.action === "INSERT" ? "default" : "secondary"}>
                      {r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">{r.entity_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell className="font-mono text-[11px]">{r.user_id?.slice(0, 8) || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
