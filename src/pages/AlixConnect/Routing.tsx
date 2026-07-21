import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Route, Plus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Rule = {
  id: string; name: string; channel: string; priority: number; is_active: boolean;
  required_skills: string[] | null; required_language: string | null; min_customer_score: number | null;
  sla_first_response_sec: number | null; sla_resolution_sec: number | null;
  overflow_after_sec: number | null; boost_by_customer_score: boolean | null;
  target_user_ids: string[] | null;
};

const channels = ['any','call','chat','email','whatsapp','sms','ticket'];

export default function Routing() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', channel: 'any', priority: 100, is_active: true, required_skills: '', sla_first_response_sec: 60, sla_resolution_sec: 3600, overflow_after_sec: 300, boost_by_customer_score: true, min_customer_score: '', required_language: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [r, d] = await Promise.all([
      supabase.from('ac_routing_rules').select('*').order('priority', { ascending: true }),
      supabase.from('ac_routing_decisions').select('*').order('created_at', { ascending: false }).limit(30),
    ]);
    if (r.error) toast.error(r.error.message);
    setRules((r.data ?? []) as Rule[]);
    setDecisions(d.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.name.trim()) { toast.error('Name fehlt'); return; }
    setSaving(true);
    const payload: any = {
      name: form.name, channel: form.channel, priority: Number(form.priority) || 100,
      is_active: !!form.is_active,
      required_skills: form.required_skills ? String(form.required_skills).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      required_language: form.required_language || null,
      min_customer_score: form.min_customer_score === '' ? null : Number(form.min_customer_score),
      sla_first_response_sec: Number(form.sla_first_response_sec) || null,
      sla_resolution_sec: Number(form.sla_resolution_sec) || null,
      overflow_after_sec: Number(form.overflow_after_sec) || null,
      boost_by_customer_score: !!form.boost_by_customer_score,
    };
    const { error } = await supabase.from('ac_routing_rules').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Regel gespeichert');
    setOpen(false); load();
  }

  async function toggle(r: Rule) {
    await supabase.from('ac_routing_rules').update({ is_active: !r.is_active }).eq('id', r.id);
    load();
  }

  async function del(id: string) {
    if (!confirm('Regel löschen?')) return;
    await supabase.from('ac_routing_rules').delete().eq('id', id);
    load();
  }

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Route className="w-5 h-5 text-primary" /> Omnichannel Routing 2.0</h2>
          <p className="text-xs text-muted-foreground">Skill-based Routing, SLA-Engine, Overflow, Customer-Score-Boost.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1.5" />Aktualisieren</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Neue Regel</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Routing-Regel</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                    {channels.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input type="number" placeholder="Priorität (kleiner = wichtiger)" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                </div>
                <Input placeholder="Skills (Komma-getrennt: laser,de-support)" value={form.required_skills} onChange={(e) => setForm({ ...form, required_skills: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Sprache (de,en,at)" value={form.required_language} onChange={(e) => setForm({ ...form, required_language: e.target.value })} />
                  <Input type="number" placeholder="Min. Customer-Score" value={form.min_customer_score} onChange={(e) => setForm({ ...form, min_customer_score: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="SLA Erstantw. (s)" value={form.sla_first_response_sec} onChange={(e) => setForm({ ...form, sla_first_response_sec: e.target.value })} />
                  <Input type="number" placeholder="SLA Lösung (s)" value={form.sla_resolution_sec} onChange={(e) => setForm({ ...form, sla_resolution_sec: e.target.value })} />
                  <Input type="number" placeholder="Overflow nach (s)" value={form.overflow_after_sec} onChange={(e) => setForm({ ...form, overflow_after_sec: e.target.value })} />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Aktiv</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={form.boost_by_customer_score} onCheckedChange={(v) => setForm({ ...form, boost_by_customer_score: v })} /> Score-Boost</label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-6 h-6" /></div>
      ) : (
        <>
          <div className="grid gap-3">
            {rules.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">Noch keine Regeln.</CardContent></Card>}
            {rules.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{r.name}</p>
                      <Badge variant="outline">{r.channel}</Badge>
                      <Badge variant="secondary">Prio {r.priority}</Badge>
                      {r.is_active ? <Badge className="bg-emerald-500/15 text-emerald-500">aktiv</Badge> : <Badge variant="outline">inaktiv</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      SLA: {r.sla_first_response_sec ?? '–'}s / {r.sla_resolution_sec ?? '–'}s · Overflow: {r.overflow_after_sec ?? '–'}s
                      {r.required_skills?.length ? ` · Skills: ${r.required_skills.join(', ')}` : ''}
                      {r.required_language ? ` · Sprache: ${r.required_language}` : ''}
                      {r.min_customer_score != null ? ` · Min Score: ${r.min_customer_score}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                    <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Letzte Routing-Entscheidungen</CardTitle></CardHeader>
            <CardContent>
              {decisions.length === 0 ? <p className="text-xs text-muted-foreground">Noch keine Entscheidungen.</p> : (
                <div className="text-xs space-y-1 max-h-64 overflow-auto font-mono">
                  {decisions.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 border-b border-border/40 py-1">
                      <span className="text-muted-foreground">{new Date(d.created_at).toLocaleTimeString('de-DE')}</span>
                      <Badge variant="outline">{d.channel}</Badge>
                      <span className={d.fallback_used ? 'text-amber-500' : 'text-emerald-500'}>{d.reason}</span>
                      <span className="text-muted-foreground">Score {d.score ?? '–'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
