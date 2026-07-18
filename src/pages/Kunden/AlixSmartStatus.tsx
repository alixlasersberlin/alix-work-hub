import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/infinity/PageHeader";
import { InfinityTable, type InfinityColumn } from "@/components/infinity/InfinityTable";
import { StatusBadge, type StatusKind } from "@/components/infinity/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, UserCheck, UserX, HelpCircle, Bell, Play, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  customer_id: string;
  customer_number: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source_system: string | null;
  device_count: number;
  serial_numbers: string[] | null;
  match_status: "registered" | "unregistered" | "possible" | "reminded";
  match_score: number | null;
  last_reminder_at: string | null;
  registered_at: string | null;
};

const STATUS_MAP: Record<Row["match_status"], StatusKind> = {
  registered: "done", unregistered: "error", possible: "warning", reminded: "pending",
};
const STATUS_LABEL: Record<Row["match_status"], string> = {
  registered: "Registriert", unregistered: "Nicht registriert", possible: "Möglich", reminded: "Erinnert",
};

export default function AlixSmartStatus() {
  const { hasRole } = useAuth();
  const canAdmin = hasRole("Super Admin") || hasRole("Admin");
  const canSend = canAdmin || hasRole("Vertrieb") || hasRole("Kundenservice");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | "match" | "email" | "sms">(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_alixsmart_customer_status" as any)
      .select("*").order("company_name", { ascending: true }).limit(1000);
    if (error) toast.error("Fehler: " + error.message);
    setRows((data as any) || []);
    setSelected(new Set());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const s = { total: rows.length, registered: 0, unregistered: 0, possible: 0, reminded: 0 };
    rows.forEach(r => { s[r.match_status] += 1; });
    return s;
  }, [rows]);

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.customer_id)));
  }

  async function runMatch() {
    setBusy("match");
    const { data, error } = await supabase.functions.invoke("alixsmart-match-run", { body: {} });
    setBusy(null);
    if (error) return toast.error("Match fehlgeschlagen: " + error.message);
    toast.success(`Match ok: ${data?.registered ?? 0} registriert · ${data?.possible ?? 0} möglich · ${data?.unregistered ?? 0} offen`);
    load();
  }

  async function sendReminder(channel: "email" | "sms") {
    const ids = Array.from(selected);
    if (!ids.length) return toast.info("Bitte Kunden auswählen");
    setBusy(channel);
    const { data, error } = await supabase.functions.invoke("alixsmart-send-reminder", {
      body: { customer_ids: ids, channel },
    });
    setBusy(null);
    if (error) return toast.error("Versand fehlgeschlagen: " + error.message);
    toast.success(`${data?.sent ?? 0} von ${ids.length} ${channel === "email" ? "E-Mails" : "SMS"} gesendet`);
    load();
  }

  const cols: InfinityColumn<Row>[] = [
    { key: "customer_id", header: "", width: "36px",
      cell: (r) => (
        <Checkbox checked={selected.has(r.customer_id)} onCheckedChange={() => toggle(r.customer_id)}
          onClick={(e) => e.stopPropagation()} />
      ) },
    { key: "customer_number", header: "Kd-Nr.", sortable: true, width: "110px" },
    { key: "company_name", header: "Firma", sortable: true,
      cell: (r) => <span className="font-medium">{r.company_name || r.contact_name || "—"}</span> },
    { key: "email", header: "E-Mail", sortable: true },
    { key: "device_count", header: "Geräte", sortable: true, align: "right", width: "80px" },
    { key: "serial_numbers", header: "Seriennummern",
      cell: (r) => <span className="text-xs text-muted-foreground">{(r.serial_numbers || []).slice(0, 3).join(", ")}{(r.serial_numbers?.length || 0) > 3 ? " …" : ""}</span> },
    { key: "match_status", header: "Status", sortable: true, width: "160px",
      cell: (r) => <StatusBadge kind={STATUS_MAP[r.match_status]} label={STATUS_LABEL[r.match_status]} /> },
    { key: "last_reminder_at", header: "Letzte Erinnerung", sortable: true,
      cell: (r) => r.last_reminder_at ? new Date(r.last_reminder_at).toLocaleDateString("de-DE") : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AlixSmart Anmeldestatus"
        subtitle="Übersicht welche Kunden mit Geräten in AlixSmart registriert sind"
        actions={
          <div className="flex flex-wrap gap-2">
            {canAdmin && (
              <Button variant="outline" size="sm" onClick={runMatch} disabled={busy !== null}>
                <Play className={`h-4 w-4 mr-2 ${busy === "match" ? "animate-spin" : ""}`} /> Match ausführen
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Kunden mit Geräten" value={stats.total} icon={<HelpCircle className="h-4 w-4" />} />
        <StatTile label="Registriert" value={stats.registered} tone="emerald" icon={<UserCheck className="h-4 w-4" />} />
        <StatTile label="Nicht registriert" value={stats.unregistered} tone="rose" icon={<UserX className="h-4 w-4" />} />
        <StatTile label="Möglich" value={stats.possible} tone="amber" icon={<HelpCircle className="h-4 w-4" />} />
        <StatTile label="Erinnert" value={stats.reminded} tone="sky" icon={<Bell className="h-4 w-4" />} />
      </div>

      {canSend && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/50 p-3">
          <Button size="sm" variant="ghost" onClick={toggleAll}>
            {selected.size === rows.length && rows.length > 0 ? "Auswahl aufheben" : "Alle auswählen"}
          </Button>
          <span className="text-sm text-muted-foreground mr-2">{selected.size} ausgewählt</span>
          <Button size="sm" onClick={() => sendReminder("email")} disabled={!selected.size || busy !== null}>
            <Mail className="h-4 w-4 mr-2" /> Email-Erinnerung
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendReminder("sms")} disabled={!selected.size || busy !== null}>
            <MessageSquare className="h-4 w-4 mr-2" /> SMS-Erinnerung
          </Button>
        </div>
      )}

      <InfinityTable<Row>
        rows={rows}
        columns={cols}
        rowKey={(r) => r.customer_id}
        searchKeys={["company_name", "contact_name", "email", "customer_number"]}
        initialSort={{ key: "company_name", dir: "asc" }}
        exportFileName="alixsmart-anmeldestatus.csv"
        emptyText={loading ? "Lade …" : "Keine Kunden mit Geräten gefunden."}
      />
    </div>
  );
}

function StatTile({ label, value, tone, icon }: { label: string; value: number; tone?: "emerald"|"rose"|"amber"|"sky"; icon?: React.ReactNode }) {
  const toneCls =
    tone === "emerald" ? "border-emerald-500/30 text-emerald-300" :
    tone === "rose" ? "border-rose-500/30 text-rose-300" :
    tone === "amber" ? "border-amber-500/30 text-amber-300" :
    tone === "sky" ? "border-sky-500/30 text-sky-300" :
    "border-border text-foreground";
  return (
    <div className={`rounded-lg border bg-card/50 p-3 ${toneCls}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
