import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PH_ROLES } from '@/lib/producthub/config';
import { phSaveSetting } from '@/lib/producthub/api';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

export default function ProductHubEinstellungen() {
  const { roles } = useAuth();
  const isSuper = (roles || []).includes('Super Admin');
  const canWrite = isSuper || (roles || []).includes('Admin');
  const [phase, setPhase] = useState<any>({ phase: 'A', com_de_sync_active: true, alixwork_master: false });
  const [json, setJson] = useState('');
  const [sourceUrl, setSourceUrl] = useState('https://alix-lasers.de/api/public/product-hub/export');
  const [checks, setChecks] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const [busy, setBusy] = useState(false);
  const [phRoles, setPhRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState('');
  const [newRole, setNewRole] = useState(PH_ROLES[0]);

  const load = async () => {
    const [s, r, u] = await Promise.all([
      db.from('ph_settings').select('*').eq('key', 'migration_phase').maybeSingle(),
      db.from('ph_roles').select('*'),
      db.from('user_profiles').select('id, email, full_name').limit(500),
    ]);
    if (s.data?.value) setPhase(s.data.value);
    setPhRoles(r.data || []);
    setUsers(u.data || []);
  };
  useEffect(() => { load(); }, []);

  const savePhase = async (p: string) => {
    const next = { phase: p, com_de_sync_active: p !== 'C', alixwork_master: p === 'C' };
    await phSaveSetting('migration_phase', next);
    setPhase(next);
    toast.success(`Migrationsphase ${p} gesetzt`);
  };

  const runImport = async (payload: any) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('product-hub-import', { body: payload });
      if (error) throw error;
      if (data?.result) setResult(data.result);
      toast.success(`Import abgeschlossen: ${data?.result?.created ?? 0} neu · ${data?.result?.merged ?? 0} zusammengeführt`);
    } catch (e: any) { toast.error(e.message || 'Import fehlgeschlagen'); }
    setBusy(false);
  };

  const run = async (mode: 'test' | 'preview' | 'import') => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('product-hub-import', {
        body: { mode, channel: 'de', endpoint: sourceUrl, user_id: user?.id ?? null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setChecks({ ok: data.ok, checks: data.checks });
      if (mode === 'preview') { setPreview(data.preview); setResult(null); }
      if (mode === 'import') {
        setResult(data.result);
        toast.success(`Import: ${data.result.created} neu · ${data.result.merged} zusammengeführt · ${data.result.conflicts} Konflikte`);
      }
      if (mode === 'test') toast[data.ok ? 'success' : 'error'](data.ok ? 'Verbindung und Schema geprüft' : 'Abweichung – kein Import');
    } catch (e: any) { toast.error(e.message || 'Fehlgeschlagen'); }
    setBusy(false);

  };

  const addRole = async () => {
    if (!newUser) return;
    const { error } = await db.from('ph_roles').insert({ user_id: newUser, ph_role: newRole });
    if (error) return toast.error(error.message);
    toast.success('Rolle ergänzt'); setNewUser(''); load();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Product Hub · Einstellungen" subtitle="Migration, Import und Product-Hub-Rollen" icon={Settings} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Migrationsstatus</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[['A', 'COM → DE aktiv'], ['B', 'AlixWork parallel'], ['C', 'AlixWork → COM + DE']].map(([p, l]) => (
              <Button key={p} size="sm" variant={phase.phase === p ? 'default' : 'outline'} disabled={!isSuper}
                onClick={() => savePhase(p)}>Phase {p} · {l}</Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Aktuell: Phase <b>{phase.phase}</b> · COM→DE Sync {phase.com_de_sync_active ? 'aktiv (nicht abgeschaltet)' : 'deaktiviert'} ·
            AlixWork Master: {phase.alixwork_master ? 'ja' : 'nein'}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Quelle: ALIX Lasers DE – Product Hub</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Endpoint (GET, nur serverseitig genutzt)</Label>
              <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://alix-lasers.de/api/public/product-hub/export" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Authentifizierung</Label>
              <div className="h-10 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">x-api-key</Badge>
                <Badge variant="outline">Secret: DE_EXPORT_API_KEY</Badge>
                <span>Wert wird nie im Frontend geladen oder angezeigt.</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!canWrite || busy}
              onClick={() => run('test')}>Verbindung testen</Button>
            <Button size="sm" variant="outline" disabled={!canWrite || busy || !checks?.ok}
              onClick={() => run('preview')}>Import-Vorschau</Button>
            <Button size="sm" disabled={!canWrite || busy || !preview}
              onClick={() => run('import')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import starten'}
            </Button>
            <Button size="sm" variant="ghost" disabled={!canWrite || busy}
              onClick={() => phSaveSetting('de_source', { name: 'ALIX Lasers DE – Product Hub', endpoint: sourceUrl, auth_header: 'x-api-key', secret_name: 'DE_EXPORT_API_KEY', channel: 'de' }).then(() => toast.success('Quelle gespeichert'))}>
              Quelle speichern
            </Button>
          </div>

          {checks && (
            <div className="rounded-md border p-3 text-xs space-y-1">
              <div className="font-medium mb-1">Verbindungstest {checks.ok ? '✓ erfolgreich' : '✗ Abweichung – kein Import'}</div>
              {Object.entries(checks.checks || {}).map(([k, v]: any) => (
                <div key={k} className={v.ok ? 'text-emerald-500' : 'text-destructive'}>
                  {k}: erwartet {String(v.expected)} · erhalten {String(v.actual ?? '—')}
                </div>
              ))}
            </div>
          )}

          {preview && (
            <div className="rounded-md border p-3 text-xs grid gap-1 sm:grid-cols-2 md:grid-cols-3">
              {Object.entries(preview).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><b>{String(v)}</b></div>
              ))}
            </div>
          )}

          {result && (
            <div className="rounded-md border border-emerald-600/40 bg-emerald-500/5 p-3 text-xs space-y-1">
              <div className="font-medium">ALIX PRODUCT HUB – INITIAL MIGRATION</div>
              {Object.entries(result).filter(([k]) => k !== 'error_list').map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><b>{String(v)}</b></div>
              ))}
            </div>
          )}

          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-xs">Alternativ: JSON einfügen (Array der Produkte)</Label>
            <Textarea rows={4} value={json} onChange={e => setJson(e.target.value)} placeholder='[{"alix_product_id":"…","product_name":"…","model":"…"}]' />
            <Button size="sm" variant="outline" disabled={!canWrite || busy || !json.trim()} onClick={() => {
              try { runImport({ mode: 'import', products: JSON.parse(json), channel: 'de', force: true }); }
              catch { toast.error('Ungültiges JSON'); }
            }}>JSON importieren</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mapping/Dublettenprüfung: alix_product_id → source_product_id → SKU → Slug → Modell → normalisierter Produktname.
            Unsichere Treffer werden nicht zusammengeführt, sondern als Konflikt erfasst. Es wird nie gelöscht, technische Werte werden nicht normalisiert.
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Product-Hub-Rollen (zusätzlich zu bestehenden AlixWork-Rollen)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {canWrite && (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Benutzer</Label>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[260px]"
                  value={newUser} onChange={e => setNewUser(e.target.value)}>
                  <option value="">— wählen —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rolle</Label>
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newRole} onChange={e => setNewRole(e.target.value as any)}>
                  {PH_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Button size="sm" onClick={addRole}>Hinzufügen</Button>
            </div>
          )}
          <Table>
            <TableHeader><TableRow><TableHead>Benutzer</TableHead><TableHead>Product-Hub-Rolle</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {phRoles.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Noch keine Zuweisungen – Admin/Super Admin haben ohnehin vollen Zugriff.</TableCell></TableRow>}
              {phRoles.map(r => {
                const u = users.find(x => x.id === r.user_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{u?.full_name || u?.email || r.user_id}</TableCell>
                    <TableCell><Badge variant="outline">{r.ph_role}</Badge></TableCell>
                    <TableCell className="text-right">
                      {isSuper && <Button size="sm" variant="ghost" onClick={async () => {
                        await db.from('ph_roles').delete().eq('id', r.id); load();
                      }}>Entfernen</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
