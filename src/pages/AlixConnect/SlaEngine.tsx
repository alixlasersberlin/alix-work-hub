import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Shield, Plus, Trash2, PlayCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const CHANNELS = ['', 'email', 'sms', 'whatsapp', 'chat', 'voice'];
const PRIORITIES = ['', 'low', 'normal', 'high', 'urgent'];

export default function AlixConnectSlaEngine() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [breaches, setBreaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [np, setNp] = useState({ name: '', channel: '', priority: '', first_response_min: 30, resolution_min: 1440 });

  const load = async () => {
    setLoading(true);
    const [p, b] = await Promise.all([
      supabase.from('ac_sla_policies').select('*').order('created_at', { ascending: false }),
      supabase.from('ac_sla_breaches').select('*').order('breached_at', { ascending: false }).limit(50),
    ]);
    setPolicies(p.data ?? []); setBreaches(b.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!np.name.trim()) return toast.error('Name fehlt');
    const { error } = await supabase.from('ac_sla_policies').insert({
      name: np.name, channel: np.channel || null, priority: np.priority || null,
      first_response_min: np.first_response_min, resolution_min: np.resolution_min,
    });
    if (error) return toast.error(error.message);
    setNp({ name: '', channel: '', priority: '', first_response_min: 30, resolution_min: 1440 });
    toast.success('Policy angelegt'); load();
  };
  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from('ac_sla_policies').update({ is_active }).eq('id', id); load();
  };
  const del = async (id: string) => {
    if (!confirm('Löschen?')) return;
    await supabase.from('ac_sla_policies').delete().eq('id', id); load();
  };
  const runCheck = async () => {
    const t = toast.loading('SLA-Check läuft…');
    const { data, error } = await supabase.functions.invoke('ac-sla-check');
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    toast.success(`${(data as any)?.breaches ?? 0} neue Verstöße bei ${(data as any)?.scanned ?? 0} Konversationen`);
    load();
  };
  const resolve = async (id: string) => {
    await supabase.from('ac_sla_breaches').update({ resolved_at: new Date().toISOString() }).eq('id', id); load();
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> SLA & Escalation Engine
            <Badge variant="outline">Phase 30</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">SLA-Policies je Kanal/Priorität · Auto-Eskalation bei Breach</p>
        </div>
        <Button size="sm" onClick={runCheck}><PlayCircle className="h-3.5 w-3.5 mr-1" />SLA-Check jetzt</Button>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Neue Policy</div>
        <div className="grid md:grid-cols-6 gap-2">
          <Input placeholder="Name" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
          <select className="border rounded px-2 py-1.5 text-sm bg-background" value={np.channel} onChange={(e) => setNp({ ...np, channel: e.target.value })}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c || 'Alle Kanäle'}</option>)}
          </select>
          <select className="border rounded px-2 py-1.5 text-sm bg-background" value={np.priority} onChange={(e) => setNp({ ...np, priority: e.target.value })}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p || 'Alle Prio'}</option>)}
          </select>
          <Input type="number" placeholder="First Resp (Min)" value={np.first_response_min} onChange={(e) => setNp({ ...np, first_response_min: Number(e.target.value) })} />
          <Input type="number" placeholder="Resolution (Min)" value={np.resolution_min} onChange={(e) => setNp({ ...np, resolution_min: Number(e.target.value) })} />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Anlegen</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Policies ({policies.length})</div>
        {loading ? 'Lade…' : policies.length === 0 ? <div className="text-xs text-muted-foreground">Keine Policies.</div> : (
          <table className="text-xs w-full">
            <thead><tr className="text-muted-foreground"><th className="text-left py-1">Name</th><th className="text-left py-1">Kanal</th><th className="text-left py-1">Prio</th><th className="text-right py-1">First Resp</th><th className="text-right py-1">Resolution</th><th className="text-center py-1">Aktiv</th><th></th></tr></thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-1 font-medium">{p.name}</td>
                  <td className="py-1">{p.channel || '—'}</td>
                  <td className="py-1">{p.priority || '—'}</td>
                  <td className="py-1 text-right">{p.first_response_min} Min</td>
                  <td className="py-1 text-right">{p.resolution_min} Min</td>
                  <td className="py-1 text-center"><Switch checked={p.is_active} onCheckedChange={(v) => toggle(p.id, v)} /></td>
                  <td className="py-1 text-right"><Button size="sm" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Aktuelle Verstöße</div>
        {breaches.length === 0 ? <div className="text-xs text-muted-foreground">Keine Verstöße 🎉</div> : (
          <table className="text-xs w-full">
            <thead><tr className="text-muted-foreground"><th className="text-left py-1">Zeit</th><th className="text-left py-1">Typ</th><th className="text-left py-1">Konversation</th><th className="text-left py-1">Status</th><th></th></tr></thead>
            <tbody>
              {breaches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="py-1">{new Date(b.breached_at).toLocaleString('de-DE')}</td>
                  <td className="py-1"><Badge variant={b.breach_type === 'resolution' ? 'destructive' : 'secondary'}>{b.breach_type}</Badge></td>
                  <td className="py-1 font-mono text-[10px]">{b.conversation_id?.slice(0, 8)}</td>
                  <td className="py-1">{b.resolved_at ? <span className="text-green-500">gelöst</span> : <span className="text-destructive">offen</span>}</td>
                  <td className="py-1 text-right">{!b.resolved_at && <Button size="sm" variant="outline" onClick={() => resolve(b.id)}>Als gelöst markieren</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
