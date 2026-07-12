import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitFork, Plus, Trash2, Loader2, AlertTriangle, ShieldOff, Users2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Rule = {
  id: string; name: string; description: string | null;
  role_a_id: string; role_b_id: string;
  severity: 'warn' | 'block'; is_active: boolean;
};
type Role = { id: string; name: string };
type Conflict = { rule_id: string; rule_name: string; severity: string; user_id: string; role_a_name: string; role_b_name: string };

export default function SoD() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', role_a_id: '', role_b_id: '', severity: 'block' as 'warn' | 'block',
  });

  async function load() {
    setLoading(true);
    const [rs, ro, us, cf] = await Promise.all([
      (supabase as any).from('role_sod_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('roles').select('id, name').order('name'),
      supabase.from('user_profiles').select('id, full_name, email').eq('is_active', true),
      (supabase as any).rpc('sod_conflict_report'),
    ]);
    setRules((rs.data ?? []) as Rule[]);
    setRoles(ro.data ?? []);
    setUsers(us.data ?? []);
    setConflicts((cf.data ?? []) as Conflict[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addRule() {
    if (!form.name.trim() || !form.role_a_id || !form.role_b_id) {
      toast.error('Name und beide Rollen erforderlich'); return;
    }
    if (form.role_a_id === form.role_b_id) { toast.error('Zwei verschiedene Rollen wählen'); return; }
    const { error } = await (supabase as any).from('role_sod_rules').insert({
      name: form.name.trim(), description: form.description.trim() || null,
      role_a_id: form.role_a_id, role_b_id: form.role_b_id, severity: form.severity,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('SoD-Regel angelegt');
    setOpen(false);
    setForm({ name: '', description: '', role_a_id: '', role_b_id: '', severity: 'block' });
    load();
  }

  async function toggle(r: Rule) {
    const { error } = await (supabase as any).from('role_sod_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    load();
  }
  async function del(r: Rule) {
    if (!confirm(`Regel "${r.name}" löschen?`)) return;
    const { error } = await (supabase as any).from('role_sod_rules').delete().eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const nameFor = (id: string) => roles.find(r => r.id === id)?.name ?? '—';
  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade SoD…</div>;
  }

  const blockConflicts = conflicts.filter(c => c.severity === 'block');
  const warnConflicts = conflicts.filter(c => c.severity === 'warn');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <GitFork className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Segregation of Duties</h2>
          <p className="text-xs text-muted-foreground">
            Unvereinbare Rollenkombinationen definieren. Regeln mit „Blockieren" verhindern die Zuweisung automatisch (Super Admin kann übersteuern). Bestehende Konflikte werden im Report gelistet.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> SoD-Regel</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Unvereinbare Rollen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="z. B. Kein Anlegen + Freigeben" /></div>
              <div><Label>Beschreibung</Label>
                <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Rolle A</Label>
                  <Select value={form.role_a_id} onValueChange={v => setForm(f => ({ ...f, role_a_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label>Rolle B</Label>
                  <Select value={form.role_b_id} onValueChange={v => setForm(f => ({ ...f, role_b_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              </div>
              <div><Label>Schweregrad</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warn">Hinweis (nur Report)</SelectItem>
                    <SelectItem value="block">Blockieren (harte Regel)</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={addRule}>Regel speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 bg-card/60">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Aktive Regeln</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{rules.filter(r => r.is_active).length}</div>
        </Card>
        <Card className={`p-4 border ${blockConflicts.length ? 'border-red-500/30 bg-red-500/5' : 'bg-card/60'}`}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Blockierende Konflikte</div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${blockConflicts.length ? 'text-red-500' : ''}`}>{blockConflicts.length}</div>
        </Card>
        <Card className={`p-4 border ${warnConflicts.length ? 'border-amber-500/30 bg-amber-500/5' : 'bg-card/60'}`}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Hinweise</div>
          <div className={`text-2xl font-bold mt-1 tabular-nums ${warnConflicts.length ? 'text-amber-500' : ''}`}>{warnConflicts.length}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">SoD-Regeln</div>
        {rules.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Keine Regeln definiert.</div>
        ) : (
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className={`p-3 rounded-md border flex items-center gap-3 ${r.is_active ? 'border-border' : 'opacity-60 border-border/50'}`}>
                <Badge variant="outline" className={
                  r.severity === 'block' ? 'border-red-500/40 text-red-500' : 'border-amber-500/40 text-amber-500'
                }>{r.severity === 'block' ? 'Blockieren' : 'Hinweis'}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {nameFor(r.role_a_id)} <span className="opacity-60">×</span> {nameFor(r.role_b_id)}
                    {r.description ? ` · ${r.description}` : ''}
                  </div>
                </div>
                <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                <Button size="sm" variant="ghost" onClick={() => del(r)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div className="text-sm font-semibold">Aktuelle Konflikte</div>
          <Badge variant="outline" className="ml-auto">{conflicts.length}</Badge>
        </div>
        {conflicts.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Keine aktiven Rollen-Konflikte.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2">Benutzer</th><th className="text-left">Regel</th><th className="text-left">Rollen</th><th className="text-left">Schweregrad</th></tr>
              </thead>
              <tbody>
                {conflicts.map((c, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-2 flex items-center gap-2"><Users2 className="w-3.5 h-3.5 text-muted-foreground" /> {userName(c.user_id)}</td>
                    <td>{c.rule_name}</td>
                    <td className="text-xs text-muted-foreground">{c.role_a_name} <span className="opacity-60">×</span> {c.role_b_name}</td>
                    <td>
                      <Badge variant="outline" className={
                        c.severity === 'block' ? 'border-red-500/40 text-red-500' : 'border-amber-500/40 text-amber-500'
                      }>
                        {c.severity === 'block' ? <><ShieldOff className="w-3 h-3 mr-1" /> Block</> : 'Hinweis'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
