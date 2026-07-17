import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ArrowDown, Save, Workflow } from 'lucide-react';
import { toast } from 'sonner';

type Step = { order: number; role: string; user_id: string | null };
type Chain = { id?: string; name: string; active: boolean; steps: Step[] };

const APPROVER_ROLES = ['Vorgesetzter', 'Compliance', 'Finance', 'Geschäftsführung', 'Super Admin', 'Custom'];

export default function ApprovalChainEditor({ templateId }: { templateId: string | null }) {
  const [chain, setChain] = useState<Chain>({ name: 'Standard-Freigabekette', active: true, steps: [] });
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    (async () => {
      const { data } = await supabase.from('sig_approval_chains').select('*').eq('template_id', templateId).maybeSingle();
      if (data) {
        setChain({
          id: data.id, name: data.name || 'Standard-Freigabekette', active: !!data.active,
          steps: Array.isArray(data.steps) ? (data.steps as unknown as Step[]) : [],
        });
      }
      const { data: up } = await supabase.from('user_profiles').select('user_id, display_name, email').limit(200);
      setUsers((up ?? []).map((u: any) => ({ id: u.user_id, label: u.display_name || u.email || u.user_id.slice(0, 8) })));
    })();
  }, [templateId]);

  if (!templateId) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground italic">Vorlage zuerst speichern, dann kann eine Genehmigungskette angelegt werden.</CardContent></Card>
    );
  }

  const addStep = () => setChain(c => ({ ...c, steps: [...c.steps, { order: c.steps.length, role: 'Vorgesetzter', user_id: null }] }));
  const updateStep = (i: number, patch: Partial<Step>) => setChain(c => ({ ...c, steps: c.steps.map((s, j) => j === i ? { ...s, ...patch } : s) }));
  const removeStep = (i: number) => setChain(c => ({ ...c, steps: c.steps.filter((_, j) => j !== i).map((s, k) => ({ ...s, order: k })) }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { template_id: templateId, name: chain.name, active: chain.active, steps: chain.steps };
      if (chain.id) {
        const { error } = await supabase.from('sig_approval_chains').update(payload).eq('id', chain.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { data, error } = await supabase.from('sig_approval_chains').insert({ ...payload, created_by: userData.user!.id }).select('id').single();
        if (error) throw error;
        setChain(c => ({ ...c, id: data.id }));
      }
      toast.success('Genehmigungskette gespeichert');
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Workflow className="w-4 h-4" /> Genehmigungskette</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2"><Label>Name</Label><Input value={chain.name} onChange={e => setChain({ ...chain, name: e.target.value })} /></div>
          <div className="flex items-center gap-2 p-3 rounded-lg border">
            <Switch checked={chain.active} onCheckedChange={v => setChain({ ...chain, active: v })} />
            <span className="text-sm">Aktiv</span>
          </div>
        </div>

        <div className="space-y-2">
          {chain.steps.length === 0 && <p className="text-xs text-muted-foreground italic">Noch keine Schritte – ohne Kette werden Requests direkt versendet.</p>}
          {chain.steps.map((s, i) => (
            <div key={i}>
              <div className="grid md:grid-cols-[80px_1fr_1fr_auto] gap-2 items-end p-2 rounded border bg-muted/20">
                <div><Label className="text-xs">Schritt</Label><Input value={i + 1} readOnly className="text-center" /></div>
                <div>
                  <Label className="text-xs">Rolle</Label>
                  <Select value={s.role} onValueChange={v => updateStep(i, { role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{APPROVER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Freigeber (User)</Label>
                  <Select value={s.user_id ?? ''} onValueChange={v => updateStep(i, { user_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="User wählen…" /></SelectTrigger>
                    <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
              </div>
              {i < chain.steps.length - 1 && <div className="flex justify-center py-1"><ArrowDown className="w-4 h-4 text-muted-foreground" /></div>}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addStep}><Plus className="w-3 h-3 mr-1" /> Schritt hinzufügen</Button>
          <Button size="sm" onClick={save} disabled={busy}><Save className="w-3 h-3 mr-1" /> Kette speichern</Button>
        </div>
      </CardContent>
    </Card>
  );
}
