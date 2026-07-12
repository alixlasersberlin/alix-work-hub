import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, KeyRound, LinkIcon, ShieldCheck, Copy } from 'lucide-react';
import { toast } from 'sonner';

type Provider = { id: string; name: string; provider_type: string; issuer_url: string | null; metadata_url: string | null; client_id: string | null; default_role_id: string | null; is_active: boolean; jit_provisioning: boolean };
type Mapping = { id: string; provider_id: string; external_group: string; role_id: string; is_active: boolean };
type ScimToken = { id: string; provider_id: string; name: string; last_used_at: string | null; expires_at: string | null; created_at: string };

export default function SSO() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selProv, setSelProv] = useState<string>('');
  const [openProv, setOpenProv] = useState(false);
  const [openMap, setOpenMap] = useState(false);
  const [openTok, setOpenTok] = useState(false);
  const [pForm, setPForm] = useState({ name: '', provider_type: 'oidc', issuer_url: '', metadata_url: '', client_id: '', default_role_id: '', is_active: true, jit_provisioning: true });
  const [mForm, setMForm] = useState({ external_group: '', role_id: '' });
  const [tForm, setTForm] = useState({ name: '' });
  const [newToken, setNewToken] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, m, t, r] = await Promise.all([
      (supabase as any).from('sso_providers').select('*').order('name'),
      (supabase as any).from('sso_group_mappings').select('*'),
      (supabase as any).from('scim_tokens').select('*').order('created_at', { ascending: false }),
      supabase.from('roles').select('id, name').order('name'),
    ]);
    setProviders(p.data ?? []); setMappings(m.data ?? []); setTokens(t.data ?? []); setRoles(r.data ?? []);
    if (!selProv && p.data?.[0]) setSelProv(p.data[0].id);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const roleName = (id: string | null) => roles.find(r => r.id === id)?.name ?? '—';

  const saveProvider = async () => {
    if (!pForm.name.trim()) { toast.error('Name Pflicht'); return; }
    const { error } = await (supabase as any).from('sso_providers').insert({
      ...pForm, default_role_id: pForm.default_role_id || null,
      issuer_url: pForm.issuer_url || null, metadata_url: pForm.metadata_url || null, client_id: pForm.client_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Provider gespeichert');
    setOpenProv(false); setPForm({ name: '', provider_type: 'oidc', issuer_url: '', metadata_url: '', client_id: '', default_role_id: '', is_active: true, jit_provisioning: true });
    load();
  };

  const toggleProvider = async (p: Provider) => {
    await (supabase as any).from('sso_providers').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  };

  const deleteProvider = async (id: string) => {
    if (!confirm('Provider und alle Mappings/Tokens löschen?')) return;
    await (supabase as any).from('sso_providers').delete().eq('id', id);
    load();
  };

  const addMapping = async () => {
    if (!selProv || !mForm.external_group.trim() || !mForm.role_id) return;
    const { error } = await (supabase as any).from('sso_group_mappings').insert({ provider_id: selProv, external_group: mForm.external_group.trim(), role_id: mForm.role_id });
    if (error) { toast.error(error.message); return; }
    toast.success('Mapping angelegt');
    setOpenMap(false); setMForm({ external_group: '', role_id: '' }); load();
  };
  const deleteMapping = async (id: string) => { await (supabase as any).from('sso_group_mappings').delete().eq('id', id); load(); };

  const createToken = async () => {
    if (!selProv || !tForm.name.trim()) return;
    const raw = 'scim_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const enc = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await (supabase as any).from('scim_tokens').insert({ provider_id: selProv, name: tForm.name.trim(), token_hash: hash });
    if (error) { toast.error(error.message); return; }
    setNewToken(raw); setTForm({ name: '' }); load();
  };
  const deleteToken = async (id: string) => { await (supabase as any).from('scim_tokens').delete().eq('id', id); load(); };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const provMappings = mappings.filter(m => m.provider_id === selProv);
  const provTokens = tokens.filter(t => t.provider_id === selProv);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> SSO / SCIM</h2>
          <p className="text-xs text-muted-foreground">Externe Identity Provider (Azure AD, Google Workspace, Okta) und automatisches Rollen-Mapping.</p>
        </div>
        <Button onClick={() => setOpenProv(true)}><Plus className="w-4 h-4 mr-1" /> Provider hinzufügen</Button>
      </div>

      {providers.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Noch kein IdP konfiguriert.</Card>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {providers.map(p => (
              <button key={p.id} onClick={() => setSelProv(p.id)}
                className={`px-3 py-2 rounded-md text-sm border ${selProv === p.id ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border hover:bg-muted/40'}`}>
                <div className="font-medium">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {p.provider_type.toUpperCase()} · {p.is_active ? 'aktiv' : 'inaktiv'}
                </div>
              </button>
            ))}
          </div>

          {providers.filter(p => p.id === selProv).map(p => (
            <Card key={p.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><LinkIcon className="w-4 h-4" /> {p.name}</h3>
                  <div className="text-xs text-muted-foreground">
                    {p.provider_type.toUpperCase()} · {p.issuer_url ?? p.metadata_url ?? '—'} · JIT: {p.jit_provisioning ? 'ja' : 'nein'} · Default-Rolle: {roleName(p.default_role_id)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggleProvider(p)}>
                    <Switch checked={p.is_active} className="mr-2" /> {p.is_active ? 'Aktiv' : 'Inaktiv'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteProvider(p.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                </div>
              </div>

              {/* Group Mappings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Gruppen-Mappings ({provMappings.length})</h4>
                  <Button size="sm" variant="outline" onClick={() => setOpenMap(true)}><Plus className="w-3 h-3 mr-1" /> Mapping</Button>
                </div>
                <div className="space-y-1">
                  {provMappings.length === 0
                    ? <div className="text-xs text-muted-foreground italic">Keine Mappings — Nutzer erhalten nur die Default-Rolle.</div>
                    : provMappings.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-sm border-b py-1">
                        <span><Badge variant="outline">{m.external_group}</Badge> <span className="text-muted-foreground">→</span> <span className="font-medium">{roleName(m.role_id)}</span></span>
                        <Button size="sm" variant="ghost" onClick={() => deleteMapping(m.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                      </div>
                    ))}
                </div>
              </div>

              {/* SCIM Tokens */}
              {p.provider_type === 'scim' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" /> SCIM Bearer Tokens ({provTokens.length})</h4>
                    <Button size="sm" variant="outline" onClick={() => setOpenTok(true)}><Plus className="w-3 h-3 mr-1" /> Token</Button>
                  </div>
                  <div className="space-y-1">
                    {provTokens.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm border-b py-1">
                        <span className="font-mono text-xs">{t.name} · zuletzt genutzt: {t.last_used_at ? new Date(t.last_used_at).toLocaleString('de-DE') : 'nie'}</span>
                        <Button size="sm" variant="ghost" onClick={() => deleteToken(t.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {/* Provider Dialog */}
      <Dialog open={openProv} onOpenChange={setOpenProv}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Identity Provider</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} placeholder="Azure AD Produktion" /></div>
            <div><Label>Typ</Label>
              <Select value={pForm.provider_type} onValueChange={v => setPForm({ ...pForm, provider_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oidc">OIDC (OpenID Connect)</SelectItem>
                  <SelectItem value="saml">SAML 2.0</SelectItem>
                  <SelectItem value="scim">SCIM (nur Provisioning)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Issuer / Login-URL</Label><Input value={pForm.issuer_url} onChange={e => setPForm({ ...pForm, issuer_url: e.target.value })} /></div>
            <div><Label>Metadata-URL</Label><Input value={pForm.metadata_url} onChange={e => setPForm({ ...pForm, metadata_url: e.target.value })} /></div>
            <div><Label>Client-ID</Label><Input value={pForm.client_id} onChange={e => setPForm({ ...pForm, client_id: e.target.value })} /></div>
            <div><Label>Default-Rolle bei JIT</Label>
              <Select value={pForm.default_role_id} onValueChange={v => setPForm({ ...pForm, default_role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={pForm.jit_provisioning} onCheckedChange={v => setPForm({ ...pForm, jit_provisioning: v })} /><Label>JIT-Provisioning (Nutzer bei erstem Login anlegen)</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpenProv(false)}>Abbrechen</Button><Button onClick={saveProvider}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog open={openMap} onOpenChange={setOpenMap}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gruppen-Mapping</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Externe Gruppe</Label><Input value={mForm.external_group} onChange={e => setMForm({ ...mForm, external_group: e.target.value })} placeholder="Azure/Finance" /></div>
            <div><Label>Rolle</Label>
              <Select value={mForm.role_id} onValueChange={v => setMForm({ ...mForm, role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpenMap(false)}>Abbrechen</Button><Button onClick={addMapping}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Dialog */}
      <Dialog open={openTok || !!newToken} onOpenChange={o => { setOpenTok(o); if (!o) setNewToken(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{newToken ? 'Token erstellt' : 'Neuer SCIM Token'}</DialogTitle></DialogHeader>
          {newToken ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Kopieren Sie den Token jetzt — er wird nicht erneut angezeigt.</p>
              <div className="flex gap-2">
                <Input readOnly value={newToken} className="font-mono text-xs" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(newToken); toast.success('Kopiert'); }}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>Bezeichnung</Label><Input value={tForm.name} onChange={e => setTForm({ ...tForm, name: e.target.value })} placeholder="Azure SCIM" /></div>
            </div>
          )}
          <DialogFooter>
            {newToken
              ? <Button onClick={() => { setNewToken(null); setOpenTok(false); }}>Fertig</Button>
              : (<><Button variant="outline" onClick={() => setOpenTok(false)}>Abbrechen</Button><Button onClick={createToken}>Erstellen</Button></>)}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
