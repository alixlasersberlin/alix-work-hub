import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/infinity/PageHeader";
import { InfinityTable, type InfinityColumn } from "@/components/infinity/InfinityTable";
import { StatusBadge, type StatusKind } from "@/components/infinity/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, RefreshCw, Webhook, Copy } from "lucide-react";
import { toast } from "sonner";

type SyncState = {
  entity: string;
  last_cursor: string | null;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  items_processed: number | null;
  updated_at: string;
};

type SyncRun = {
  id: string;
  entity: string;
  direction: string;
  trigger: string;
  status: string;
  items_processed: number | null;
  items_created: number | null;
  items_updated: number | null;
  items_failed: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

type Delivery = {
  id: string;
  event_type: string | null;
  external_id: string | null;
  signature_valid: boolean | null;
  status: string;
  error: string | null;
  received_at: string;
};

const WEBHOOK_URL = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/alixsmart-webhook-inbound`;

export default function AlixSmartDeepSync() {
  const [states, setStates] = useState<SyncState[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    const [s, r, d] = await Promise.all([
      supabase.from("alixsmart_sync_state").select("*").order("entity"),
      supabase.from("alixsmart_sync_runs").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("alixsmart_webhook_deliveries").select("*").order("received_at", { ascending: false }).limit(30),
    ]);
    setStates((s.data as SyncState[]) ?? []);
    setRuns((r.data as SyncRun[]) ?? []);
    setDeliveries((d.data as Delivery[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const runSync = async (entity?: string) => {
    setRunning(entity ?? "all");
    try {
      const { data, error } = await supabase.functions.invoke("alixsmart-sync-poll", {
        body: { trigger: "manual", entities: entity ? [entity] : undefined },
      });
      if (error) throw error;
      const res = (data as any)?.results ?? [];
      toast.success(`Sync fertig: ${res.map((x: any) => `${x.entity}=${x.processed}`).join(", ")}`);
      await load();
    } catch (e: any) {
      toast.error(`Sync fehlgeschlagen: ${e.message}`);
    } finally {
      setRunning(null);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("Webhook-URL kopiert");
  };

  const stateCols: InfinityColumn<SyncState>[] = [
    { key: "entity", header: "Entität", cell: (r) => <span className="font-mono">{r.entity}</span> },
    { key: "last_status", header: "Status", cell: (r) => (
      <StatusBadge kind={(r.last_status === "success" ? "done" : r.last_status === "failed" ? "error" : "pending") as StatusKind}
        label={r.last_status ?? "—"} />
    )},
    { key: "last_synced_at", header: "Letzter Sync", cell: (r) => r.last_synced_at ? new Date(r.last_synced_at).toLocaleString("de-DE") : "—" },
    { key: "items_processed", header: "Items", cell: (r) => r.items_processed ?? 0 },
    { key: "last_error", header: "Fehler", cell: (r) => <span className="text-xs text-red-400">{r.last_error ?? "—"}</span> },
    { key: "actions", header: "", cell: (r) => (
      <Button size="sm" variant="outline" disabled={running !== null}
        onClick={() => runSync(r.entity)}>
        <Play className="w-3 h-3 mr-1" /> Sync
      </Button>
    )},
  ];

  const runCols: InfinityColumn<SyncRun>[] = [
    { key: "started_at", header: "Zeit", cell: (r) => new Date(r.started_at).toLocaleString("de-DE") },
    { key: "entity", header: "Entität" },
    { key: "trigger", header: "Trigger" },
    { key: "status", header: "Status", cell: (r) => (
      <StatusBadge kind={(r.status === "success" ? "done" : r.status === "failed" ? "error" : "pending") as StatusKind} label={r.status} />
    )},
    { key: "items_processed", header: "Verarb." },
    { key: "items_created", header: "Neu" },
    { key: "items_updated", header: "Update" },
    { key: "items_failed", header: "Fehler" },
  ];

  const delCols: InfinityColumn<Delivery>[] = [
    { key: "received_at", header: "Empfangen", cell: (r) => new Date(r.received_at).toLocaleString("de-DE") },
    { key: "event_type", header: "Typ" },
    { key: "signature_valid", header: "Signatur", cell: (r) => (
      <StatusBadge kind={r.signature_valid ? "done" : "error"} label={r.signature_valid ? "gültig" : "ungültig"} />
    )},
    { key: "status", header: "Status" },
    { key: "external_id", header: "Ext. ID", cell: (r) => <span className="font-mono text-xs">{r.external_id ?? "—"}</span> },
    { key: "error", header: "Fehler", cell: (r) => <span className="text-xs text-red-400">{r.error ?? "—"}</span> },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="AlixSmart Deep-Sync"
        subtitle="Bidirektionale Live-Sync (Users, Devices, Registrations, Events) via API + Webhooks"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Neu laden</Button>
            <Button onClick={() => runSync()} disabled={running !== null}>
              <Play className="w-4 h-4 mr-1" /> {running === "all" ? "Läuft..." : "Alle synchronisieren"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="w-4 h-4" /> Webhook-Endpunkt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            In AlixSmart als Webhook-Ziel eintragen. Signatur-Header: <code>x-alixsmart-signature: sha256=&lt;hex&gt;</code> (HMAC-SHA256 über Body mit ALIXSMART_WEBHOOK_SECRET).
          </p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded font-mono text-xs">
            <span className="flex-1 break-all">{WEBHOOK_URL}</span>
            <Button size="sm" variant="ghost" onClick={copyWebhook}><Copy className="w-3 h-3" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sync-Status pro Entität</CardTitle></CardHeader>
        <CardContent><InfinityTable columns={stateCols} rows={states} getRowKey={(r) => r.entity} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Letzte Sync-Läufe</CardTitle></CardHeader>
        <CardContent><InfinityTable columns={runCols} rows={runs} getRowKey={(r) => r.id} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Webhook-Deliveries</CardTitle></CardHeader>
        <CardContent><InfinityTable columns={delCols} rows={deliveries} getRowKey={(r) => r.id} /></CardContent>
      </Card>
    </div>
  );
}
