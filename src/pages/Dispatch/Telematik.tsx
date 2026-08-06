import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Satellite, Save, PlugZap, Copy } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const PROJECT_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? '';
const ENDPOINT = `${PROJECT_URL}/functions/v1/telematics-ingest`;

const SAMPLE = `curl -X POST "${ENDPOINT}" \\
  -H "Content-Type: application/json" \\
  -H "x-telematics-secret: <TELEMATICS_INGEST_SECRET>" \\
  -d '{"readings":[
        {"device_id":"TMX-001","odometer_km":128450,"fuel_level_pct":62,"range_km":540},
        {"license_plate":"HH-AL 1234","odometer_km":98120}
      ]}'`;

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('de-DE') : '—');

export default function DispatchTelematik() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { provider: string; device: string }>>({});
  const [checking, setChecking] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'telematics-vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, license_plate, name, telematics_provider, telematics_device_id, odometer_km, fuel_level_pct, range_km, updated_at, active')
        .order('license_plate');
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (v: any) => {
      const e = edits[v.id];
      const { error } = await supabase
        .from('vehicles')
        .update({
          telematics_provider: (e?.provider ?? v.telematics_provider ?? '').trim() || null,
          telematics_device_id: (e?.device ?? v.telematics_device_id ?? '').trim() || null,
        })
        .eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Telematik-Zuordnung gespeichert');
      qc.invalidateQueries({ queryKey: ['dispatch', 'telematics-vehicles'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Fehler beim Speichern'),
  });

  const checkEndpoint = async () => {
    setChecking(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readings: [] }),
      });
      if (res.status === 401) toast.success('Endpoint erreichbar und Secret aktiv (401 ohne Schlüssel = korrekt).');
      else if (res.status === 503) toast.error('Endpoint erreichbar, aber TELEMATICS_INGEST_SECRET fehlt.');
      else toast.message(`Antwort: HTTP ${res.status}`);
    } catch (e: any) {
      toast.error('Endpoint nicht erreichbar: ' + (e?.message ?? ''));
    } finally {
      setChecking(false);
    }
  };

  const rows = data ?? [];
  const linked = rows.filter((v: any) => v.telematics_device_id).length;

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader
        title="Telematik-Anbindung"
        subtitle="Fahrzeuge mit Telematik-Geräten verknüpfen und Live-Kilometerstände empfangen"
        icon={Satellite}
        actions={
          <Button variant="outline" onClick={checkEndpoint} disabled={checking}>
            <PlugZap className="h-4 w-4 mr-2" />{checking ? 'Prüfe…' : 'Verbindung prüfen'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Fahrzeuge gesamt</div>
          <div className="text-2xl font-semibold">{rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Mit Geräte-ID verknüpft</div>
          <div className="text-2xl font-semibold">{linked}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ohne Anbindung</div>
          <div className="text-2xl font-semibold">{rows.length - linked}</div>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Ingest-Endpoint</div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { navigator.clipboard.writeText(ENDPOINT); toast.success('Endpoint kopiert'); }}
          >
            <Copy className="h-4 w-4 mr-2" />Kopieren
          </Button>
        </div>
        <code className="block text-xs bg-muted/40 rounded p-2 break-all">{ENDPOINT}</code>
        <p className="text-xs text-muted-foreground">
          Authentifizierung über den Header <code>x-telematics-secret</code> mit dem hinterlegten Secret
          <code> TELEMATICS_INGEST_SECRET</code>. Zuordnung wahlweise über <code>device_id</code> (empfohlen) oder
          <code> license_plate</code>. Kilometerstände werden nur vorwärts fortgeschrieben, max. 500 Messwerte pro Aufruf.
        </p>
        <pre className="text-xs bg-muted/40 rounded p-3 overflow-x-auto whitespace-pre">{SAMPLE}</pre>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kennzeichen</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Anbieter</TableHead>
              <TableHead>Geräte-ID</TableHead>
              <TableHead className="text-right">km-Stand</TableHead>
              <TableHead className="text-right">Tank/Ladung</TableHead>
              <TableHead className="text-right">Reichweite</TableHead>
              <TableHead>Letztes Update</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Noch keine Fahrzeuge erfasst – zuerst unter „Fahrzeuge“ anlegen.</TableCell></TableRow>}
            {rows.map((v: any) => {
              const e = edits[v.id];
              const provider = e?.provider ?? v.telematics_provider ?? '';
              const device = e?.device ?? v.telematics_device_id ?? '';
              const dirty = provider !== (v.telematics_provider ?? '') || device !== (v.telematics_device_id ?? '');
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    {v.license_plate}
                    {!v.telematics_device_id && <Badge variant="outline" className="ml-2 text-[10px]">offen</Badge>}
                  </TableCell>
                  <TableCell>{v.name ?? '—'}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 w-40"
                      placeholder="Webfleet, Bosch…"
                      value={provider}
                      onChange={ev => setEdits({ ...edits, [v.id]: { provider: ev.target.value, device } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 w-40"
                      placeholder="TMX-001"
                      value={device}
                      onChange={ev => setEdits({ ...edits, [v.id]: { provider, device: ev.target.value } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">{v.odometer_km != null ? `${Number(v.odometer_km).toLocaleString('de-DE')} km` : '—'}</TableCell>
                  <TableCell className="text-right">{v.fuel_level_pct != null ? `${v.fuel_level_pct} %` : '—'}</TableCell>
                  <TableCell className="text-right">{v.range_km != null ? `${v.range_km} km` : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(v.updated_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" disabled={!dirty || save.isPending} onClick={() => save.mutate(v)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
