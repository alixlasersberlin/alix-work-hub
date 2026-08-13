import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Smartphone, Users, RefreshCw, AlertTriangle, Contact } from 'lucide-react';
import { DeviceList } from '@/components/mobile-sync/DeviceList';
import { SCOPE_LABELS, SyncScope, setUserScope } from '@/lib/mobile-sync';

type Profile = { id: string; email: string | null; full_name: string | null; is_active: boolean };
type Setting = { user_id: string; enabled: boolean; scope: SyncScope; scope_value: string | null };

export default function MobileSyncAdmin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [devices, setDevices] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = async () => {
    const [{ data: p }, { data: s }, { data: d }, { data: l }] = await Promise.all([
      supabase.from('user_profiles').select('id, email, full_name, is_active').order('email'),
      supabase.from('mobile_sync_settings').select('user_id, enabled, scope, scope_value'),
      supabase.from('mobile_sync_devices').select('id, user_id, status, last_sync_at, contact_count'),
      supabase.from('mobile_sync_log').select('id, user_id, action, status, contact_count, message, created_at').order('created_at', { ascending: false }).limit(50),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setSettings(Object.fromEntries(((s ?? []) as Setting[]).map((x) => [x.user_id, x])));
    setDevices(d ?? []);
    setLogs(l ?? []);
  };
  useEffect(() => { load(); }, [refreshKey]);

  const kpis = useMemo(() => {
    const active = devices.filter((d) => d.status === 'active');
    return {
      users: new Set(active.map((d) => d.user_id)).size,
      devices: active.length,
      contacts: active.reduce((a, d) => a + (d.contact_count ?? 0), 0),
      lastSync: active.map((d) => d.last_sync_at).filter(Boolean).sort().pop(),
      errors: logs.filter((l) => l.status !== 'ok').length,
      disabled: devices.filter((d) => d.status !== 'active').length,
    };
  }, [devices, logs]);

  const filtered = profiles.filter((p) =>
    !q || `${p.email ?? ''} ${p.full_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  const changeScope = async (userId: string, scope: SyncScope) => {
    try {
      await setUserScope(userId, scope);
      toast.success('Freigabe gespeichert');
      setRefreshKey((k) => k + 1);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Mobile Sync</h1>
          <p className="text-[13px] text-muted-foreground">AlixWork → iPhone Kontaktsynchronisation (CardDAV)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Verbundene Mitarbeiter" value={kpis.users} icon={Users} />
        <Kpi label="Verbundene Geräte" value={kpis.devices} icon={Smartphone} />
        <Kpi label="Synchronisierte Kontakte" value={kpis.contacts} icon={Contact} />
        <Kpi label="Letzte Synchronisierung" value={kpis.lastSync ? new Date(kpis.lastSync).toLocaleString('de-DE') : '—'} />
        <Kpi label="Fehler (letzte 50)" value={kpis.errors} icon={AlertTriangle} />
        <Kpi label="Deaktivierte Zugänge" value={kpis.disabled} />
      </div>

      <Tabs defaultValue="freigaben">
        <TabsList>
          <TabsTrigger value="freigaben">Mobile Kontakte (Freigaben)</TabsTrigger>
          <TabsTrigger value="geraete">Geräte</TabsTrigger>
          <TabsTrigger value="logs">Protokoll</TabsTrigger>
        </TabsList>

        <TabsContent value="freigaben" className="space-y-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-[14px]">Benutzer-Freigaben</CardTitle>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Benutzer suchen…" className="max-w-xs" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[260px]">Freigabe</TableHead>
                    <TableHead>Geräte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const s = settings[p.id];
                    const userDevices = devices.filter((d) => d.user_id === p.id && d.status === 'active').length;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.full_name || p.email}</div>
                          <div className="text-[11px] text-muted-foreground">{p.email}</div>
                        </TableCell>
                        <TableCell>
                          {s?.enabled ? <Badge>Aktiv</Badge> : <Badge variant="outline">Inaktiv</Badge>}
                        </TableCell>
                        <TableCell>
                          <Select value={s?.scope ?? 'none'} onValueChange={(v) => changeScope(p.id, v as SyncScope)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(SCOPE_LABELS).map(([k, label]) => (
                                <SelectItem key={k} value={k}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{userDevices}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geraete">
          <DeviceList refreshKey={refreshKey} showUser />
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle className="text-[14px]">Letzte Synchronisationen</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-[12px]">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between border-b border-border/50 py-1">
                  <span>{new Date(l.created_at).toLocaleString('de-DE')} · {l.action}</span>
                  <span className={l.status === 'ok' ? 'text-muted-foreground' : 'text-destructive'}>
                    {l.contact_count ?? '—'} Kontakte · {l.status}{l.message ? ` · ${l.message}` : ''}
                  </span>
                </div>
              ))}
              {logs.length === 0 && <div className="text-muted-foreground">Noch keine Einträge.</div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          {Icon && <Icon className="w-3 h-3" />} {label}
        </div>
        <div className="text-lg font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
