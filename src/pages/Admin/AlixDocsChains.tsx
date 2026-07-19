import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowDown, Save, Workflow, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Step = { role: string; user_id: string | null };
type Chain = { id?: string; name: string; active: boolean; category_id: string | null; steps: Step[] };

const ROLES = ['Vorgesetzter', 'Compliance', 'Finance', 'Geschäftsführung', 'Super Admin', 'QM'];

export default function AlixDocsChainsAdmin() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [editing, setEditing] = useState<Chain | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('alixdocs_approval_chains').select('*').order('name');
    setChains((data ?? []).map((c: any) => ({ ...c, steps: Array.isArray(c.steps) ? c.steps : [] })));
  };
  useEffect(() => {
    load();
    supabase.from('alixdocs_categories').select('id, name').order('sort_order').then(({ data }) => setCats(data ?? []));
    supabase.from('user_profiles').select('id, full_name, email').eq('is_active', true).limit(500)
      .then(({ data }) => setUsers((data ?? []).map((u: any) => ({ id: u.id, label: u.full_name || u.email || u.id.slice(0, 8) }))));
  }, []);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const payload = { name: editing.name, active: editing.active, category_id: editing.category_id, steps: editing.steps as any };
      if (editing.id) {
        const { error } = await supabase.from('alixdocs_approval_chains').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from('alixdocs_approval_chains').insert({ ...payload, created_by: userData.user!.id });
        if (error) throw error;
      }
      toast.success('Kette gespeichert');
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Kette löschen?')) return;
    const { error } = await supabase.from('alixdocs_approval_chains').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  };

  const patchStep = (i: number, p: Partial<Step>) =>
    editing && setEditing({ ...editing, steps: editing.steps.map((s, j) => j === i ? { ...s, ...p } : s) });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Workflow className="w-6 h-6" /> AlixDocs · Freigabeketten</h1>
          <p className="text-sm text-muted-foreground">Kategorie-spezifische Genehmigungsworkflows verwalten.</p>
        </div>
        <Button onClick={() => setEditing({ name: '', active: true, category_id: null, steps: [] })}><Plus className="w-4 h-4 mr-1" /> Neue Kette</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Ketten ({chains.length})</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {chains.map(c => (
            <div key={c.id} className="py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{c.name} {!c.active && <span className="text-xs text-muted-foreground">(inaktiv)</span>}</div>
                <div className="text-xs text-muted-foreground">
                  Kategorie: {cats.find(k => k.id === c.category_id)?.name ?? '— (alle)'} · {c.steps.length} Schritte
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Bearbeiten</Button>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id!)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          ))}
          {chains.length === 0 && <p className="text-sm text-muted-foreground italic py-6 text-center">Noch keine Ketten.</p>}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id ? 'Kette bearbeiten' : 'Neue Kette'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2"><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="flex items-center gap-2 p-3 rounded border">
                <Switch checked={editing.active} onCheckedChange={v => setEditing({ ...editing, active: v })} />
                <span className="text-sm">Aktiv</span>
              </div>
            </div>
            <div>
              <Label>Kategorie (leer = alle)</Label>
              <Select value={editing.category_id ?? '__all__'} onValueChange={v => setEditing({ ...editing, category_id: v === '__all__' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">— alle Kategorien —</SelectItem>
                  {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {editing.steps.map((s, i) => (
                <div key={i}>
                  <div className="grid md:grid-cols-[60px_1fr_1fr_auto] gap-2 items-end p-2 rounded border bg-muted/20">
                    <div className="text-center text-sm font-mono pt-6">{i + 1}</div>
                    <div>
                      <Label className="text-xs">Rolle</Label>
                      <Select value={s.role} onValueChange={v => patchStep(i, { role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Freigeber</Label>
                      <Select value={s.user_id ?? ''} onValueChange={v => patchStep(i, { user_id: v || null })}>
                        <SelectTrigger><SelectValue placeholder="User wählen…" /></SelectTrigger>
                        <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                  {i < editing.steps.length - 1 && <div className="flex justify-center py-1"><ArrowDown className="w-4 h-4 text-muted-foreground" /></div>}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { role: 'Vorgesetzter', user_id: null }] })}>
                <Plus className="w-3 h-3 mr-1" /> Schritt hinzufügen
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={busy || !editing.name}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Speichern</>}</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
