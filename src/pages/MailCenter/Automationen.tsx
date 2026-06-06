import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Workflow, Plus, Play, Trash2, RefreshCw, Edit3, History,
} from 'lucide-react';

const TRIGGERS = [
  { value: 'order_created', label: 'Auftrag erstellt', dept: 'Vertrieb' },
  { value: 'order_paid', label: 'Auftrag bezahlt', dept: 'Finance' },
  { value: 'deposit_open', label: 'Anzahlung offen', dept: 'Finance' },
  { value: 'production_started', label: 'Produktion gestartet', dept: 'Technik' },
  { value: 'delivery_planned', label: 'Lieferung geplant', dept: 'Tourenplanung' },
  { value: 'delivered', label: 'Gerät geliefert', dept: 'Tourenplanung' },
  { value: 'repair_received', label: 'Reparatur angenommen', dept: 'Technik' },
  { value: 'repair_done', label: 'Reparatur abgeschlossen', dept: 'Technik' },
  { value: 'invoice_created', label: 'Rechnung erstellt', dept: 'Finance' },
  { value: 'invoice_overdue', label: 'Rechnung überfällig', dept: 'Finance' },
  { value: 'ticket_created', label: 'Ticket erstellt', dept: 'Kundenservice' },
  { value: 'review_pending', label: 'Bewertung offen', dept: 'Marketing' },
];

const SENDERS = [
  { email: 'vertrieb@alixwork.de', name: 'Alix Vertrieb' },
  { email: 'finance@alixwork.de', name: 'Alix Finance' },
  { email: 'service@alixwork.de', name: 'Alix Service' },
  { email: 'news@alixwork.de', name: 'Alix Newsletter' },
];

const DELAYS = [
  { value: 0, label: 'Sofort' },
  { value: 30, label: 'Nach 30 Minuten' },
  { value: 60, label: 'Nach 1 Stunde' },
  { value: 1440, label: 'Nach 1 Tag' },
  { value: 4320, label: 'Nach 3 Tagen' },
  { value: 10080, label: 'Nach 7 Tagen' },
];

const STATUS_COLORS: Record<string, string> = {
  'Aktiv': 'bg-emerald-500/15 text-emerald-500',
  'Inaktiv': 'bg-muted text-muted-foreground',
  'Fehler': 'bg-destructive/15 text-destructive',
};

const DEPT_ROLE: Record<string, string[]> = {
  'Vertrieb': ['Vertrieb', 'Order'],
  'Finance': ['Finance'],
  'Technik': ['Technik', 'Kundenservice', 'Reparaturannahme'],
  'Marketing': ['Marketing'],
  'Kundenservice': ['Kundenservice', 'Technik'],
  'Tourenplanung': ['Tourenplanung', 'Order'],
};

export default function MailCenterAutomationen() {
  const { toast } = useToast();
  const { hasRole, hasAnyRole, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const canManage = (dept?: string) => {
    if (isAdmin || hasRole('Geschäftsführung')) return true;
    if (!dept) return false;
    return hasAnyRole(DEPT_ROLE[dept] ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('mail_automations').select('*')
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  const loadTemplates = async () => {
    const { data } = await supabase.from('mail_templates')
      .select('id,name,category,department').eq('is_active', true).order('name');
    setTemplates(data ?? []);
  };

  useEffect(() => { load(); loadTemplates(); }, []);

  const openNew = () => setEditing({
    name: '', trigger_type: 'order_created', template_id: '',
    sender_email: SENDERS[0].email, sender_name: SENDERS[0].name,
    delay_minutes: 0, department: 'Vertrieb', is_active: true,
    description: '', trigger_config: {},
  });

  const save = async () => {
    if (!editing.name || !editing.trigger_type || !editing.template_id) {
      toast({ title: 'Felder fehlen', variant: 'destructive' });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name: editing.name,
      trigger_type: editing.trigger_type,
      trigger_config: editing.trigger_config ?? {},
      template_id: editing.template_id,
      sender_email: editing.sender_email,
      sender_name: editing.sender_name,
      delay_minutes: Number(editing.delay_minutes) || 0,
      department: editing.department,
      is_active: editing.is_active,
      status: editing.is_active ? 'Aktiv' : 'Inaktiv',
      description: editing.description,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from('mail_automations').update(payload).eq('id', editing.id));
    } else {
      ({ error: err } = await supabase.from('mail_automations').insert({ ...payload, created_by: user?.id }));
    }
    if (err) toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    else { toast({ title: 'Gespeichert' }); setEditing(null); load(); }
  };

  const toggleActive = async (a: any) => {
    const newActive = !a.is_active;
    await supabase.from('mail_automations').update({
      is_active: newActive, status: newActive ? 'Aktiv' : 'Inaktiv',
    }).eq('id', a.id);
    load();
  };

  const remove = async (a: any) => {
    if (!confirm('Automation löschen?')) return;
    const { error } = await supabase.from('mail_automations').delete().eq('id', a.id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Gelöscht' }); load(); }
  };

  const runNow = async (a: any) => {
    setRunning(a.id);
    try {
      const { data, error } = await supabase.functions.invoke('run-automations', {
        body: { automation_id: a.id },
      });
      if (error) throw error;
      const res = data?.results?.[0];
      toast({
        title: 'Automation ausgeführt',
        description: res
          ? `Gesendet: ${res.sent ?? 0}, Übersprungen: ${res.skipped ?? 0}, Fehler: ${res.failed ?? 0}`
          : 'Kein Ergebnis',
      });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(null);
    }
  };

  const openHistory = async (id: string) => {
    setHistoryId(id);
    const { data } = await supabase.from('mail_automation_runs')
      .select('*').eq('automation_id', id)
      .order('executed_at', { ascending: false }).limit(100);
    setHistory(data ?? []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Automationen</h2>
          <p className="text-sm text-muted-foreground">
            Trigger-basierte E-Mails: Auftrag erstellt, Reparatur abgeschlossen, Zahlung überfällig …
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
          </Button>
          {(isAdmin || hasAnyRole(['Marketing', 'Finance', 'Technik', 'Vertrieb', 'Kundenservice'])) && (
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Neue Automation</Button>
          )}
        </div>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Workflow className="w-4 h-4 text-primary" /> Regeln
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Lade…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Workflow className="w-10 h-10 opacity-40 mb-3" />
              <p className="text-sm">Noch keine Automationen konfiguriert.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Auslöser</TableHead>
                  <TableHead>Vorlage</TableHead>
                  <TableHead>Abteilung</TableHead>
                  <TableHead>Verzögerung</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Letzter Lauf</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => {
                  const tpl = templates.find(t => t.id === a.template_id);
                  const trg = TRIGGERS.find(t => t.value === a.trigger_type);
                  const delay = DELAYS.find(d => d.value === a.delay_minutes);
                  const allowed = canManage(a.department);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-xs">{trg?.label ?? a.trigger_type}</TableCell>
                      <TableCell className="text-xs">{tpl?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs">{a.department ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {delay?.label ?? `${a.delay_minutes} Min`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[a.status] ?? 'bg-muted'}>
                          {a.status ?? (a.is_active ? 'Aktiv' : 'Inaktiv')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.last_run_at ? new Date(a.last_run_at).toLocaleString('de-DE') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 items-center">
                          {allowed && (
                            <Switch
                              checked={!!a.is_active}
                              onCheckedChange={() => toggleActive(a)}
                              title="Aktiv/Inaktiv"
                            />
                          )}
                          <Button size="icon" variant="ghost" onClick={() => openHistory(a.id)} title="Verlauf">
                            <History className="w-4 h-4" />
                          </Button>
                          {allowed && (
                            <Button size="icon" variant="ghost" onClick={() => runNow(a)}
                              disabled={running === a.id} title="Jetzt ausführen">
                              <Play className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {allowed && (
                            <Button size="icon" variant="ghost" onClick={() => setEditing(a)} title="Bearbeiten">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}
                          {hasRole('Super Admin') && (
                            <Button size="icon" variant="ghost" onClick={() => remove(a)} title="Löschen">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Automation bearbeiten' : 'Neue Automation'}</DialogTitle>
            <DialogDescription>Trigger-basierte E-Mail einrichten.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Name *</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Auslöser *</Label>
                <Select value={editing.trigger_type}
                  onValueChange={v => {
                    const t = TRIGGERS.find(x => x.value === v);
                    setEditing({ ...editing, trigger_type: v, department: t?.dept ?? editing.department });
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Verzögerung</Label>
                <Select value={String(editing.delay_minutes ?? 0)}
                  onValueChange={v => setEditing({ ...editing, delay_minutes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELAYS.map(d => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vorlage *</Label>
                <Select value={editing.template_id ?? ''}
                  onValueChange={v => setEditing({ ...editing, template_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Vorlage wählen" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Absender</Label>
                <Select value={editing.sender_email ?? SENDERS[0].email}
                  onValueChange={v => {
                    const s = SENDERS.find(x => x.email === v)!;
                    setEditing({ ...editing, sender_email: v, sender_name: s.name });
                  }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SENDERS.map(s => <SelectItem key={s.email} value={s.email}>{s.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Abteilung</Label>
                <Select value={editing.department ?? 'Vertrieb'}
                  onValueChange={v => setEditing({ ...editing, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(DEPT_ROLE).map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label>Aktiv</Label>
                <Switch checked={!!editing.is_active}
                  onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Bedingung / Beschreibung</Label>
                <Textarea value={editing.description ?? ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="z.B. nur wenn Anzahlung 7 Tage offen" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyId} onOpenChange={(o) => !o && setHistoryId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ausführungsverlauf</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Ausführungen.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Bezug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fehler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">
                      {new Date(h.executed_at).toLocaleString('de-DE')}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.order_id ? `Auftrag` : h.repair_id ? 'Reparatur' : h.invoice_id ? 'Rechnung' : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{h.status}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate">{h.error_message ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
