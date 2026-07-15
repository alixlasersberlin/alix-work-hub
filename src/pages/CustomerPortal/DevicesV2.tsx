import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cpu, Calendar, Wrench } from 'lucide-react';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

type Device = {
  id: string;
  serial_number: string | null;
  model_name: string | null;
  device_status: string | null;
  commissioning_date: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
};

type Maint = {
  id: string;
  serial_number: string | null;
  device_name: string | null;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
  maintenance_status: string | null;
};

export default function CustomerPortalDevicesV2() {
  const ctx = useOutletContext<Ctx>();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [maint, setMaint] = useState<Maint[]>([]);

  useEffect(() => {
    (async () => {
      const [dRes, mRes] = await Promise.all([
        supabase.from('lager_devices').select('id, serial_number, model_name, device_status, commissioning_date, last_service_date, next_service_date').order('commissioning_date', { ascending: false }),
        supabase.from('device_maintenance').select('id, serial_number, device_name, last_maintenance_date, next_maintenance_date, maintenance_status').eq('customer_id', ctx.customerId).order('next_maintenance_date', { ascending: true, nullsFirst: false }),
      ]);
      setDevices((dRes.data ?? []) as Device[]);
      setMaint((mRes.data ?? []) as Maint[]);
      setLoading(false);
      void logPortalAudit({ action: 'device_viewed', customerId: ctx.customerId });
    })();
  }, [ctx.customerId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  // Merge: Wartungshistorie je Seriennummer
  const maintBySerial = new Map<string, Maint>();
  maint.forEach((m) => { if (m.serial_number) maintBySerial.set(m.serial_number, m); });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2"><Cpu className="w-5 h-5" /> Meine Geräte</h2>
        <p className="text-muted-foreground text-sm">Übersicht aller bei Alix Lasers hinterlegten Geräte inkl. Wartungsstatus.</p>
      </div>

      {devices.length === 0 && maint.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Keine Geräte hinterlegt.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((d) => {
            const m = d.serial_number ? maintBySerial.get(d.serial_number) : undefined;
            return (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{d.model_name ?? 'Gerät'}</span>
                    {d.device_status && <Badge variant="outline">{d.device_status}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Row label="Seriennummer" value={<span className="font-mono">{d.serial_number ?? '—'}</span>} />
                  <Row label="Inbetriebnahme" value={fmtDate(d.commissioning_date)} icon={<Calendar className="w-3.5 h-3.5" />} />
                  <Row label="Letzte Wartung" value={fmtDate(m?.last_maintenance_date ?? d.last_service_date)} icon={<Wrench className="w-3.5 h-3.5" />} />
                  <Row label="Nächste Wartung" value={fmtDate(m?.next_maintenance_date ?? d.next_service_date)} icon={<Calendar className="w-3.5 h-3.5" />} />
                  {m?.maintenance_status && <div className="pt-1"><Badge>{m.maintenance_status}</Badge></div>}
                </CardContent>
              </Card>
            );
          })}
          {/* Wartungseinträge ohne passendes Gerät in lager_devices */}
          {maint.filter((m) => !devices.some((d) => d.serial_number && d.serial_number === m.serial_number)).map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{m.device_name ?? 'Wartung'}</span>
                  {m.maintenance_status && <Badge>{m.maintenance_status}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Seriennummer" value={<span className="font-mono">{m.serial_number ?? '—'}</span>} />
                <Row label="Letzte Wartung" value={fmtDate(m.last_maintenance_date)} />
                <Row label="Nächste Wartung" value={fmtDate(m.next_maintenance_date)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
function fmtDate(d?: string | null) { return d ? new Date(d).toLocaleDateString('de-DE') : '—'; }
