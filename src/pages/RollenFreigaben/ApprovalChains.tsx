import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Workflow, Plus, Trash2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type Chain = { id: string; role_id: string; step_no: number; required_role_name: string; min_approvals: number };

export default function ApprovalChains() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selRole, setSelRole] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ step_no: 1, required_role_name: '', min_approvals: 1 });

  const load = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      (supabase as any).from('role_approval_chains').select('*').order('role_id').order('step_no'),
      supabase.from('roles').select('id, name').order('name'),
    ]);
    setChains(c.data ?? []); setRoles(r.data ?? []);
    if (!selRole && r.data?.[0]) setSelRole(r.data[0].id);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addStep = async () => {
    if (!selRole || !form.required_role_name.trim()) return;
    const { error } = await (supabase as any).from('role_approval_chains').insert({
      role_id: selRole, step_no: form.step_no, required_role_name: form.required_role_name.trim(), min_approvals: form.min_approvals,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Schritt hinzugefügt');
    setOpen(false); setForm({ step_no: 1, required_role_name: '', min_approvals: 1 });
    load();
  };
  const deleteStep = async (id: string) => { await (supabase as any).from('role_approval_chains').delete().eq('id', id); load(); };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const roleName = (id: string) => roles.find(r => r.id === id)?.name ?? id.slice(0, 8);
  const selChain = chains.filter(c => c.role_id === selRole).sort((a, b) => a.step_no - b.step_no);
  const nextStep = selChain.length > 0 ? Math.max(...selChain.map(c => c.step_no)) + 1 : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Workflow className="w-5 h-5" /> Genehmigungsketten</h2>
          <p className="text-xs text-muted-foreground">Definiert Multi-Level-Freigaben pro Rolle (z.B. Vorgesetzter → Compliance → Super Admin).</p>
        </div>
      </div>

      <Card className="p-4">
        <Label>Rolle auswählen</Label>
        <Select value={selRole} onValueChange={setSelRole}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {selRole && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Kette für „{roleName(selRole)}"</h3>
            <Button size="sm" onClick={() => { setForm({ ...form, step_no: nextStep }); setOpen(true); }}>
              <Plus className="w-3 h-3 mr-1" /> Schritt hinzufügen
            </Button>
          </div>

          {selChain.length === 0
            ? <div className="text-sm text-muted-foreground italic">Keine Kette – Standard: Super Admin (Vier-Augen).</div>
            : (
              <div className="flex items-center gap-2 flex-wrap">
                {selChain.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <Card className="p-3 bg-primary/5 border-primary/30">
                      <div className="text-[10px] uppercase text-muted-foreground">Schritt {c.step_no}</div>
                      <div className="font-medium text-sm">{c.required_role_name}</div>
                      <div className="text-[10px] text-muted-foreground">min. {c.min_approvals} Freigabe(n)</div>
                      <Button size="sm" variant="ghost" onClick={() => deleteStep(c.id)} className="h-6 p-0 mt-1"><Trash2 className="w-3 h-3 text-red-500" /></Button>
                    </Card>
                    {i < selChain.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            )}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Freigabeschritt hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Schritt-Nr.</Label><Input type="number" min={1} value={form.step_no} onChange={e => setForm({ ...form, step_no: parseInt(e.target.value) || 1 })} /></div>
              <div><Label>Min. Freigaben</Label><Input type="number" min={1} value={form.min_approvals} onChange={e => setForm({ ...form, min_approvals: parseInt(e.target.value) || 1 })} /></div>
            </div>
            <div><Label>Rolle des Freigebers</Label>
              <Select value={form.required_role_name} onValueChange={v => setForm({ ...form, required_role_name: v })}>
                <SelectTrigger><SelectValue placeholder="Rolle wählen…" /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={addStep}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
