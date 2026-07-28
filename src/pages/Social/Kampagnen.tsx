import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Target, Euro, TrendingUp } from 'lucide-react';

type Client = { id: string; company_name: string };
type Campaign = {
  id: string; client_id: string; name: string; platform: string | null; goal: string | null;
  status: string; starts_at: string | null; ends_at: string | null;
  budget_cents: number | null; cost_cents: number | null; leads: number | null; conversions: number | null; roi: number | null;
};

export default function SocialKampagnen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [rows, setRows] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'instagram', goal: 'awareness', budget: '', starts_at: '', ends_at: '' });

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name')
      .then(({ data }) => setClients(data ?? []));
  }, []);

  async function load() {
    if (!clientId) { setRows([]); return; }
    const { data } = await supabase.from('social_campaigns').select('*').eq('client_id', clientId).is('deleted_at', null).order('created_at', { ascending: false });
    setRows((data ?? []) as any);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  async function create() {
    if (!clientId || !form.name) return toast.error('Kunde & Name Pflicht');
    const { error } = await supabase.from('social_campaigns').insert({
      client_id: clientId, name: form.name, platform: form.platform, goal: form.goal,
      budget_cents: form.budget ? Math.round(Number(form.budget) * 100) : 0,
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      status: 'active',
    });
    if (error) return toast.error(error.message);
    toast.success('Kampagne angelegt');
    setOpen(false);
    setForm({ name: '', platform: 'instagram', goal: 'awareness', budget: '', starts_at: '', ends_at: '' });
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kampagnen & Ads</h1>
          <p className="text-muted-foreground mt-1">Ziel-KPIs, Budget-Tracking und Anzeigen-Auswertung</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!clientId}><Plus className="mr-2 h-4 w-4" />Neue Kampagne</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Kampagne</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Plattform</Label>
                  <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['instagram','facebook','linkedin','tiktok','youtube'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Ziel</Label>
                  <Select value={form.goal} onValueChange={v => setForm({ ...form, goal: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['awareness','engagement','traffic','leads','sales'].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Budget (EUR)</Label><Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start</Label><Input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>Ende</Label><Input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <Button onClick={create} className="w-full">Anlegen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Kunde wählen</CardTitle></CardHeader>
        <CardContent>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Kunde…" /></SelectTrigger>
            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {clientId && (
        <div className="grid gap-4">
          {rows.length === 0 && (
            <Card><CardContent className="p-10 text-center text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />Noch keine Kampagnen.
            </CardContent></Card>
          )}
          {rows.map(c => {
            const budget = (c.budget_cents ?? 0) / 100;
            const spent = (c.cost_cents ?? 0) / 100;
            const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">{c.name}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      {c.platform && <Badge variant="outline">{c.platform}</Badge>}
                      {c.goal && <Badge variant="outline">{c.goal}</Badge>}
                      <Badge>{c.status}</Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {c.starts_at?.slice(0, 10)} – {c.ends_at?.slice(0, 10)}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Euro className="h-3 w-3" />Budget</div>
                    <div className="text-xl font-semibold">{budget.toLocaleString('de-DE')} €</div>
                    <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Verbraucht: {spent.toLocaleString('de-DE')} €</div>
                  </div>
                  <div><div className="text-xs text-muted-foreground">Leads</div><div className="text-xl font-semibold">{c.leads ?? 0}</div></div>
                  <div><div className="text-xs text-muted-foreground">Conversions</div><div className="text-xl font-semibold">{c.conversions ?? 0}</div></div>
                  <div><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />ROI</div><div className="text-xl font-semibold">{c.roi ? Number(c.roi).toFixed(2) : '—'}</div></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
