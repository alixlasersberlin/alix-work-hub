import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FilePlus, Clock, CheckCircle2, XCircle, Hourglass, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type Req = {
  id: string; requested_by: string; target_user_id: string;
  action: string; role_id: string | null; role_name: string | null;
  reason: string; valid_until: string | null; urgency: string;
  status: string; reviewed_at: string | null; review_note: string | null;
  created_at: string; applied_at: string | null;
};

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  open:     { label: 'in Prüfung', icon: Hourglass,   cls: 'bg-amber-500/10 text-amber-500 border-amber-500/40' },
  approved: { label: 'freigegeben', icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40' },
  applied:  { label: 'aktiv',       icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40' },
  rejected: { label: 'abgelehnt',   icon: XCircle,      cls: 'bg-red-500/10 text-red-500 border-red-500/40' },
};

export default function SelfServiceRoles() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Req[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [myRoles, setMyRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ role_id: '', reason: '', valid_until: '', urgency: 'normal' });

  const load = async () => {
    setLoading(true);
    if (!user?.id) return;
    const [rq, r, mr] = await Promise.all([
      (supabase as any).from('role_change_requests').select('*').eq('requested_by', user.id).order('created_at', { ascending: false }),
      supabase.from('roles').select('id, name').order('name'),
      (supabase as any).from('user_roles').select('role_id, roles(name)').eq('user_id', user.id),
    ]);
    setRequests(rq.data ?? []); setRoles(r.data ?? []); setMyRoles(mr.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const submit = async () => {
    if (!form.role_id || !form.reason.trim()) {
      toast.error('Bitte Rolle und Begründung angeben');
      return;
    }
    setSaving(true);
    const role = roles.find(r => r.id === form.role_id);
    const { error } = await (supabase as any).from('role_change_requests').insert({
      requested_by: user?.id,
      target_user_id: user?.id,
      action: form.valid_until ? 'temporary' : 'grant',
      role_id: form.role_id,
      role_name: role?.name,
      reason: form.reason.trim(),
      valid_until: form.valid_until || null,
      urgency: form.urgency,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Antrag gestellt — ein Administrator wird informiert.');
    setOpen(false);
    setForm({ role_id: '', reason: '', valid_until: '', urgency: 'normal' });
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const open_ = requests.filter(r => r.status === 'open' || r.status === 'approved');
  const done = requests.filter(r => !['open', 'approved'].includes(r.status));

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Meine Rollenanfragen</h1>
          <p className="text-sm text-muted-foreground">
            Beantragen Sie zusätzliche Berechtigungen für Ihr Konto. Anfragen werden vom Super Admin geprüft.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><FilePlus className="w-4 h-4 mr-1" /> Neue Anfrage</Button>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-2">Aktuell zugewiesene Rollen</h2>
        <div className="flex flex-wrap gap-2">
          {myRoles.length === 0
            ? <span className="text-sm text-muted-foreground">Noch keine Rollen zugewiesen.</span>
            : myRoles.map((mr: any, i: number) => (
                <Badge key={i} variant="outline" className="bg-primary/10 text-primary border-primary/40">
                  {mr.roles?.name ?? mr.role_id}
                </Badge>
              ))}
        </div>
      </Card>

      {open_.length > 0 && (
        <div>
          <h2 className="text-xs uppercase text-muted-foreground mb-2">Offen / in Bearbeitung ({open_.length})</h2>
          <div className="space-y-2">
            {open_.map(r => {
              const meta = STATUS_META[r.status] ?? STATUS_META.open;
              const Icon = meta.icon;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={meta.cls}><Icon className="w-3 h-3 mr-1" /> {meta.label}</Badge>
                        <span className="font-medium">{r.role_name}</span>
                        {r.urgency !== 'normal' && <Badge variant="outline" className="bg-red-500/10 border-red-500/40 text-red-500">{r.urgency}</Badge>}
                      </div>
                      <div className="text-sm mt-2">{r.reason}</div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> gestellt am {new Date(r.created_at).toLocaleString('de-DE')}
                        {r.valid_until && <> · gewünscht bis {new Date(r.valid_until).toLocaleString('de-DE')}</>}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="text-xs uppercase text-muted-foreground mb-2 mt-4">Historie</h2>
          <div className="space-y-2">
            {done.map(r => {
              const meta = STATUS_META[r.status] ?? STATUS_META.open;
              return (
                <Card key={r.id} className="p-3 opacity-90">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                    <span className="font-medium">{r.role_name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {r.reviewed_at && new Date(r.reviewed_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  {r.review_note && <div className="text-xs text-muted-foreground mt-1">Anmerkung: {r.review_note}</div>}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Noch keine Rollenanfragen gestellt.
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Rollenanfrage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Gewünschte Rolle</Label>
              <Select value={form.role_id} onValueChange={v => setForm({ ...form, role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Begründung</Label>
              <Textarea rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                        placeholder="Wofür benötigen Sie diese Rolle?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label>Nur befristet bis (optional)</Label>
                <Input type="datetime-local" value={form.valid_until}
                       onChange={e => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
            <Card className="p-3 bg-primary/5 border-primary/30 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>Ihre Anfrage wird vom Super Admin geprüft. Sie erhalten eine Benachrichtigung, sobald über die Freigabe entschieden wurde.</div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Anfrage senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
