import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type StatusKind } from "@/components/infinity/StatusBadge";
import { toast } from "sonner";
import { Loader2, Save, Link2, Unlink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Device = {
  serial_number: string;
  device_name: string | null;
  device_model: string | null;
  registration_status: "registered" | "unregistered" | "possible";
  registered_at: string | null;
  last_checked_at: string | null;
  alixsmart_device_id: string | null;
  link_id: string | null;
};

const STATUS_MAP: Record<Device["registration_status"], StatusKind> = {
  registered: "done", unregistered: "error", possible: "warning",
};
const STATUS_LABEL: Record<Device["registration_status"], string> = {
  registered: "Registriert", unregistered: "Nicht registriert", possible: "Möglich",
};

export function DeviceDetailDialog({
  open, onOpenChange, customerId, customerName, currentLinkStatus, currentAlixsmartUserId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string | null;
  customerName?: string;
  currentLinkStatus?: string;
  currentAlixsmartUserId?: string | null;
  onSaved?: () => void;
}) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("Super Admin") || hasRole("Admin");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerStatus, setCustomerStatus] = useState<string>(currentLinkStatus || "unregistered");
  const [alixsmartUserId, setAlixsmartUserId] = useState<string>(currentAlixsmartUserId || "");

  useEffect(() => {
    if (!open || !customerId) return;
    setCustomerStatus(currentLinkStatus || "unregistered");
    setAlixsmartUserId(currentAlixsmartUserId || "");
    (async () => {
      setLoading(true);
      // Serials aus View
      const { data: serials, error: e1 } = await supabase
        .from("v_alixsmart_customer_devices" as any)
        .select("serial_number, device_name, device_model")
        .eq("customer_id", customerId);
      if (e1) { toast.error(e1.message); setLoading(false); return; }
      // Existierende device_links
      const { data: links } = await supabase
        .from("alixsmart_device_links")
        .select("id, serial_number, registration_status, registered_at, last_checked_at, alixsmart_device_id")
        .eq("alixwork_customer_id", customerId);
      const linkMap = new Map((links || []).map((l: any) => [l.serial_number, l]));
      const merged: Device[] = ((serials as any[]) || []).map((s) => {
        const l = linkMap.get(s.serial_number);
        return {
          serial_number: s.serial_number,
          device_name: s.device_name,
          device_model: s.device_model,
          registration_status: (l?.registration_status as any) || "unregistered",
          registered_at: l?.registered_at || null,
          last_checked_at: l?.last_checked_at || null,
          alixsmart_device_id: l?.alixsmart_device_id || null,
          link_id: l?.id || null,
        };
      });
      // dedupe by serial
      const seen = new Set<string>();
      setDevices(merged.filter(d => d.serial_number && !seen.has(d.serial_number) && seen.add(d.serial_number)));
      setLoading(false);
    })();
  }, [open, customerId, currentLinkStatus, currentAlixsmartUserId]);

  function updateDevice(serial: string, patch: Partial<Device>) {
    setDevices(prev => prev.map(d => d.serial_number === serial ? { ...d, ...patch } : d));
  }

  async function save() {
    if (!customerId) return;
    setSaving(true);
    try {
      // Customer-Link upsert
      const { data: existing } = await supabase
        .from("alixsmart_customer_links")
        .select("id")
        .eq("alixwork_customer_id", customerId)
        .maybeSingle();
      const linkPayload: any = {
        alixwork_customer_id: customerId,
        match_status: customerStatus,
        alixsmart_user_id: alixsmartUserId.trim() || null,
        last_checked_at: new Date().toISOString(),
        registered_at: customerStatus === "registered" ? new Date().toISOString() : null,
        manual_override: true,
      };
      if (existing?.id) {
        await supabase.from("alixsmart_customer_links").update(linkPayload).eq("id", existing.id);
      } else {
        await supabase.from("alixsmart_customer_links").insert(linkPayload);
      }
      // Device-Links upsert je Serial
      for (const d of devices) {
        const payload: any = {
          alixwork_customer_id: customerId,
          serial_number: d.serial_number,
          device_name: d.device_name,
          device_model: d.device_model,
          registration_status: d.registration_status,
          alixsmart_device_id: d.alixsmart_device_id?.trim() || null,
          registered_at: d.registration_status === "registered" ? (d.registered_at || new Date().toISOString()) : null,
          last_checked_at: new Date().toISOString(),
        };
        if (d.link_id) {
          await supabase.from("alixsmart_device_links").update(payload).eq("id", d.link_id);
        } else {
          await supabase.from("alixsmart_device_links").insert(payload);
        }
      }
      toast.success("Manuelle Zuordnung gespeichert");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Speichern fehlgeschlagen: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const registered = devices.filter(d => d.registration_status === "registered").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Geräte & manuelle Zuordnung</DialogTitle>
          <DialogDescription>
            {customerName ? <span className="font-medium">{customerName}</span> : "Kunde"} · {devices.length} Gerät(e) · {registered} registriert
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade Geräte …
          </div>
        ) : (
          <div className="space-y-6">
            {/* Kunden-Level */}
            <div className="rounded-lg border bg-card/50 p-4 space-y-3">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kunden-Status</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Match-Status</Label>
                  <Select value={customerStatus} onValueChange={setCustomerStatus} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registered">Registriert</SelectItem>
                      <SelectItem value="unregistered">Nicht registriert</SelectItem>
                      <SelectItem value="possible">Möglich</SelectItem>
                      <SelectItem value="reminded">Erinnert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">AlixSmart User-ID (optional)</Label>
                  <Input value={alixsmartUserId} onChange={(e) => setAlixsmartUserId(e.target.value)}
                    placeholder="UUID oder Login-ID" disabled={!canEdit} />
                </div>
              </div>
            </div>

            {/* Devices */}
            <div className="space-y-2">
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Geräte</div>
              {devices.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">Keine Geräte gefunden.</div>}
              {devices.map(d => (
                <div key={d.serial_number} className="rounded-lg border bg-card/30 p-3 grid md:grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <div>
                    <div className="font-mono text-sm">{d.serial_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {[d.device_model, d.device_name].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {d.registered_at && (
                      <div className="text-xs text-emerald-400 mt-1">seit {new Date(d.registered_at).toLocaleDateString("de-DE")}</div>
                    )}
                  </div>
                  <div className="min-w-[160px]">
                    {canEdit ? (
                      <Select value={d.registration_status} onValueChange={(v: any) => updateDevice(d.serial_number, { registration_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="registered">Registriert</SelectItem>
                          <SelectItem value="unregistered">Nicht registriert</SelectItem>
                          <SelectItem value="possible">Möglich</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge kind={STATUS_MAP[d.registration_status]} label={STATUS_LABEL[d.registration_status]} />
                    )}
                  </div>
                  <Input
                    className="w-[180px]"
                    placeholder="AlixSmart Device-ID"
                    value={d.alixsmart_device_id || ""}
                    onChange={(e) => updateDevice(d.serial_number, { alixsmart_device_id: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Speichern
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
