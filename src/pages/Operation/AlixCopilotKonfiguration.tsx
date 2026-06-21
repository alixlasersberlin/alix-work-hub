import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/infinity/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Save, Plus, Trash2, BookOpen, Database, Shield, Wand2,
  Loader2, Send, Power, FileText, ChevronDown, ChevronRight, Search,
  ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";

import { toast } from "sonner";

/** Module-Katalog – identisch zur Edge-Function, dient hier nur als UI-Liste. */
const MODULES: Record<string, string[]> = {
  "Stammdaten": ["customers", "customer_notes", "suppliers", "departments", "tenants", "product_categories"],
  "Verkauf / Leads": ["sales_leads", "sales_followups", "offers", "reviews"],
  "Aufträge": ["orders", "order_items", "order_status_history", "order_notes"],
  "Production": ["production_orders", "production_order_items"],
  "Reparatur": ["repair_orders", "repair_quotes", "repair_parts", "repair_invoice_proposals"],
  "Lager / Geräte": ["lager_devices", "loaner_device_assignments", "device_maintenance", "model_manuals"],
  "Tickets / Support": ["tickets", "ticket_messages", "ticket_attachments"],
  "Tourenplanung / Dispatch": ["route_plans", "dispatch_vehicles", "dispatch_checklists"],
  "Finance": ["finance_records", "finance_transactions", "finance_reminders", "finance_assets", "finance_incoming_invoices"],
  "Zoho": ["zoho_invoices", "zoho_unpaid_invoices", "zoho_items"],
  "ISO 13485 / MDR / QM": ["bugs", "capas", "iso_audits", "iso_change_controls", "mdr_vigilance_reports"],
  "Mail": ["mail_messages", "mail_templates", "mail_campaigns"],
  "WhatsApp / SMS": ["whatsapp_messages", "customer_sms_logs"],
  "Service / Warranty / Maintenance": ["warranty_records", "maintenance_plans", "service_knowledge_base"],
  "AI Center / Insights": ["aic_insights", "aic_reports", "aic_tasks"],
  "AlixSmart": ["alixsmart_products"],
};

type KnowledgeSnippet = { id: string; title: string; content: string };

type CopilotConfig = {
  system_prompt_addon: string;
  knowledge_snippets: KnowledgeSnippet[];
  disabled_modules: string[];
  extra_blocked_tables: string[];
};

const DEFAULT_CONFIG: CopilotConfig = {
  system_prompt_addon: "",
  knowledge_snippets: [],
  disabled_modules: [],
  extra_blocked_tables: [],
};

const SETTINGS_KEY = "alix_copilot_config";

export default function AlixCopilotKonfiguration() {
  const { roles, loading: authLoading } = useAuth();
  const isSuperAdmin = roles?.some((r: any) => (typeof r === "string" ? r : r?.name) === "Super Admin");

  const [cfg, setCfg] = useState<CopilotConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Test-Chat
  const [testQ, setTestQ] = useState("");
  const [testA, setTestA] = useState<{ content: string; trace?: { name: string; args: any }[] } | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
      if (data?.value) {
        try {
          const v = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          setCfg({ ...DEFAULT_CONFIG, ...v });
        } catch { /* keep default */ }
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(cfg),
      }, { onConflict: "key" });
      if (error) throw error;
      toast.success("Konfiguration gespeichert");
    } catch (e: any) {
      toast.error(e.message || "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(mod: string, enabled: boolean) {
    setCfg(c => ({
      ...c,
      disabled_modules: enabled
        ? c.disabled_modules.filter(m => m !== mod)
        : Array.from(new Set([...c.disabled_modules, mod])),
    }));
  }

  function toggleTableBlock(table: string, blocked: boolean) {
    setCfg(c => ({
      ...c,
      extra_blocked_tables: blocked
        ? Array.from(new Set([...c.extra_blocked_tables, table]))
        : c.extra_blocked_tables.filter(t => t !== table),
    }));
  }

  function addSnippet() {
    setCfg(c => ({
      ...c,
      knowledge_snippets: [
        ...c.knowledge_snippets,
        { id: crypto.randomUUID(), title: "Neuer Eintrag", content: "" },
      ],
    }));
  }
  function updateSnippet(id: string, patch: Partial<KnowledgeSnippet>) {
    setCfg(c => ({
      ...c,
      knowledge_snippets: c.knowledge_snippets.map(s => s.id === id ? { ...s, ...patch } : s),
    }));
  }
  function removeSnippet(id: string) {
    setCfg(c => ({ ...c, knowledge_snippets: c.knowledge_snippets.filter(s => s.id !== id) }));
  }

  async function extractPdfText(file: File): Promise<string> {
    const pdfjs: any = await import("pdfjs-dist");
    // Worker via CDN, vermeidet Vite-Worker-Bundling
    const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let out = "";
    const maxPages = Math.min(doc.numPages, 100);
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const txt = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
      out += txt + "\n\n";
      if (out.length > 200_000) break;
    }
    return out.trim();
  }

  async function onUpload(file: File) {
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      let text: string;
      if (isPdf) {
        if (file.size > 20_000_000) { toast.error("PDF zu groß (max. 20 MB)."); return; }
        toast.info("PDF wird verarbeitet …");
        text = await extractPdfText(file);
        if (!text) { toast.error("Kein Text in PDF gefunden (evtl. gescannt – OCR nötig)."); return; }
      } else {
        if (file.size > 500_000) { toast.error("Datei zu groß (max. 500 KB Text)."); return; }
        text = await file.text();
      }
      setCfg(c => ({
        ...c,
        knowledge_snippets: [
          ...c.knowledge_snippets,
          { id: crypto.randomUUID(), title: file.name, content: text.slice(0, 100_000) },
        ],
      }));
      toast.success("Datei als Wissens-Eintrag hinzugefügt");
    } catch (e: any) {
      toast.error(e?.message || "Datei konnte nicht gelesen werden");
    }
  }

  async function runTest() {
    const q = testQ.trim();
    if (!q || testBusy) return;
    setTestBusy(true);
    setTestA(null);
    try {
      const { data, error } = await supabase.functions.invoke("alix-copilot", {
        body: { messages: [{ role: "user", content: q }], page: "/operation/alix-copilot", tenantSources: null },
      });
      if (error) throw error;
      setTestA({ content: (data as any)?.content || (data as any)?.error || "—", trace: (data as any)?.tool_trace ?? [] });
    } catch (e: any) {
      setTestA({ content: `Fehler: ${e.message || "unbekannt"}` });
    } finally {
      setTestBusy(false);
    }
  }

  const totalTables = useMemo(() => Object.values(MODULES).flat().length, []);
  const activeModules = Object.keys(MODULES).length - cfg.disabled_modules.length;

  if (authLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <PageHeader
        icon={Sparkles}
        title="ALIX Copilot – Konfiguration"
        subtitle="Wissen, Module und Sperren für den KI-Copilot zentral verwalten"
        noBreadcrumbs
        meta={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><Database className="w-3 h-3" /> {activeModules}/{Object.keys(MODULES).length} Module aktiv</Badge>
            <Badge variant="outline" className="gap-1"><Shield className="w-3 h-3" /> {cfg.extra_blocked_tables.length} extra gesperrt</Badge>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Speichern
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Zusatz-Anweisungen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /> Zusatz-Anweisungen für ALIX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Wird als zusätzliche System-Anweisung an die KI gesendet (Tonalität, Hausregeln, etc.).
              </Label>
              <Textarea
                rows={5}
                value={cfg.system_prompt_addon}
                onChange={(e) => setCfg(c => ({ ...c, system_prompt_addon: e.target.value }))}
                placeholder="z. B. 'Antworte stets sehr kurz und in Stichpunkten. Verweise bei Finance-Fragen immer auf den zuständigen Buchhalter.'"
              />
            </CardContent>
          </Card>

          {/* Wissens-Bibliothek */}
          <KnowledgeLibrary
            snippets={cfg.knowledge_snippets}
            onAdd={addSnippet}
            onUpdate={updateSnippet}
            onRemove={removeSnippet}
            onUpload={onUpload}
          />


          {/* Module / Abteilungen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Module & Abteilungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Deaktivierte Module werden vom Copilot nicht mehr durchsucht. Einzelne Tabellen können zusätzlich gesperrt werden.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(MODULES).map(([mod, tables]) => {
                  const enabled = !cfg.disabled_modules.includes(mod);
                  return (
                    <div key={mod} className="rounded-lg border border-border bg-card">
                      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <Power className={`w-3.5 h-3.5 ${enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
                          <span className="font-medium text-sm">{mod}</span>
                          <Badge variant="outline" className="text-[10px]">{tables.length}</Badge>
                        </div>
                        <Switch checked={enabled} onCheckedChange={(v) => toggleModule(mod, v)} />
                      </div>
                      <div className="px-3 py-2 flex flex-wrap gap-1">
                        {tables.map(t => {
                          const blocked = cfg.extra_blocked_tables.includes(t);
                          return (
                            <button
                              key={t}
                              onClick={() => toggleTableBlock(t, !blocked)}
                              disabled={!enabled}
                              title={blocked ? "Gesperrt – Klick zum Freigeben" : "Aktiv – Klick zum Sperren"}
                              className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                                blocked
                                  ? "border-destructive/40 bg-destructive/10 text-destructive line-through"
                                  : enabled
                                  ? "border-border bg-secondary/50 hover:bg-secondary"
                                  : "border-border bg-secondary/20 text-muted-foreground opacity-60"
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Insgesamt {totalTables} Tabellen verfügbar. Systemtabellen (Auth, Logs, Backups, Migration) sind hart gesperrt und werden hier nicht angezeigt.
              </p>
            </CardContent>
          </Card>

          {/* Test-Chat */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Test-Chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Sende eine Anfrage an ALIX mit der aktuell gespeicherten Konfiguration. Änderungen oben werden erst nach „Speichern" wirksam.
              </p>
              <div className="flex gap-2">
                <Input
                  value={testQ}
                  onChange={(e) => setTestQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runTest(); }}
                  placeholder="z. B. Wie viele offene Tickets haben wir?"
                />
                <Button onClick={runTest} disabled={testBusy || !testQ.trim()} className="gap-2">
                  {testBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Senden
                </Button>
              </div>
              {testA && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{testA.content}</pre>
                  {testA.trace && testA.trace.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex flex-wrap gap-1">
                        {testA.trace.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{t.name}</Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// -------- Wissens-Bibliothek (zuklappbar) --------
function KnowledgeLibrary({
  snippets, onAdd, onUpdate, onRemove, onUpload,
}: {
  snippets: KnowledgeSnippet[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<KnowledgeSnippet>) => void;
  onRemove: (id: string) => void;
  onUpload: (f: File) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Bei vielen Einträgen standardmäßig kollabiert
  const collapseByDefault = snippets.length > 3;

  const isOpen = (id: string) =>
    collapseByDefault ? open.has(id) : !open.has(`__c_${id}`);

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev);
      const key = collapseByDefault ? id : `__c_${id}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    if (collapseByDefault) setOpen(new Set(filtered.map(s => s.id)));
    else setOpen(new Set()); // alle "__c_*" entfernen
  }
  function collapseAll() {
    if (collapseByDefault) setOpen(new Set());
    else setOpen(new Set(filtered.map(s => `__c_${s.id}`)));
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? snippets.filter(s =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.content || "").toLowerCase().includes(q))
    : snippets;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> Wissens-Bibliothek ({snippets.length})
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {snippets.length > 1 && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Suche…"
                  className="pl-7 h-8 w-44"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={expandAll} className="gap-1 h-8" title="Alle aufklappen">
                <ChevronsUpDown className="w-3.5 h-3.5" /> Alle auf
              </Button>
              <Button size="sm" variant="ghost" onClick={collapseAll} className="gap-1 h-8" title="Alle zuklappen">
                <ChevronsDownUp className="w-3.5 h-3.5" /> Alle zu
              </Button>
            </>
          )}
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer rounded-md border border-border px-3 py-1.5 hover:bg-secondary">
            <FileText className="w-3.5 h-3.5" /> Dateien importieren (bis 10)
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.json,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const list = Array.from(e.target.files || []);
                e.currentTarget.value = "";
                if (!list.length) return;
                const slice = list.slice(0, 10);
                if (list.length > 10) {
                  // best-effort feedback ohne weiteren Import
                  // (toast wird in onUpload für Einzelfehler verwendet)
                }
                for (const f of slice) {
                  // sequenziell, damit setCfg-Updates nicht kollidieren
                  // eslint-disable-next-line no-await-in-loop
                  await onUpload(f);
                }
              }}
            />
          </label>
          <Button size="sm" variant="outline" onClick={onAdd} className="gap-1"><Plus className="w-3.5 h-3.5" /> Neu</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {snippets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Noch keine Einträge. Füge Firmenwissen, Prozessbeschreibungen, FAQ-Antworten oder Verkaufsleitlinien hinzu, die ALIX immer berücksichtigen soll.
          </p>
        )}
        {snippets.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Einträge für „{query}" gefunden.</p>
        )}
        {filtered.map(s => {
          const opened = isOpen(s.id);
          const preview = (s.content || "").replace(/\s+/g, " ").slice(0, 90);
          return (
            <div key={s.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => toggle(s.id)}
                  aria-label={opened ? "Zuklappen" : "Aufklappen"}
                >
                  {opened ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
                <button
                  onClick={() => toggle(s.id)}
                  className="flex-1 min-w-0 text-left flex items-center gap-2"
                >
                  <span className="font-medium text-sm truncate">{s.title || "(ohne Titel)"}</span>
                  {!opened && preview && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                      — {preview}{(s.content || "").length > 90 ? "…" : ""}
                    </span>
                  )}
                </button>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                  {(s.content || "").length.toLocaleString()} Z.
                </span>
                <Button size="icon" variant="ghost" onClick={() => onRemove(s.id)} aria-label="Eintrag löschen" className="h-7 w-7">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              {opened && (
                <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                  <Input
                    value={s.title}
                    onChange={(e) => onUpdate(s.id, { title: e.target.value })}
                    placeholder="Titel"
                    className="font-medium"
                  />
                  <Textarea
                    rows={6}
                    value={s.content}
                    onChange={(e) => onUpdate(s.id, { content: e.target.value })}
                    placeholder="Inhalt …"
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

