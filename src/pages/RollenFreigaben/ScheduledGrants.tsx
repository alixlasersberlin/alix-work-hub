import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, CalendarClock, Plus, PlayCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Grant = { id: string; user_id: string; role_id: string; role_name: string | null; valid_from: string; valid_until: string; reason: string; status: string; auto_revoked_at: string | null };

export default function ScheduledGrants() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ user_id: '', role_id: '', valid_from: '', valid_until: '', reason: '' });

  const load = async () => {
    setLoading(true);
    const [g, u, r] = await Promise.all([
      (supabase as any).from('role_temporary_grants').select('*').order('valid_from', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email'),
      supabase.from('roles').select('id, name').order('name'),
    ]);
    setGrants(g.data ?? []); setUsers(u.data ?? []); setRoles(r.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const userName = (id: string) => users.find(x => x.id === id)?.full_name ?? users.find(x => x.id === id)?.email ?? id.slice(0, 8);

  const schedule = async () => {
    if (!form.user_id || !form.role_id || !form.valid_from || !form.valid_until || !form.reason.trim()) {
      toast.error('Alle Felder ausfüllen'); return;
    }
    setBusy(true);
    const { error } = await (supabase as any).rpc('schedule_role_grant', {
      _user_id: form.user_id, _role_id: form.role_id,
      _valid_from: new Date(form.valid_from).toISOString(),
      _valid_until: new Date(form.valid_until).toISOString(),
      _reason: form.reason.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Zuweisung geplant');
    setOpen(false); setForm({ user_id: '', role_id: '', valid_from: '', valid_until: '', reason: '' });
    load();
  };

  const process = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('process_scheduled_grants');
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Aktiviert: ${data?.activated ?? 0} · Abgelaufen: ${data?.expired ?? 0}`);
    load();
  };

  const revoke = async (g: Grant) => {
    if (!confirm('Zuweisung sofort beenden und Rolle entfernen?')) return;
    await (supabase as any).from('user_roles').delete().eq('user_id', g.user_id).eq('role_id', g.role_id);
    await (supabase as any).from('role_temporary_grants').update({ status: 'expired', auto_revoked_at: new Date().toISOString() }).eq('id', g.id);
    toast.success('Beendet'); load();
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const scheduled = grants.filter(g => g.status === 'scheduled');
  const active = grants.filter(g => g.status === 'active');
  const history = grants.filter(g => g.status === 'expired');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarClock className="w-5 h-5" /> Geplante Rollenzuweisungen</h2>
          <p className="text-xs text-muted-foreground">Rollen werden ab Startdatum automatisch aktiv und bei Enddatum entfernt.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={process} disabled={busy}><PlayCircle className="w-3 h-3 mr-1" /> Fälligkeiten verarbeiten</Button>
          <Button onClick={() => setOpen(true)}><Plus className="w-3 h-3 mr-1" /> Neu planen</Button>
        </div>
      </div>

      {[
        { title: 'Geplant', items: scheduled, cls: 'border-amber-500/30 bg-amber-500/5' },
        { title: 'Aktiv', items: active, cls: 'border-emerald-500/30 bg-emerald-500/5' },
        { title: 'Historie', items: history, cls: 'opacity-70' },
      ].map(s => s.items.length > 0 && (
        <div key={s.title}>
          <h3 className="text-xs uppercase text-muted-foreground mb-2">{s.title} ({s.items.length})</h3>
          <div className="space-y-2">
            {s.items.map(g => (
              <Card key={g.id} className={`p-3 ${s.cls}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{g.status}</Badge>
                      <span className="font-medium">{g.role_name}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{userName(g.user_id)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(g.valid_from).toLocaleString('de-DE')} – {new Date(g.valid_until).toLocaleString('de-DE')} · {g.reason}
                    </div>
                  </div>
                  {g.status !== 'expired' && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(g)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {grants.length === 0 && <Card className="p-8 text-center text-muted-foreground">Keine geplanten Zuweisungen.</Card>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rolle zeitgesteuert vergeben</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Benutzer</Label>
              <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Rolle</Label>
              <Select value={form.role_id} onValueChange={v => setForm({ ...form, role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Aktiv ab</Label><Input type="datetime-local" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div><Label>Gültig bis</Label><Input type="datetime-local" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
            </div>
            <div><Label>Begründung</Label><Textarea rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={schedule} disabled={busy}>{busy && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Planen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
