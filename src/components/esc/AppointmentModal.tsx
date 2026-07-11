import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { EscAppointment, EscDepartment, EscEmployee, EscPriority, EscStatus } from '@/lib/esc/types';
import { ESC_STATUS_LABELS } from './StatusBadge';
import { toast } from 'sonner';
import { downloadIcs } from '@/lib/esc/ics';
import { Sparkles, Loader2, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { findConflicts } from '@/lib/esc/conflicts';
import { useAppointments } from '@/hooks/esc/useAppointments';

interface AiSuggestion {
  start_at: string;
  end_at: string;
  employee_id?: string | null;
  employee_name?: string;
  reason?: string;
  score?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
  departments: EscDepartment[];
  employees: EscEmployee[];
  initial?: Partial<EscAppointment>;
  defaultStart?: Date;
}

const PRIORITY: EscPriority[] = ['low', 'normal', 'high', 'urgent'];

type EntryType = 'termin' | 'erinnerung' | 'wiedervorlage';

const ENTRY_TYPES: { value: EntryType; label: string; kind: string }[] = [
  { value: 'termin', label: 'Termin', kind: '' },
  { value: 'erinnerung', label: 'Erinnerung (intern)', kind: 'Erinnerung' },
  { value: 'wiedervorlage', label: 'Wiedervorlage (intern)', kind: 'Wiedervorlage' },
];

function detectEntryType(kind?: string): EntryType {
  const k = (kind || '').toLowerCase();
  if (k.startsWith('erinnerung')) return 'erinnerung';
  if (k.startsWith('wiedervorlage')) return 'wiedervorlage';
  return 'termin';
}

function toInputDate(d: Date | string | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => (n < 10 ? `0${n}` : n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function AppointmentModal({ open, onClose, onSubmit, departments, employees, initial, defaultStart }: Props) {
  const start = defaultStart || (initial?.startAt ? new Date(initial.startAt) : new Date());
  const end = initial?.endAt ? new Date(initial.endAt) : new Date(start.getTime() + 60 * 60_000);

  const [entryType, setEntryType] = useState<EntryType>(detectEntryType(initial?.kind));
  const isInternal = entryType !== 'termin';

  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    departmentId: initial?.departmentId || departments[0]?.id || '',
    kind: initial?.kind || '',
    employeeIds: initial?.employeeIds || [],
    customerName: initial?.customerName || '',
    customerContact: initial?.customerContact || '',
    customerEmail: initial?.customerEmail || '',
    customerPhone: initial?.customerPhone || '',
    address: initial?.address || '',
    location: initial?.location || '',
    room: initial?.room || '',
    startAt: toInputDate(start),
    endAt: toInputDate(end),
    status: (initial?.status || 'geplant') as EscStatus,
    priority: (initial?.priority || 'normal') as EscPriority,
    internalNote: initial?.internalNote || '',
    externalNote: initial?.externalNote || '',
    confirmationRequired: initial?.confirmationRequired ?? false,
    reminderMinutes: initial?.reminderMinutes ?? 60,
    sendEmail: false,
    attachIcs: false,
  });

  const handleEntryTypeChange = (t: EntryType) => {
    setEntryType(t);
    const def = ENTRY_TYPES.find((e) => e.value === t)!;
    setForm((f) => ({
      ...f,
      kind: t === 'termin' ? (detectEntryType(f.kind) === 'termin' ? f.kind : '') : def.kind,
      // internal entries: strip customer-facing data
      ...(t !== 'termin'
        ? {
            customerName: '',
            customerContact: '',
            customerEmail: '',
            customerPhone: '',
            externalNote: '',
            confirmationRequired: false,
            sendEmail: false,
          }
        : {}),
    }));
  };

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({
      ...f,
      startAt: toInputDate(defaultStart || (initial?.startAt ? new Date(initial.startAt) : new Date())),
      endAt: toInputDate(initial?.endAt ? new Date(initial.endAt) : new Date((defaultStart || new Date()).getTime() + 60 * 60_000)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const { appointments: allAppointments } = useAppointments();

  const conflicts = useMemo(() => {
    if (!form.startAt || !form.endAt) return [];
    try {
      return findConflicts(
        {
          id: initial?.id || 'new',
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          employeeIds: form.employeeIds,
          departmentId: form.departmentId,
        },
        allAppointments,
        { employees: employees.map((e) => ({ id: e.id, name: e.name })) },
      );
    } catch { return []; }
  }, [form.startAt, form.endAt, form.employeeIds, form.departmentId, allAppointments, employees, initial?.id]);

  const runAiSuggest = async () => {
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const startMs = new Date(form.startAt).getTime();
      const endMs = new Date(form.endAt).getTime();
      const duration = Math.max(15, Math.round((endMs - startMs) / 60000)) || 60;
      const { data, error } = await supabase.functions.invoke('esc-ai-suggest', {
        body: {
          title: form.title,
          kind: form.kind,
          duration_minutes: duration,
          department_id: form.departmentId,
          customer_name: form.customerName,
          address: form.address,
          preferred_from: new Date(form.startAt).toISOString(),
        },
      });
      if (error) throw error;
      const list: AiSuggestion[] = (data as any)?.suggestions || [];
      if (!list.length) toast.info('Keine Vorschläge gefunden');
      setAiSuggestions(list);
    } catch (e: any) {
      console.error(e);
      toast.error('KI-Vorschlag fehlgeschlagen: ' + (e?.message || e));
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (s: AiSuggestion) => {
    setForm((f) => ({
      ...f,
      startAt: toInputDate(new Date(s.start_at)),
      endAt: toInputDate(new Date(s.end_at)),
      employeeIds: s.employee_id ? [s.employee_id] : f.employeeIds,
    }));
    toast.success('Vorschlag übernommen');
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Bitte Titel angeben'); return; }
    if (!form.departmentId) { toast.error('Bitte Abteilung wählen'); return; }
    const payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'> = {
      title: form.title,
      description: form.description,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      departmentId: form.departmentId,
      kind: form.kind,
      employeeIds: form.employeeIds,
      customerName: form.customerName,
      customerContact: form.customerContact,
      customerEmail: form.customerEmail,
      customerPhone: form.customerPhone,
      address: form.address,
      location: form.location,
      room: form.room,
      status: form.status,
      priority: form.priority,
      internalNote: form.internalNote,
      externalNote: form.externalNote,
      confirmationRequired: form.confirmationRequired,
      reminderMinutes: form.reminderMinutes,
    };
    await onSubmit(payload);
    if (form.attachIcs) {
      downloadIcs({ ...payload, id: 'preview', createdAt: '', updatedAt: '' } as EscAppointment);
    }
    if (form.sendEmail) {
      toast.info('E-Mail-Versand wird in Prompt 2 aktiviert (Edge Function esc-send-confirmation-email).');
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{initial?.id ? `${ENTRY_TYPES.find(e=>e.value===entryType)!.label.replace(' (intern)','')} bearbeiten` : `Neu: ${ENTRY_TYPES.find(e=>e.value===entryType)!.label}`}</span>
            <Button type="button" size="sm" variant="outline" onClick={runAiSuggest} disabled={aiLoading} className="gap-1.5">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
              KI-Vorschlag
            </Button>
          </DialogTitle>
        </DialogHeader>

        {aiSuggestions.length > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> KI-Vorschläge
            </div>
            {aiSuggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded border bg-background p-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {new Date(s.start_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                    {' → '}
                    {new Date(s.end_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{s.employee_name}
                    {typeof s.score === 'number' && <span className="ml-2 text-xs text-muted-foreground">Score {s.score}</span>}
                  </div>
                  {s.reason && <div className="text-xs text-muted-foreground mt-0.5">{s.reason}</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => applySuggestion(s)} className="gap-1">
                  <Check className="w-3.5 h-3.5" /> Übernehmen
                </Button>
              </div>
            ))}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" /> {conflicts.length} Konflikt(e) erkannt
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {conflicts.slice(0, 4).map((c, i) => (
                <li key={i}>
                  · {c.kind === 'employee' ? 'Mitarbeiter' : c.kind === 'resource' ? 'Ressource' : 'Abteilung'} „{c.refLabel}" belegt durch „{c.otherAppointment.title}"
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">



          <div className="md:col-span-2">
            <Label>Titel *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div>
            <Label>Abteilung *</Label>
            <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
              <SelectTrigger><SelectValue placeholder="Abteilung wählen" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Terminart</Label>
            <Input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="z. B. Demo, Reparatur" />
          </div>

          <div>
            <Label>Start</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          </div>
          <div>
            <Label>Ende</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          </div>

          <div>
            <Label>Kunde</Label>
            <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div>
            <Label>Ansprechpartner</Label>
            <Input value={form.customerContact} onChange={(e) => setForm({ ...form, customerContact: e.target.value })} />
          </div>
          <div>
            <Label>E-Mail</Label>
            <Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          </div>

          <div>
            <Label>Adresse</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Standort / Raum</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Standort" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <Input placeholder="Raum" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EscStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ESC_STATUS_LABELS) as EscStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ESC_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priorität</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as EscPriority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Beschreibung / externe Notiz</Label>
            <Textarea rows={2} value={form.externalNote} onChange={(e) => setForm({ ...form, externalNote: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Interne Notiz</Label>
            <Textarea rows={2} value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-4 pt-2 border-t">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.confirmationRequired} onCheckedChange={(v) => setForm({ ...form, confirmationRequired: !!v })} />
              Bestätigung durch Kunde erforderlich
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.sendEmail} onCheckedChange={(v) => setForm({ ...form, sendEmail: !!v })} />
              E-Mail an Kunde senden
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.attachIcs} onCheckedChange={(v) => setForm({ ...form, attachIcs: !!v })} />
              ICS-Kalenderdatei herunterladen
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSubmit}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
