import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FilePlus, ShieldCheck, Ban, Clock, AlertTriangle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type Request = {
  id: string;
  requested_by: string;
  target_user_id: string;
  action: string;
  role_id: string | null;
  role_name: string | null;
  reason: string;
  valid_from: string | null;
  valid_until: string | null;
  urgency: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export default function Requests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    target_user_id: '',
    action: 'grant',
    role_id: '',
    reason: '',
    valid_until: '',
    urgency: 'normal',
  });

  const load = async () => {
    setLoading(true);
    const [rq, u, r] = await Promise.all([
      (supabase as any).from('role_change_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email'),
      supabase.from('roles').select('id, name').order('name'),
    ]);
    setRequests(rq.data ?? []); setUsers(u.data ?? []); setRoles(r.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u?.full_name ?? u?.email ?? id.slice(0, 8);
  };

  const submit = async () => {
    if (!form.target_user_id || !form.reason.trim() || !form.role_id) {
      toast.error('Bitte Zielbenutzer, Rolle und Begründung angeben');
      return;
    }
    setSaving(true);
    const role = roles.find(r => r.id === form.role_id);
    const { error } = await (supabase as any).from('role_change_requests').insert({
      requested_by: user?.id,
      target_user_id: form.target_user_id,
      action: form.action,
      role_id: form.role_id,
      role_name: role?.name,
      reason: form.reason.trim(),
      valid_until: form.valid_until || null,
      urgency: form.urgency,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Antrag erstellt — wartet auf Freigabe (Vier-Augen-Prinzip)');
    setOpen(false);
    setForm({ target_user_id: '', action: 'grant', role_id: '', reason: '', valid_until: '', urgency: 'normal' });
    load();
  };

  const review = async (id: string, decision: 'approved' | 'rejected', note?: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    if (req.requested_by === user?.id) { toast.error('Sie dürfen Ihren eigenen Antrag nicht freigeben.'); return; }
    const { error } = await (supabase as any).from('role_change_requests').update({
      status: decision,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === 'approved' ? 'Antrag freigegeben' : 'Antrag abgelehnt');
    load();
  };

  const apply = async (id: string) => {
    const req = requests.find(r => r.id === id);
    if (!req) return;
    if (req.requested_by === user?.id) { toast.error('Antragsteller darf eigenen Antrag nicht anwenden.'); return; }
    const { error } = await (supabase as any).rpc('apply_role_change_request', { _request_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success('Antrag angewendet — Rolle wurde vergeben/entzogen.');
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const open_ = requests.filter(r => r.status === 'open');
  const approved = requests.filter(r => r.status === 'approved');
  const done = requests.filter(r => !['open', 'approved'].includes(r.status));


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Freigabeanträge</h2>
          <p className="text-xs text-muted-foreground">Vier-Augen-Prinzip: Anträge müssen von einem anderen Super Admin geprüft werden.</p>
        </div>
        <Button onClick={() => setOpen(true)}><FilePlus className="w-4 h-4 mr-1" /> Neuer Antrag</Button>
      </div>

      {open_.length > 0 && (
        <div>
          <h3 className="text-xs uppercase text-muted-foreground mb-2">Offen ({open_.length})</h3>
          <div className="space-y-2">
            {open_.map(r => (
              <Card key={r.id} className="p-4 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-500">{r.action.toUpperCase()}</Badge>
                      <span className="font-medium">{r.role_name}</span>
                      <span className="text-xs text-muted-foreground">für</span>
                      <span className="font-medium">{userName(r.target_user_id)}</span>
                      {r.urgency !== 'normal' && <Badge variant="outline" className="bg-red-500/10 border-red-500/40 text-red-500">{r.urgency}</Badge>}
                    </div>
                    <div className="text-sm mt-2">{r.reason}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      beantragt von {userName(r.requested_by)} · {new Date(r.created_at).toLocaleString('de-DE')}
                      {r.valid_until && <> · gültig bis {new Date(r.valid_until).toLocaleString('de-DE')}</>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {r.requested_by === user?.id ? (
                      <Badge variant="outline" className="bg-muted flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> eigener Antrag — kein Selbstfreigeben</Badge>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => review(r.id, 'rejected')}>
                          <Ban className="w-3 h-3 mr-1" /> Ablehnen
                        </Button>
                        <Button size="sm" onClick={() => review(r.id, 'approved')}>
                          <ShieldCheck className="w-3 h-3 mr-1" /> Freigeben
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div>
          <h3 className="text-xs uppercase text-muted-foreground mb-2 mt-6">Freigegeben — bereit zur Anwendung ({approved.length})</h3>
          <div className="space-y-2">
            {approved.map(r => (
              <Card key={r.id} className="p-4 border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/40 text-emerald-500">APPROVED · {r.action.toUpperCase()}</Badge>
                      <span className="font-medium">{r.role_name}</span>
                      <span className="text-xs text-muted-foreground">für</span>
                      <span className="font-medium">{userName(r.target_user_id)}</span>
                    </div>
                    <div className="text-sm mt-2">{r.reason}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      geprüft von {r.reviewed_by ? userName(r.reviewed_by) : '—'} · {r.reviewed_at && new Date(r.reviewed_at).toLocaleString('de-DE')}
                      {r.valid_until && <> · gültig bis {new Date(r.valid_until).toLocaleString('de-DE')}</>}
                    </div>
                  </div>
                  {r.requested_by === user?.id ? (
                    <Badge variant="outline" className="bg-muted flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vier-Augen: nicht durch Antragsteller</Badge>
                  ) : (
                    <Button size="sm" onClick={() => apply(r.id)}>
                      <Zap className="w-3 h-3 mr-1" /> Jetzt anwenden
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}



      {done.length > 0 && (
        <div>
          <h3 className="text-xs uppercase text-muted-foreground mb-2 mt-6">Historie</h3>
          <div className="space-y-2">
            {done.map(r => (
              <Card key={r.id} className="p-3 opacity-80">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <Badge variant="outline" className={
                    r.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                    : r.status === 'rejected' ? 'bg-red-500/10 border-red-500/40 text-red-500'
                    : 'bg-muted'
                  }>{r.status}</Badge>
                  <span className="font-medium">{r.role_name}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{userName(r.target_user_id)}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" />{r.reviewed_at && new Date(r.reviewed_at).toLocaleString('de-DE')}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && <Card className="p-8 text-center text-muted-foreground">Noch keine Anträge.</Card>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Freigabeantrag</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Zielbenutzer</Label>
              <Select value={form.target_user_id} onValueChange={v => setForm({ ...form, target_user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name ?? u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Aktion</Label>
                <Select value={form.action} onValueChange={v => setForm({ ...form, action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grant">Rolle vergeben</SelectItem>
                    <SelectItem value="revoke">Rolle entziehen</SelectItem>
                    <SelectItem value="temporary">Befristet vergeben</SelectItem>
                    <SelectItem value="extend">Verlängern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dringlichkeit</Label>
                <Select value={form.urgency} onValueChange={v => setForm({ ...form, urgency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Rolle</Label>
              <Select value={form.role_id} onValueChange={v => setForm({ ...form, role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.action === 'temporary' || form.action === 'extend') && (
              <div>
                <Label>Gültig bis</Label>
                <Input type="datetime-local" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Begründung</Label>
              <Textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Warum ist diese Änderung erforderlich?" />
            </div>
            <Card className="p-3 bg-amber-500/5 border-amber-500/30 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>Dieser Antrag muss von einem <b>anderen</b> Super Admin geprüft werden. Sie können Ihren eigenen Antrag nicht freigeben. Die Freigabe wendet die Rolle noch nicht automatisch an — der Prüfer entscheidet.</div>
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Antrag stellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
