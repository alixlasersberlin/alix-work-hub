import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

type Row = {
  id: string; identity_id: string; organization_id: string | null; application_id: string;
  app_role: string; access_status: string; granted_at: string; valid_until: string | null;
  revoked_at: string | null; revoke_reason: string | null;
};
type App = { id: string; app_key: string; app_name: string };
type Ident = { id: string; display_name: string | null; primary_email: string };
type Org = { id: string; legal_name: string; display_name: string | null };

export default function IdAdminAccess() {
  const [rows, setRows] = useState<Row[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [idents, setIdents] = useState<Ident[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterApp, setFilterApp] = useState<string>('all');
  const [form, setForm] = useState({ identity_id: '', organization_id: '', application_id: '', app_role: 'user' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: b }, { data: c }, { data: d }] = await Promise.all([
      supabase.from('alix_identity_app_access')
        .select('id, identity_id, organization_id, application_id, app_role, access_status, granted_at, valid_until, revoked_at, revoke_reason')
        .order('granted_at', { ascending: false }).limit(500),
      supabase.from('alix_applications').select('id, app_key, app_name').order('sort_order'),
      supabase.from('alix_identities').select('id, display_name, primary_email').order('created_at', { ascending: false }).limit(500),
      supabase.from('alix_organizations').select('id, legal_name, display_name').order('legal_name').limit(500),
    ]);
    setRows((a ?? []) as Row[]);
    setApps((b ?? []) as App[]);
    setIdents((c ?? []) as Ident[]);
    setOrgs((d ?? []) as Org[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => filterApp === 'all' || r.application_id === filterApp), [rows, filterApp]);
  const appName = (id: string) => apps.find(a => a.id === id)?.app_name ?? id.slice(0, 8);
  const identName = (id: string) => { const i = idents.find(x => x.id === id); return i ? (i.display_name ?? i.primary_email) : id.slice(0, 8); };
  const orgName = (id: string | null) => id ? (() => { const o = orgs.find(x => x.id === id); return o ? (o.display_name ?? o.legal_name) : id.slice(0, 8); })() : '—';

  const grant = async () => {
    if (!form.identity_id || !form.application_id) { toast.error('Identität und Applikation wählen.'); return; }
    setBusy(true);
    const { error } = await supabase.functions.invoke('alix-id-admin', {
      body: { action: 'grant_access', ...form, organization_id: form.organization_id || null, permissions: [] },
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success('Zugriff gewährt.'); setForm({ identity_id: '', organization_id: '', application_id: '', app_role: 'user' }); load(); }
  };

  const revoke = async (id: string) => {
    if (!confirm('Zugriff wirklich entziehen?')) return;
    const { error } = await supabase.functions.invoke('alix-id-admin', {
      body: { action: 'revoke_access', access_id: id, reason: 'admin_ui' },
    });
    if (error) toast.error(error.message); else { toast.success('Zugriff entzogen.'); load(); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Neuen Zugriff gewähren</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2"><Label>Identität</Label>
            <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form.identity_id} onChange={(e) => setForm(f => ({ ...f, identity_id: e.target.value }))}>
              <option value="">— wählen —</option>
              {idents.map(i => <option key={i.id} value={i.id}>{i.display_name ?? i.id.slice(0, 8)}</option>)}
            </select>
          </div>
          <div><Label>Organisation</Label>
            <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form.organization_id} onChange={(e) => setForm(f => ({ ...f, organization_id: e.target.value }))}>
              <option value="">(keine)</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div><Label>Applikation</Label>
            <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" value={form.application_id} onChange={(e) => setForm(f => ({ ...f, application_id: e.target.value }))}>
              <option value="">— wählen —</option>
              {apps.map(a => <option key={a.id} value={a.id}>{a.app_name}</option>)}
            </select>
          </div>
          <div><Label>Rolle</Label>
            <Input value={form.app_role} onChange={(e) => setForm(f => ({ ...f, app_role: e.target.value }))} />
          </div>
          <div className="md:col-span-5">
            <Button size="sm" onClick={grant} disabled={busy}>{busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}Zugriff gewähren</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>App-Zugriffe</CardTitle>
          <select className="h-9 px-3 rounded-md border border-input bg-background text-sm" value={filterApp} onChange={(e) => setFilterApp(e.target.value)}>
            <option value="all">Alle Apps</option>
            {apps.map(a => <option key={a.id} value={a.id}>{a.app_name}</option>)}
          </select>
        </CardHeader>
        <CardContent>
          {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr><th className="py-2 pr-4">Identität</th><th className="py-2 pr-4">Organisation</th><th className="py-2 pr-4">App</th><th className="py-2 pr-4">Rolle</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Gültig bis</th><th className="py-2" /></tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-2 pr-4">{identName(r.identity_id)}</td>
                      <td className="py-2 pr-4">{orgName(r.organization_id)}</td>
                      <td className="py-2 pr-4">{appName(r.application_id)}</td>
                      <td className="py-2 pr-4">{r.app_role}</td>
                      <td className="py-2 pr-4"><Badge variant={r.access_status === 'active' ? 'default' : 'secondary'}>{r.access_status}</Badge></td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.valid_until ? new Date(r.valid_until).toLocaleDateString() : '—'}</td>
                      <td className="py-2 text-right">
                        {r.access_status === 'active' && (
                          <Button size="sm" variant="outline" onClick={() => revoke(r.id)}><X className="w-3 h-3 mr-1" /> Entziehen</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Zugriffe.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
