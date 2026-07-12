import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Flame, Loader2, ShieldOff, Clock, User, Ticket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Session = {
  id: string;
  target_user_id: string;
  granted_role_id: string;
  reason: string;
  ticket_ref: string | null;
  activated_by: string;
  activated_at: string;
  expires_at: string;
  revoked_at: string | null;
  status: 'active' | 'expired' | 'revoked';
};

function fmtRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'abgelaufen';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  return `${h} Std. ${m % 60} Min.`;
}

export default function BreakGlass() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    target_user_id: '', role_id: '', reason: '', ticket_ref: '', duration_minutes: 60,
  });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const [s, u, r] = await Promise.all([
      (supabase as any).from('role_break_glass_sessions').select('*').order('activated_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email').eq('is_active', true).order('full_name'),
      supabase.from('roles').select('id, name').order('name'),
    ]);
    setSessions((s.data ?? []) as Session[]);
    setUsers(u.data ?? []);
    setRoles(r.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  async function activate() {
    if (!form.target_user_id || !form.role_id) { toast.error('Benutzer und Rolle wählen'); return; }
    if (form.reason.trim().length < 10) { toast.error('Begründung min. 10 Zeichen'); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).rpc('activate_break_glass', {
      _target_user_id: form.target_user_id,
      _role_id: form.role_id,
      _reason: form.reason.trim(),
      _duration_minutes: Number(form.duration_minutes),
      _ticket_ref: form.ticket_ref.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Break-Glass aktiviert · alle Super Admins wurden benachrichtigt');
    setOpen(false);
    setForm({ target_user_id: '', role_id: '', reason: '', ticket_ref: '', duration_minutes: 60 });
    load();
  }

  async function revoke(id: string) {
    if (!confirm('Diese Notfallsession sofort widerrufen und Rolle entziehen?')) return;
    const { error } = await (supabase as any).rpc('revoke_break_glass', { _session_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success('Session widerrufen');
    load();
  }

  const active = sessions.filter(s => s.status === 'active');
  const history = sessions.filter(s => s.status !== 'active').slice(0, 50);

  const nameFor = (id: string) => {
    const u = users.find(x => x.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };
  const roleFor = (id: string) => roles.find(r => r.id === id)?.name ?? '—';

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Notfallzugriffe…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
          <Flame className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Break-Glass · Notfallzugriff</h2>
          <p className="text-xs text-muted-foreground">
            Zeitlich strikt begrenzte Rollenvergabe für Notfälle. Jede Aktivierung erzeugt eine kritische Benachrichtigung an <b>alle Super Admins</b>, wird lückenlos protokolliert und läuft automatisch ab.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-500 hover:bg-red-600 text-white">
              <Flame className="w-4 h-4 mr-1" /> Notfallzugriff aktivieren
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" /> Break-Glass aktivieren
              </DialogTitle>
              <DialogDescription>
                Nur im Notfall verwenden. Alle Super Admins werden sofort informiert; die Aktion ist unwiderruflich im Audit-Log.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Zielbenutzer</Label>
                <Select value={form.target_user_id} onValueChange={v => setForm(f => ({ ...f, target_user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Benutzer wählen…" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rolle</Label>
                <Select value={form.role_id} onValueChange={v => setForm(f => ({ ...f, role_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Rolle wählen…" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Dauer (Minuten, 5–480)</Label>
                <Input type="number" min={5} max={480} value={form.duration_minutes}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Begründung (min. 10 Zeichen)</Label>
                <Textarea rows={3} value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="z. B. Produktionsausfall, Ticket #4711 – Zugriff nötig für Datenkorrektur" />
              </div>
              <div className="space-y-1">
                <Label>Ticket-/Vorgangs-Referenz (optional)</Label>
                <Input value={form.ticket_ref} onChange={e => setForm(f => ({ ...f, ticket_ref: e.target.value }))} placeholder="INC-1234" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={activate} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Jetzt aktivieren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 bg-red-500/5 border-red-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-red-500 flex items-center gap-2">
            <Flame className="w-4 h-4" /> Aktive Notfallsessions
          </div>
          <Badge variant="outline" className="border-red-500/40 text-red-500">{active.length}</Badge>
        </div>
        {active.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Keine aktiven Notfallzugriffe.</div>
        ) : (
          <div className="space-y-2">
            {active.map(s => (
              <div key={s.id} className="p-3 rounded-md border border-red-500/30 bg-card flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 min-w-[180px]">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{nameFor(s.target_user_id)}</div>
                    <div className="text-xs text-muted-foreground">{roleFor(s.granted_role_id)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> läuft ab: <b className="text-red-500">{fmtRemaining(s.expires_at)}</b>
                </div>
                {s.ticket_ref && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Ticket className="w-3.5 h-3.5" /> {s.ticket_ref}
                  </div>
                )}
                <div className="text-xs text-muted-foreground italic flex-1 min-w-[200px] truncate">„{s.reason}"</div>
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-500 hover:bg-red-500/10" onClick={() => revoke(s.id)}>
                  <ShieldOff className="w-4 h-4 mr-1" /> Widerrufen
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Historie (letzte 50)</div>
        {history.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Keine abgeschlossenen Sessions.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2">Benutzer</th>
                  <th className="text-left">Rolle</th>
                  <th className="text-left">Aktiviert</th>
                  <th className="text-left">Bis</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Grund</th>
                </tr>
              </thead>
              <tbody>
                {history.map(s => (
                  <tr key={s.id} className="border-b border-border/40">
                    <td className="py-2">{nameFor(s.target_user_id)}</td>
                    <td>{roleFor(s.granted_role_id)}</td>
                    <td className="text-xs text-muted-foreground">{new Date(s.activated_at).toLocaleString('de-DE')}</td>
                    <td className="text-xs text-muted-foreground">{new Date(s.revoked_at ?? s.expires_at).toLocaleString('de-DE')}</td>
                    <td>
                      <Badge variant="outline" className={
                        s.status === 'revoked' ? 'border-amber-500/40 text-amber-500'
                          : 'border-muted-foreground/30 text-muted-foreground'
                      }>{s.status === 'revoked' ? 'Widerrufen' : 'Abgelaufen'}</Badge>
                    </td>
                    <td className="text-xs italic max-w-[280px] truncate">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
