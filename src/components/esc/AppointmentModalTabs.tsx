import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EscAppointment, EscDepartment, EscEmployee, EscPriority, EscResource, EscStatus } from '@/lib/esc/types';
import { ESC_STATUS_LABELS } from './StatusBadge';
import { toast } from 'sonner';
import { downloadIcs } from '@/lib/esc/ics';
import { publicUrl } from '@/lib/esc/public-url';
import { Download, Mail, Save, Trash2, XCircle, CheckCircle2, MoveRight, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const PRIORITY: EscPriority[] = ['low', 'normal', 'high', 'urgent'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onCancelAppointment?: (id: string) => Promise<void> | void;
  onComplete?: (id: string) => Promise<void> | void;
  departments: EscDepartment[];
  employees: EscEmployee[];
  resources: EscResource[];
  initial?: Partial<EscAppointment>;
  defaultStart?: Date;
  canSeeInternal: boolean;
  history?: { at: string; by: string; action: string; detail?: string }[];
}

function toInputDate(d: Date | string | undefined) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const p = (n: number) => (n < 10 ? `0${n}` : n);
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export function AppointmentModalTabs({
  open, onClose, onSubmit, onDelete, onCancelAppointment, onComplete,
  departments, employees, resources, initial, defaultStart, canSeeInternal, history = [],
}: Props) {
  const start = defaultStart || (initial?.startAt ? new Date(initial.startAt) : new Date());
  const end = initial?.endAt ? new Date(initial.endAt) : new Date(start.getTime() + 60 * 60_000);

  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    departmentId: initial?.departmentId || departments[0]?.id || '',
    kind: initial?.kind || '',
    employeeIds: (initial?.employeeIds || []) as string[],
    responsibleEmployeeId: (initial?.employeeIds || [])[0] || '',
    externalParticipants: [] as { name: string; email: string; phone: string; type: 'kunde' | 'partner' | 'gast'; confirmationRequired: boolean }[],
    resourceId: initial?.resourceId || '',
    resourceIds: initial?.resourceId ? [initial.resourceId] : [] as string[],
    customerName: initial?.customerName || '',
    customerContact: initial?.customerContact || '',
    customerEmail: initial?.customerEmail || '',
    customerPhone: initial?.customerPhone || '',
    address: initial?.address || '',
    location: initial?.location || '',
    room: initial?.room || '',
    allDay: false,
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
    emailTemplate: 'standard',
    emailLanguage: 'de',
    linkValidDays: 14,
    recurrence: (initial?.recurrence || 'none') as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom',
    recurrenceInterval: 1,
    recurrenceWeekdays: [] as number[],
    recurrenceUntil: '',
    recurrenceCount: 0,
    attachments: [] as { name: string; size: number }[],
  });

  useEffect(() => {
    if (!open) return;
    setTab('general');
    setForm((f) => ({
      ...f,
      startAt: toInputDate(defaultStart || (initial?.startAt ? new Date(initial.startAt) : new Date())),
      endAt: toInputDate(initial?.endAt ? new Date(initial.endAt) : new Date((defaultStart || new Date()).getTime() + 60 * 60_000)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const previewLink = useMemo(
    () => publicUrl(`/termin-bestaetigen/${initial?.confirmationToken || 'PREVIEW-TOKEN'}`),
    [initial?.confirmationToken],
  );

  const toggleEmployee = (id: string) =>
    setForm((f) => ({ ...f, employeeIds: f.employeeIds.includes(id) ? f.employeeIds.filter((x) => x !== id) : [...f.employeeIds, id] }));
  const toggleResource = (id: string) =>
    setForm((f) => ({ ...f, resourceIds: f.resourceIds.includes(id) ? f.resourceIds.filter((x) => x !== id) : [...f.resourceIds, id], resourceId: id }));

  const addExternal = () => setForm((f) => ({ ...f, externalParticipants: [...f.externalParticipants, { name: '', email: '', phone: '', type: 'gast', confirmationRequired: false }] }));

  const buildPayload = (): Omit<EscAppointment, 'id' | 'createdAt' | 'updatedAt'> => ({
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
    resourceId: form.resourceIds[0],
    status: form.status,
    priority: form.priority,
    internalNote: form.internalNote,
    externalNote: form.externalNote,
    confirmationRequired: form.confirmationRequired,
    reminderMinutes: form.reminderMinutes,
    recurrence: form.recurrence === 'yearly' || form.recurrence === 'custom' ? 'none' : form.recurrence,
  });

  const handleSubmit = async (opts?: { sendEmail?: boolean }) => {
    if (!form.title.trim()) { toast.error('Bitte Titel angeben'); return; }
    if (!form.departmentId) { toast.error('Bitte Abteilung wählen'); return; }
    if (!form.kind.trim()) { toast.error('Bitte Terminart angeben'); return; }
    if (!form.startAt || !form.endAt) { toast.error('Bitte Start und Ende angeben'); return; }
    if (new Date(form.endAt) <= new Date(form.startAt)) { toast.error('Ende muss nach Start liegen'); return; }

    const payload = buildPayload();
    await onSubmit(payload);
    if (form.attachIcs) downloadIcs({ ...payload, id: initial?.id || 'preview', createdAt: '', updatedAt: '' } as EscAppointment);
    if (form.sendEmail || opts?.sendEmail) toast.info('E-Mail-Versand wird über die Bestätigungs-Edge-Function ausgeführt.');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initial?.id ? 'Termin bearbeiten' : 'Neuer Termin'}
            {initial?.status && <Badge variant="outline" className="text-[10px]">{ESC_STATUS_LABELS[initial.status as EscStatus] || initial.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
            <TabsTrigger value="general">Allgemein</TabsTrigger>
            <TabsTrigger value="participants">Teilnehmer</TabsTrigger>
            <TabsTrigger value="customer">Kunde</TabsTrigger>
            <TabsTrigger value="resources">Ressourcen</TabsTrigger>
            <TabsTrigger value="recurrence">Wiederholung</TabsTrigger>
            <TabsTrigger value="confirmation">Bestätigung</TabsTrigger>
            <TabsTrigger value="notes">Notizen</TabsTrigger>
            <TabsTrigger value="attachments">Anhänge</TabsTrigger>
            <TabsTrigger value="history">Verlauf</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-2">
            <TabsContent value="general" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <Label>Terminart *</Label>
                  <Input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} placeholder="z. B. Demo, Reparatur" />
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
                <div>
                  <Label>Start *</Label>
                  <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
                </div>
                <div>
                  <Label>Ende *</Label>
                  <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <Checkbox checked={form.allDay} onCheckedChange={(v) => setForm({ ...form, allDay: !!v })} />
                  Ganztägig
                </label>
                <div>
                  <Label>Standort</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="z. B. Stuttgart" />
                </div>
                <div>
                  <Label>Adresse</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Beschreibung</Label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="participants" className="mt-3 space-y-4">
              <section>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Interne Teilnehmer</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {employees.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Checkbox checked={form.employeeIds.includes(e.id)} onCheckedChange={() => toggleEmployee(e.id)} />
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: e.color || 'hsl(var(--primary))' }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{e.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{e.role}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {form.employeeIds.length > 0 && (
                  <div className="mt-3">
                    <Label>Verantwortlicher Mitarbeiter</Label>
                    <Select value={form.responsibleEmployeeId} onValueChange={(v) => setForm({ ...form, responsibleEmployeeId: v })}>
                      <SelectTrigger><SelectValue placeholder="Wählen…" /></SelectTrigger>
                      <SelectContent>
                        {form.employeeIds.map((id) => {
                          const e = employees.find((x) => x.id === id);
                          return <SelectItem key={id} value={id}>{e?.name || id}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </section>

              <section className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Externe Teilnehmer</div>
                  <Button size="sm" variant="outline" onClick={addExternal}>+ Hinzufügen</Button>
                </div>
                {form.externalParticipants.length === 0 && <div className="text-[12px] text-muted-foreground">Keine externen Teilnehmer.</div>}
                <div className="space-y-2">
                  {form.externalParticipants.map((p, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 border rounded-md p-2 bg-muted/30">
                      <Select value={p.type} onValueChange={(v) => {
                        const arr = [...form.externalParticipants]; arr[i] = { ...arr[i], type: v as any }; setForm({ ...form, externalParticipants: arr });
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kunde">Kunde</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="gast">Gast</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className="h-8 text-xs" placeholder="Name" value={p.name} onChange={(e) => { const a = [...form.externalParticipants]; a[i] = { ...a[i], name: e.target.value }; setForm({ ...form, externalParticipants: a }); }} />
                      <Input className="h-8 text-xs" placeholder="E-Mail" value={p.email} onChange={(e) => { const a = [...form.externalParticipants]; a[i] = { ...a[i], email: e.target.value }; setForm({ ...form, externalParticipants: a }); }} />
                      <Input className="h-8 text-xs" placeholder="Telefon" value={p.phone} onChange={(e) => { const a = [...form.externalParticipants]; a[i] = { ...a[i], phone: e.target.value }; setForm({ ...form, externalParticipants: a }); }} />
                      <label className="flex items-center gap-2 text-[11px]">
                        <Checkbox checked={p.confirmationRequired} onCheckedChange={(v) => { const a = [...form.externalParticipants]; a[i] = { ...a[i], confirmationRequired: !!v }; setForm({ ...form, externalParticipants: a }); }} />
                        Bestätigung
                      </label>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="customer" className="mt-3 space-y-3">
              <div>
                <Label>Kundenname</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Kunde suchen oder eingeben…" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Ansprechpartner</Label><Input value={form.customerContact} onChange={(e) => setForm({ ...form, customerContact: e.target.value })} /></div>
                <div><Label>E-Mail</Label><Input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} /></div>
                <div><Label>Telefon</Label><Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} /></div>
                <div><Label>Raum</Label><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
              </div>
              {form.customerName && (
                <div className="rounded-md border p-3 bg-muted/30 text-[12px] text-muted-foreground">
                  Verknüpfung zu Kunden-, Geräte-, Ticket- und Auftragshistorie erfolgt schreibgeschützt aus den bestehenden AlixWorks-Modulen.
                </div>
              )}
            </TabsContent>

            <TabsContent value="resources" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {resources.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox checked={form.resourceIds.includes(r.id)} onCheckedChange={() => toggleResource(r.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.type}{r.location ? ` · ${r.location}` : ''}{r.capacity ? ` · ${r.capacity} Plätze` : ''}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">Konfliktprüfung läuft automatisch beim Speichern.</div>
            </TabsContent>

            <TabsContent value="recurrence" className="mt-3 space-y-3">
              <div>
                <Label>Wiederholung</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine</SelectItem>
                    <SelectItem value="daily">Täglich</SelectItem>
                    <SelectItem value="weekly">Wöchentlich</SelectItem>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                    <SelectItem value="yearly">Jährlich</SelectItem>
                    <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.recurrence !== 'none' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Intervall</Label>
                    <Input type="number" min={1} value={form.recurrenceInterval} onChange={(e) => setForm({ ...form, recurrenceInterval: Number(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <Label>Enddatum</Label>
                    <Input type="date" value={form.recurrenceUntil} onChange={(e) => setForm({ ...form, recurrenceUntil: e.target.value })} />
                  </div>
                  <div>
                    <Label>Anzahl (optional)</Label>
                    <Input type="number" min={0} value={form.recurrenceCount} onChange={(e) => setForm({ ...form, recurrenceCount: Number(e.target.value) || 0 })} />
                  </div>
                  {form.recurrence === 'weekly' && (
                    <div className="md:col-span-3">
                      <Label>Wochentage</Label>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => {
                          const dayNum = i + 1;
                          const active = form.recurrenceWeekdays.includes(dayNum);
                          return (
                            <Button key={d} type="button" variant={active ? 'default' : 'outline'} size="sm" className="h-7 w-9 p-0 text-[11px]"
                              onClick={() => setForm({ ...form, recurrenceWeekdays: active ? form.recurrenceWeekdays.filter((x) => x !== dayNum) : [...form.recurrenceWeekdays, dayNum] })}>
                              {d}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="confirmation" className="mt-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.confirmationRequired} onCheckedChange={(v) => setForm({ ...form, confirmationRequired: !!v })} />
                  Bestätigung erforderlich
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.sendEmail} onCheckedChange={(v) => setForm({ ...form, sendEmail: !!v })} />
                  E-Mail an Kunde senden
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.attachIcs} onCheckedChange={(v) => setForm({ ...form, attachIcs: !!v })} />
                  ICS-Datei anhängen / herunterladen
                </label>
                <div>
                  <Label>Erinnerung (Minuten)</Label>
                  <Input type="number" min={0} value={form.reminderMinutes} onChange={(e) => setForm({ ...form, reminderMinutes: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Link gültig (Tage)</Label>
                  <Input type="number" min={1} value={form.linkValidDays} onChange={(e) => setForm({ ...form, linkValidDays: Number(e.target.value) || 14 })} />
                </div>
                <div>
                  <Label>Vorlage</Label>
                  <Select value={form.emailTemplate} onValueChange={(v) => setForm({ ...form, emailTemplate: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="reminder">Erinnerung</SelectItem>
                      <SelectItem value="reschedule">Verschiebung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sprache</Label>
                  <Select value={form.emailLanguage} onValueChange={(v) => setForm({ ...form, emailLanguage: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="en">Englisch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-md border p-3 bg-muted/30">
                <div className="text-[12px] font-semibold mb-1">Vorschau</div>
                <div className="text-[12px] text-muted-foreground">
                  Guten Tag {form.customerContact || form.customerName || 'Kunde'},<br />
                  bitte bestätigen Sie Ihren Termin <b>{form.title || '(Titel)'}</b> am {form.startAt ? format(new Date(form.startAt), 'dd.MM.yyyy HH:mm', { locale: de }) : '(Datum)'}.
                </div>
                <div className="mt-2 text-[12px]">
                  Bestätigungslink: <a href={previewLink} target="_blank" rel="noreferrer" className="text-primary underline break-all">{previewLink}</a>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-3 space-y-3">
              {canSeeInternal ? (
                <div>
                  <Label>Interne Notiz</Label>
                  <Textarea rows={4} value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} />
                  <div className="text-[11px] text-muted-foreground mt-1">Nur für berechtigte Benutzer sichtbar.</div>
                </div>
              ) : (
                <div className="text-[12px] text-muted-foreground italic">Keine Berechtigung, interne Notizen zu sehen.</div>
              )}
              <div>
                <Label>Externe Notiz</Label>
                <Textarea rows={4} value={form.externalNote} onChange={(e) => setForm({ ...form, externalNote: e.target.value })} />
                <div className="text-[11px] text-muted-foreground mt-1">Kann in Bestätigungs-E-Mails und im Buchungsportal erscheinen.</div>
              </div>
            </TabsContent>

            <TabsContent value="attachments" className="mt-3 space-y-3">
              <label className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 cursor-pointer hover:bg-accent/20">
                <Paperclip className="w-5 h-5 text-muted-foreground" />
                <span className="text-[12.5px] text-muted-foreground">PDF, JPG, PNG, DOCX, XLSX auswählen</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: f.size }));
                    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...files] }));
                  }}
                />
              </label>
              {form.attachments.length > 0 && (
                <ul className="space-y-1 text-[12.5px]">
                  {form.attachments.map((a, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border px-2 py-1">
                      <span className="truncate">{a.name}</span>
                      <span className="text-muted-foreground text-[11px]">{Math.round(a.size / 1024)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-[11px] text-muted-foreground">Upload wird in einer folgenden Phase an den Supabase Storage angebunden.</div>
            </TabsContent>

            <TabsContent value="history" className="mt-3">
              {history.length === 0 ? (
                <div className="text-[12px] text-muted-foreground">Keine Historie vorhanden.</div>
              ) : (
                <ul className="space-y-1.5 text-[12px]">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 border-b pb-1.5">
                      <span className="text-muted-foreground w-32 shrink-0">{format(new Date(h.at), 'dd.MM.yyyy HH:mm')}</span>
                      <span className="font-medium">{h.action}</span>
                      <span className="text-muted-foreground truncate">{h.by}{h.detail ? ` · ${h.detail}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="gap-2 flex-wrap">
          {initial?.id && onDelete && (
            <Button variant="ghost" className="text-destructive mr-auto" onClick={async () => { await onDelete(initial.id!); onClose(); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Löschen
            </Button>
          )}
          {initial?.id && (
            <Button variant="outline" onClick={() => downloadIcs({ ...buildPayload(), id: initial.id!, createdAt: '', updatedAt: '' } as EscAppointment)}>
              <Download className="w-4 h-4 mr-1" /> ICS
            </Button>
          )}
          {initial?.id && onCancelAppointment && (
            <Button variant="outline" onClick={async () => { await onCancelAppointment(initial.id!); onClose(); }}>
              <XCircle className="w-4 h-4 mr-1" /> Stornieren
            </Button>
          )}
          {initial?.id && onComplete && (
            <Button variant="outline" onClick={async () => { await onComplete(initial.id!); onClose(); }}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Abschließen
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="outline" onClick={() => handleSubmit({ sendEmail: true })}>
            <Mail className="w-4 h-4 mr-1" /> Speichern &amp; E-Mail
          </Button>
          <Button onClick={() => handleSubmit()}>
            <Save className="w-4 h-4 mr-1" /> Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
