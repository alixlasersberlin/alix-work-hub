import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ClipboardCheck, Play, CheckCircle2, XCircle, UserPlus, Bell, Repeat } from 'lucide-react';
import { toast } from 'sonner';

type Campaign = {
  id: string; name: string; description: string | null;
  period_start: string; period_end: string; status: string;
  created_at: string; completed_at: string | null;
  recurrence: 'none' | 'monthly' | 'quarterly' | 'yearly';
  reminder_days_before: number;
  parent_campaign_id: string | null;
};
type Item = {
  id: string; campaign_id: string; user_id: string; role_id: string;
  role_name: string | null; decision: string | null;
  decided_by: string | null; decided_at: string | null; note: string | null;
  reviewer_id: string | null; reminded_at: string | null;
};

const RECURRENCE_LABEL: Record<string, string> = {
  none: 'Einmalig', monthly: 'Monatlich', quarterly: 'Quartalsweise', yearly: 'Jährlich',
};

export default function Recertification() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selCampaign, setSelCampaign] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', period_end: '', recurrence: 'none' as Campaign['recurrence'], reminder_days_before: 7 });
  const [delegateFor, setDelegateFor] = useState<Item | null>(null);
  const [delegateUser, setDelegateUser] = useState<string>('');

  const load = async () => {
    setLoading(true);
    const [c, u] = await Promise.all([
      (supabase as any).from('role_recert_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email'),
    ]);
    setCampaigns(c.data ?? []); setUsers(u.data ?? []); setLoading(false);
    if (!selCampaign && c.data?.[0]) setSelCampaign(c.data[0].id);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selCampaign) { setItems([]); return; }
    (supabase as any).from('role_recert_items').select('*').eq('campaign_id', selCampaign).order('role_name')
      .then(({ data }: any) => setItems(data ?? []));
  }, [selCampaign, busy]);

  const userName = (id: string | null) => {
    if (!id) return '—';
    const u = users.find(x => x.id === id);
    return u?.full_name ?? u?.email ?? id.slice(0, 8);
  };

  const start = async () => {
    if (!form.name.trim() || !form.period_end) { toast.error('Name und Enddatum sind Pflicht'); return; }
    setBusy('start');
    const { data, error } = await (supabase as any).rpc('start_recertification_campaign', {
      _name: form.name.trim(), _description: form.description.trim() || null, _period_end: form.period_end,
    });
    if (!error && (form.recurrence !== 'none' || form.reminder_days_before !== 7)) {
      await (supabase as any).from('role_recert_campaigns').update({
        recurrence: form.recurrence, reminder_days_before: form.reminder_days_before,
      }).eq('id', data);
    }
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Kampagne gestartet');
    setOpen(false); setForm({ name: '', description: '', period_end: '', recurrence: 'none', reminder_days_before: 7 });
    setSelCampaign(data);
    load();
  };

  const decide = async (id: string, decision: 'confirm' | 'revoke') => {
    let note = '';
    if (decision === 'revoke') {
      const n = window.prompt('Grund für den Entzug?');
      if (!n?.trim()) return;
      note = n.trim();
    }
    setBusy(id);
    const { error } = await (supabase as any).rpc('decide_recert_item', { _item_id: id, _decision: decision, _note: note || null });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === 'confirm' ? 'Bestätigt' : 'Entzogen');
  };

  const complete = async (id: string) => {
    if (!confirm('Kampagne wirklich abschließen?\n\nWenn eine Wiederholung eingestellt ist, wird automatisch die Folgekampagne erstellt.')) return;
    const { error } = await (supabase as any).from('role_recert_campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Kampagne abgeschlossen');
    load();
  };

  const sendReminders = async (id: string) => {
    setBusy('remind');
    const { data, error } = await (supabase as any).rpc('send_recert_reminders', { _campaign_id: id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Erinnerungen versendet (${data?.sent ?? 0})`);
    setSelCampaign(id);
  };

  const delegate = async () => {
    if (!delegateFor || !delegateUser) return;
    setBusy('delegate');
    const { error } = await (supabase as any).rpc('delegate_recert_item', { _item_id: delegateFor.id, _reviewer_id: delegateUser });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Prüfer zugewiesen');
    setDelegateFor(null); setDelegateUser('');
  };

  const progress = useMemo(() => {
    const total = items.length;
    const done = items.filter(i => i.decision).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [items]);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const sel = campaigns.find(c => c.id === selCampaign);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Rezertifizierung (Access Review)</h2>
          <p className="text-xs text-muted-foreground">Periodische Bestätigung aller Rollenzuweisungen. Prüfer delegieren, Erinnerungen versenden, wiederkehrende Kampagnen automatisch fortführen.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Play className="w-3 h-3 mr-1" /> Neue Kampagne</Button>
      </div>

      {campaigns.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Noch keine Kampagne. Starten Sie z.B. quartalsweise eine Prüfung aller aktuellen Rollen.
        </Card>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {campaigns.map(c => (
              <button key={c.id} onClick={() => setSelCampaign(c.id)}
                className={`px-3 py-2 rounded-md text-sm border ${selCampaign === c.id ? 'bg-primary/10 border-primary text-primary' : 'bg-card border-border hover:bg-muted/40'}`}>
                <div className="font-medium">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {c.status} · bis {new Date(c.period_end).toLocaleDateString('de-DE')}
                  {c.recurrence !== 'none' && <> · <Repeat className="w-2.5 h-2.5 inline" /> {RECURRENCE_LABEL[c.recurrence]}</>}
                </div>
              </button>
            ))}
          </div>

          {sel && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold">{sel.name}</h3>
                  <div className="text-xs text-muted-foreground">
                    {sel.description} · Zeitraum {new Date(sel.period_start).toLocaleDateString('de-DE')} – {new Date(sel.period_end).toLocaleDateString('de-DE')}
                    {sel.recurrence !== 'none' && <> · Wiederholung: {RECURRENCE_LABEL[sel.recurrence]}</>}
                    {' · '}Erinnerung {sel.reminder_days_before} Tage vorher
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{sel.status}</Badge>
                  {sel.status === 'active' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => sendReminders(sel.id)} disabled={busy === 'remind'}>
                        <Bell className="w-3 h-3 mr-1" /> Erinnerungen senden
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => complete(sel.id)}>Abschließen</Button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Fortschritt</span>
                  <span>{progress.done} / {progress.total} ({progress.pct}%)</span>
                </div>
                <Progress value={progress.pct} />
              </div>

              <div className="border rounded-md max-h-[500px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr>
                      <th className="p-2 text-left">Benutzer</th>
                      <th className="p-2 text-left">Rolle</th>
                      <th className="p-2 text-left">Prüfer</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-right">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">{userName(it.user_id)}</td>
                        <td className="p-2">{it.role_name}</td>
                        <td className="p-2">
                          {it.reviewer_id
                            ? <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40">{userName(it.reviewer_id)}</Badge>
                            : <span className="text-xs text-muted-foreground">Super Admin</span>}
                        </td>
                        <td className="p-2">
                          {it.decision === 'confirm' && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/40"><CheckCircle2 className="w-3 h-3 mr-1" /> bestätigt</Badge>}
                          {it.decision === 'revoke' && <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/40"><XCircle className="w-3 h-3 mr-1" /> entzogen</Badge>}
                          {!it.decision && <Badge variant="outline" className="text-muted-foreground">{it.reminded_at ? 'erinnert' : 'offen'}</Badge>}
                        </td>
                        <td className="p-2 text-right">
                          {!it.decision && sel.status === 'active' && (
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => { setDelegateFor(it); setDelegateUser(it.reviewer_id ?? ''); }}>
                                <UserPlus className="w-3 h-3 mr-1" /> Delegieren
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => decide(it.id, 'confirm')} disabled={busy === it.id}>
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Bestätigen
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => decide(it.id, 'revoke')} disabled={busy === it.id}>
                                <XCircle className="w-3 h-3 mr-1" /> Entziehen
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Neue Kampagne */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Rezertifizierungs-Kampagne</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="z.B. Q1 2026 Access Review" />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Prüfung bis</Label>
              <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Wiederholung</Label>
                <Select value={form.recurrence} onValueChange={(v: any) => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Einmalig</SelectItem>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                    <SelectItem value="quarterly">Quartalsweise</SelectItem>
                    <SelectItem value="yearly">Jährlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Erinnerung (Tage vor Ablauf)</Label>
                <Input type="number" min={0} max={90} value={form.reminder_days_before}
                       onChange={e => setForm({ ...form, reminder_days_before: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            {form.recurrence !== 'none' && (
              <p className="text-xs text-muted-foreground">
                Nach Abschluss wird automatisch eine Folgekampagne mit den dann aktuellen Rollenzuweisungen erstellt.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={start} disabled={busy === 'start'}>
              {busy === 'start' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delegation */}
      <Dialog open={!!delegateFor} onOpenChange={o => !o && setDelegateFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prüfer zuweisen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Position: <span className="text-foreground font-medium">{delegateFor && userName(delegateFor.user_id)}</span> · Rolle: <span className="text-foreground font-medium">{delegateFor?.role_name}</span>
            </div>
            <div>
              <Label>Prüfer</Label>
              <Select value={delegateUser} onValueChange={setDelegateUser}>
                <SelectTrigger><SelectValue placeholder="Mitarbeiter wählen…" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelegateFor(null)}>Abbrechen</Button>
            <Button onClick={delegate} disabled={!delegateUser || busy === 'delegate'}>
              {busy === 'delegate' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Zuweisen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
