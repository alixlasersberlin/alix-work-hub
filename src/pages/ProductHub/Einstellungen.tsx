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
  const [sourceUrl, setSourceUrl] = useState('');
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
      toast.success(`Import: ${data.created} neu · ${data.updated} aktualisiert · ${data.duplicates} Dubletten vermieden`);
    } catch (e: any) { toast.error(e.message || 'Import fehlgeschlagen'); }
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
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> Import bestehender Geräte (z. B. 31 Geräte aus alix-lasers.de)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Quelle per URL (JSON-Endpoint des bestehenden Product Hub)</Label>
            <div className="flex gap-2">
              <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://alix-lasers.de/api/product-hub/products" />
              <Button disabled={!canWrite || busy || !sourceUrl} onClick={() => runImport({ source_url: sourceUrl, channel: 'de' })}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Importieren'}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Oder JSON einfügen (Array der Produkte)</Label>
            <Textarea rows={6} value={json} onChange={e => setJson(e.target.value)} placeholder='[{"alix_product_id":"…","name":"…","model":"…"}]' />
            <Button size="sm" disabled={!canWrite || busy || !json.trim()} onClick={() => {
              try { runImport({ products: JSON.parse(json), channel: 'de' }); }
              catch { toast.error('Ungültiges JSON'); }
            }}>JSON importieren</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mapping/Dublettenprüfung erfolgt über alix_product_id, source_product_id, SKU, Slug, Modell und normalisierten Produktnamen. Es werden keine Datensätze gelöscht.
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
