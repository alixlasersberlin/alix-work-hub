import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ShieldCheck, ShieldOff, Mail, RefreshCw, LogOut, Loader2, FileClock, Pencil } from 'lucide-react';
import { toast } from 'sonner';

type Props = { customerId: string; customerEmail?: string | null };

type StatusResp = {
  customer: { id: string; email: string | null; company_name: string | null; contact_name: string | null };
  link: {
    id: string; user_id: string | null; status: string;
    invited_at: string | null; accepted_at: string | null; last_login_at: string | null; created_at: string;
  } | null;
  auth_email: string | null;
  last_sign_in_at: string | null;
  recent_failed_logins: number;
};

type AuditRow = {
  id: string; action: string; success: boolean; created_at: string;
  object_type: string | null; object_id: string | null; metadata: any;
};

async function call(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('portal-admin', {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).message ?? (data as any).error);
  return data as any;
}

export default function PortalAccessTab({ customerId, customerEmail }: Props) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await call('status', { customer_id: customerId });
      setStatus(s);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [customerId]);

  const run = async (action: string, body: Record<string, unknown> = {}, successMsg = 'Erledigt') => {
    setBusy(action);
    try {
      await call(action, { customer_id: customerId, ...body });
      toast.success(successMsg);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const loadAudit = async () => {
    try {
      const r = await call('audit', { customer_id: customerId });
      setAudit(r.logs ?? []);
      setAuditOpen(true);
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!status) return null;

  const link = status.link;
  const isActive = link?.status === 'active';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Kundenportal</CardTitle>
        <Button size="sm" variant="ghost" onClick={loadAudit}>
          <FileClock className="w-4 h-4 mr-2" /> Protokoll
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Portalstatus">
            {link ? <StatusBadge status={link.status} /> : <Badge variant="outline">nicht aktiviert</Badge>}
          </Field>
          <Field label="Login-E-Mail">{status.auth_email ?? '—'}</Field>
          <Field label="Letzter Login">{fmtDate(status.last_sign_in_at ?? link?.last_login_at)}</Field>
          <Field label="Fehlversuche (7 Tage)">{status.recent_failed_logins}</Field>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {!isActive && (
            <ActivateDialog defaultEmail={status.auth_email ?? customerEmail ?? status.customer.email ?? ''} onSubmit={(email) => run('activate', { email }, 'Portal-Zugang aktiviert – Einladungs-Mail versendet.')} busy={busy === 'activate'} />
          )}
          {isActive && (
            <>
              <Button size="sm" variant="outline" disabled={busy === 'resend_invite'} onClick={() => run('resend_invite', {}, 'Einladung erneut gesendet.')}>
                {busy === 'resend_invite' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />} Einladung erneut senden
              </Button>
              <ChangeEmailDialog current={status.auth_email ?? ''} onSubmit={(email) => run('change_email', { email }, 'Login-E-Mail geändert.')} busy={busy === 'change_email'} />
              <Button size="sm" variant="outline" disabled={busy === 'revoke_sessions'} onClick={() => run('revoke_sessions', {}, 'Alle Sitzungen beendet.')}>
                {busy === 'revoke_sessions' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />} Sitzungen beenden
              </Button>
              <ConfirmDeactivate onConfirm={() => run('deactivate', {}, 'Portal-Zugang deaktiviert.')} busy={busy === 'deactivate'} />
            </>
          )}
        </div>

        <AlertDialog open={auditOpen} onOpenChange={setAuditOpen}>
          <AlertDialogContent className="max-w-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Zugriffsprotokoll</AlertDialogTitle>
              <AlertDialogDescription>Letzte 200 Ereignisse zu diesem Kunden.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[60vh] overflow-auto border border-border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0"><tr><th className="p-2 text-left">Zeit</th><th className="p-2 text-left">Aktion</th><th className="p-2">OK</th><th className="p-2 text-left">Details</th></tr></thead>
                <tbody>
                  {audit.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                      <td className="p-2 font-mono">{r.action}</td>
                      <td className="p-2 text-center">{r.success ? '✓' : '✗'}</td>
                      <td className="p-2 font-mono text-[10px] break-all">{r.metadata ? JSON.stringify(r.metadata) : '—'}</td>
                    </tr>
                  ))}
                  {audit.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Keine Einträge.</td></tr>}
                </tbody>
              </table>
            </div>
            <AlertDialogFooter><AlertDialogCancel>Schließen</AlertDialogCancel></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm font-medium mt-1">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    active: { label: 'Aktiv', variant: 'default' },
    invited: { label: 'Eingeladen', variant: 'secondary' },
    suspended: { label: 'Ausgesetzt', variant: 'destructive' },
    disabled: { label: 'Deaktiviert', variant: 'outline' },
  };
  const m = map[status] ?? { label: status, variant: 'outline' };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString('de-DE') : '—';
}

function ActivateDialog({ defaultEmail, onSubmit, busy }: { defaultEmail: string; onSubmit: (email: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  useEffect(() => { setEmail(defaultEmail); }, [defaultEmail]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><ShieldCheck className="w-4 h-4 mr-2" /> Portal aktivieren</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Portalzugang aktivieren</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Login-E-Mail-Adresse</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="text-xs text-muted-foreground">Der Kunde erhält eine Einladung. Login erfolgt anschließend per 6-stelligem E-Mail-Code.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button disabled={busy || !email.trim()} onClick={() => { onSubmit(email.trim()); setOpen(false); }}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Aktivieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeEmailDialog({ current, onSubmit, busy }: { current: string; onSubmit: (email: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(current);
  useEffect(() => { setEmail(current); }, [current]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="w-4 h-4 mr-2" /> E-Mail ändern</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Login-E-Mail ändern</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Label>Neue E-Mail-Adresse</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="text-xs text-muted-foreground">Alle bestehenden Sitzungen bleiben aktiv. Der nächste Login erfolgt mit der neuen Adresse.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button disabled={busy || !email.trim() || email === current} onClick={() => { onSubmit(email.trim()); setOpen(false); }}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Ändern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDeactivate({ onConfirm, busy }: { onConfirm: () => void; busy: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive"><ShieldOff className="w-4 h-4 mr-2" /> Deaktivieren</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Portalzugang deaktivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Der Kunde kann sich nicht mehr anmelden. Bestehende Sitzungen werden sofort beendet. Die Aktion kann durch erneutes Aktivieren rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Deaktivieren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
