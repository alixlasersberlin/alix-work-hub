import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Package, Plus, Trash2, UserPlus, UserMinus, Rocket } from 'lucide-react';
import { toast } from 'sonner';

type Template = { id: string; name: string; description: string | null; department_id: string | null; position: string | null };
type Role = { id: string; name: string };
type Item = { id: string; template_id: string; role_id: string };

export default function TemplatesOnboarding() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [tplOpen, setTplOpen] = useState(false);
  const [tplForm, setTplForm] = useState({ name: '', description: '', department_id: '', position: '', roleIds: new Set<string>() });

  const [onbOpen, setOnbOpen] = useState(false);
  const [onbForm, setOnbForm] = useState({ user_id: '', template_id: '' });

  const [offOpen, setOffOpen] = useState(false);
  const [offForm, setOffForm] = useState({ user_id: '', reason: '' });

  const load = async () => {
    setLoading(true);
    const [t, i, r, d, u] = await Promise.all([
      (supabase as any).from('role_templates').select('*').order('name'),
      (supabase as any).from('role_template_items').select('*'),
      supabase.from('roles').select('id, name').order('name'),
      supabase.from('departments').select('id, name'),
      supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name'),
    ]);
    setTemplates(t.data ?? []); setItems(i.data ?? []); setRoles(r.data ?? []);
    setDepartments(d.data ?? []); setUsers(u.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const rolesFor = (tid: string) => items.filter(x => x.template_id === tid)
    .map(x => roles.find(r => r.id === x.role_id)?.name).filter(Boolean) as string[];

  const saveTemplate = async () => {
    if (!tplForm.name.trim() || tplForm.roleIds.size === 0) { toast.error('Name und mindestens eine Rolle'); return; }
    setBusy('tpl');
    const { data, error } = await (supabase as any).from('role_templates').insert({
      name: tplForm.name.trim(),
      description: tplForm.description.trim() || null,
      department_id: tplForm.department_id || null,
      position: tplForm.position.trim() || null,
    }).select().single();
    if (error) { setBusy(null); toast.error(error.message); return; }
    const rows = Array.from(tplForm.roleIds).map(role_id => ({ template_id: data.id, role_id }));
    const { error: e2 } = await (supabase as any).from('role_template_items').insert(rows);
    setBusy(null);
    if (e2) { toast.error(e2.message); return; }
    toast.success('Vorlage angelegt');
    setTplOpen(false);
    setTplForm({ name: '', description: '', department_id: '', position: '', roleIds: new Set() });
    load();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Vorlage wirklich löschen?')) return;
    const { error } = await (supabase as any).from('role_templates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Vorlage gelöscht'); load();
  };

  const onboard = async () => {
    if (!onbForm.user_id || !onbForm.template_id) { toast.error('Benutzer und Vorlage wählen'); return; }
    setBusy('onb');
    const { data, error } = await (supabase as any).rpc('apply_role_template', {
      _user_id: onbForm.user_id, _template_id: onbForm.template_id,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Onboarding: ${data?.roles_added ?? 0} Rollen vergeben`);
    setOnbOpen(false); setOnbForm({ user_id: '', template_id: '' });
  };

  const offboard = async () => {
    if (!offForm.user_id || !offForm.reason.trim()) { toast.error('Benutzer und Grund erforderlich'); return; }
    if (!confirm('Diesen Benutzer wirklich offboarden? Alle Rollen (außer Super Admin) werden entzogen und der Account inaktiv gesetzt.')) return;
    setBusy('off');
    const { data, error } = await (supabase as any).rpc('offboard_user', {
      _user_id: offForm.user_id, _reason: offForm.reason.trim(),
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Offboarding: ${data?.roles_removed ?? 0} Rollen entzogen, ${data?.temp_grants_revoked ?? 0} Zeit-Grants beendet`);
    setOffOpen(false); setOffForm({ user_id: '', reason: '' });
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5" /> Rollen-Vorlagen & Onboarding</h2>
          <p className="text-xs text-muted-foreground">Standard-Rollenpakete pro Abteilung/Position, schnelles On- und Offboarding.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setOffOpen(true)}><UserMinus className="w-3 h-3 mr-1" /> Offboarding</Button>
          <Button variant="outline" onClick={() => setOnbOpen(true)}><Rocket className="w-3 h-3 mr-1" /> Onboarding</Button>
          <Button onClick={() => setTplOpen(true)}><Plus className="w-3 h-3 mr-1" /> Neue Vorlage</Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Noch keine Vorlagen angelegt.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(t => {
            const roleNames = rolesFor(t.id);
            const dept = departments.find(d => d.id === t.department_id)?.name;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[dept, t.position].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {t.description && <div className="text-xs mt-2 text-muted-foreground">{t.description}</div>}
                <div className="flex flex-wrap gap-1 mt-3">
                  {roleNames.map(n => <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>)}
                  {roleNames.length === 0 && <span className="text-[10px] text-muted-foreground">Keine Rollen</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Template Dialog */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neue Rollen-Vorlage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={tplForm.name} onChange={e => setTplForm({ ...tplForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Abteilung</Label>
                <Select value={tplForm.department_id} onValueChange={v => setTplForm({ ...tplForm, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Position</Label><Input value={tplForm.position} onChange={e => setTplForm({ ...tplForm, position: e.target.value })} placeholder="z.B. Sachbearbeiter" /></div>
            </div>
            <div><Label>Beschreibung</Label><Textarea rows={2} value={tplForm.description} onChange={e => setTplForm({ ...tplForm, description: e.target.value })} /></div>
            <div>
              <Label>Rollen (mindestens 1)</Label>
              <div className="border rounded-md p-2 max-h-56 overflow-auto space-y-1">
                {roles.map(r => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={tplForm.roleIds.has(r.id)}
                      onCheckedChange={() => {
                        const n = new Set(tplForm.roleIds);
                        n.has(r.id) ? n.delete(r.id) : n.add(r.id);
                        setTplForm({ ...tplForm, roleIds: n });
                      }}
                    /> {r.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplOpen(false)}>Abbrechen</Button>
            <Button onClick={saveTemplate} disabled={busy === 'tpl'}>{busy === 'tpl' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onboarding Dialog */}
      <Dialog open={onbOpen} onOpenChange={setOnbOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle><UserPlus className="w-4 h-4 inline mr-1" /> Onboarding: Vorlage anwenden</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Benutzer</Label>
              <Select value={onbForm.user_id} onValueChange={v => setOnbForm({ ...onbForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Benutzer…" /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vorlage</Label>
              <Select value={onbForm.template_id} onValueChange={v => setOnbForm({ ...onbForm, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vorlage…" /></SelectTrigger>
                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOnbOpen(false)}>Abbrechen</Button>
            <Button onClick={onboard} disabled={busy === 'onb'}>{busy === 'onb' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Anwenden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offboarding Dialog */}
      <Dialog open={offOpen} onOpenChange={setOffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle><UserMinus className="w-4 h-4 inline mr-1" /> Offboarding: Benutzer deaktivieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Benutzer</Label>
              <Select value={offForm.user_id} onValueChange={v => setOffForm({ ...offForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Benutzer…" /></SelectTrigger>
                <SelectContent>{users.filter(u => u.is_active).map(u => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Grund</Label><Textarea rows={3} value={offForm.reason} onChange={e => setOffForm({ ...offForm, reason: e.target.value })} placeholder="z.B. Austritt zum 31.12." /></div>
            <Card className="p-3 bg-red-500/5 border-red-500/30 text-xs">
              Alle Rollen (außer <b>Super Admin</b>) werden sofort entzogen, alle aktiven Zeit-Grants beendet und der Benutzer inaktiv gesetzt. Vorgang wird im Audit-Log protokolliert.
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOffOpen(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={offboard} disabled={busy === 'off'}>{busy === 'off' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Offboarden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
