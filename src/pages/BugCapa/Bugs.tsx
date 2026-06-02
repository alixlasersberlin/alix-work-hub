import { Fragment, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Section, BUG_STATUS, BUG_PRIORITY, BUG_CRITICALITY, statusLabel } from './_shared';
import { QmDetailDrawer } from './QmDetailDrawer';
import { Pencil, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';

type Bug = {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  product: string | null;
  module: string | null;
  software_version: string | null;
  priority: string;
  criticality: string;
  status: string;
  due_date: string | null;
  created_at: string;
};

export default function Bugs() {
  const { user, hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [rows, setRows] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bug | null>(null);
  const [detail, setDetail] = useState<Bug | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'active' | 'closed'>('active');
  const CLOSED_STATUSES = ['geschlossen', 'erledigt'];
  const visibleRows = rows.filter(r =>
    view === 'closed' ? CLOSED_STATUSES.includes(r.status) : !CLOSED_STATUSES.includes(r.status)
  );
  const [form, setForm] = useState({
    title: '', description: '', product: '', module: '', software_version: '',
    priority: 'normal', criticality: 'mittel', due_date: '',
  });

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('bugs').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error('Bugs laden fehlgeschlagen: ' + error.message);
    setRows((data ?? []) as Bug[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
    if (!user) return;
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      product: form.product || null,
      module: form.module || null,
      software_version: form.software_version || null,
      priority: form.priority,
      criticality: form.criticality,
      due_date: form.due_date || null,
      reporter_id: user.id,
      created_by: user.id,
    };
    const { data: inserted, error } = await (supabase as any)
      .from('bugs').insert(payload).select('id, ticket_number, title').single();
    if (error) { toast.error('Anlegen fehlgeschlagen: ' + error.message); return; }
    toast.success('Bug angelegt');
    setOpen(false);
    setForm({ title: '', description: '', product: '', module: '', software_version: '', priority: 'normal', criticality: 'mittel', due_date: '' });
    load();

    // Benachrichtigung an rde@alix-lasers.com mit Kopie an den Verfasser
    try {
      const reporterEmail = (user as any)?.email as string | undefined;
      const reporterName = ((user as any)?.user_metadata?.full_name as string | undefined) || reporterEmail || '';
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'bug-capa-notification',
          recipientEmail: 'rde@alix-lasers.com',
          extraCc: reporterEmail ? [reporterEmail] : [],
          skipDefaultCopies: true,
          idempotencyKey: `bug-notify-${inserted.id}`,
          templateData: {
            kind: 'Bug',
            ticketNumber: inserted.ticket_number,
            title: inserted.title,
            reporterName,
            reporterEmail,
            fields: [
              { label: 'Produkt', value: payload.product ?? '' },
              { label: 'Modul', value: payload.module ?? '' },
              { label: 'Softwareversion', value: payload.software_version ?? '' },
              { label: 'Priorität', value: payload.priority ?? '' },
              { label: 'Kritikalität', value: payload.criticality ?? '' },
              { label: 'Fälligkeit', value: payload.due_date ?? '' },
            ],
            body: payload.description ?? '',
          },
        },
      });
    } catch (e: any) {
      console.error('Bug-Notification fehlgeschlagen', e);
    }
  }

  async function setStatus(id: string, status: string) {
    const { error } = await (supabase as any).from('bugs').update({ status }).eq('id', id);
    if (error) { toast.error('Update fehlgeschlagen: ' + error.message); return; }
    load();
  }

  function startEdit(r: Bug) {
    setForm({
      title: r.title,
      description: r.description ?? '',
      product: r.product ?? '',
      module: r.module ?? '',
      software_version: r.software_version ?? '',
      priority: r.priority,
      criticality: r.criticality,
      due_date: r.due_date ?? '',
    });
    setEditing(r);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!form.title.trim()) { toast.error('Titel erforderlich'); return; }
    const { error } = await (supabase as any).from('bugs').update({
      title: form.title.trim(),
      description: form.description || null,
      product: form.product || null,
      module: form.module || null,
      software_version: form.software_version || null,
      priority: form.priority,
      criticality: form.criticality,
      due_date: form.due_date || null,
    }).eq('id', editing.id);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    toast.success('Bug aktualisiert');
    setEditing(null);
    load();
  }

  return (
    <Section
      title={`Bugs (${visibleRows.length})`}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Neuer Bug</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Neuen Bug erfassen</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Produkt</Label><Input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} /></div>
                <div><Label>Modul</Label><Input value={form.module} onChange={e => setForm({ ...form, module: e.target.value })} /></div>
                <div><Label>Softwareversion</Label><Input value={form.software_version} onChange={e => setForm({ ...form, software_version: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Priorität</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUG_PRIORITY.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kritikalität</Label>
                  <Select value={form.criticality} onValueChange={v => setForm({ ...form, criticality: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BUG_CRITICALITY.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Fälligkeit</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-3 inline-flex rounded-md border border-border p-1 bg-muted/30">
        <button
          onClick={() => setView('active')}
          className={`px-3 py-1.5 text-sm rounded ${view === 'active' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Offene ({rows.filter(r => !CLOSED_STATUSES.includes(r.status)).length})
        </button>
        <button
          onClick={() => setView('closed')}
          className={`px-3 py-1.5 text-sm rounded ${view === 'closed' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Geschlossene ({rows.filter(r => CLOSED_STATUSES.includes(r.status)).length})
        </button>
      </div>
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Produkt / Modul</TableHead>
              <TableHead>Prio</TableHead>
              <TableHead>Kritisch.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fällig</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Lade …</TableCell></TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{view === 'closed' ? 'Keine geschlossenen Bugs.' : 'Keine offenen Bugs.'}</TableCell></TableRow>
            ) : visibleRows.map(r => (
              <Fragment key={r.id}>
              <TableRow>
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-1">
                    {r.description ? (
                      <button
                        onClick={() => setExpanded(p => ({ ...p, [r.id]: !p[r.id] }))}
                        className="text-muted-foreground hover:text-foreground"
                        title={expanded[r.id] ? 'Beschreibung einklappen' : 'Beschreibung ausklappen'}
                      >
                        {expanded[r.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    ) : <span className="w-4 inline-block" />}
                    <span>{r.ticket_number}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{[r.product, r.module].filter(Boolean).join(' / ') || '—'}</TableCell>
                <TableCell><StatusBadge status={r.priority} /></TableCell>
                <TableCell><StatusBadge status={r.criticality} /></TableCell>
                <TableCell><StatusBadge status={statusLabel(r.status)} /></TableCell>
                <TableCell className="text-sm">{r.due_date ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isSuperAdmin ? (
                      <>
                        <Select value={r.status} onValueChange={v => setStatus(r.id, v)}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{BUG_STATUS.map(s => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(r)} title="Bearbeiten">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {r.status !== 'erledigt' && r.status !== 'geschlossen' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={() => setStatus(r.id, 'erledigt')} title="Als gelöst markieren">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : null}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetail(r)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {r.description && expanded[r.id] && (
                <TableRow key={r.id + '-desc'} className="bg-muted/30 hover:bg-muted/30">
                  <TableCell></TableCell>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground whitespace-pre-wrap break-words py-3">
                    {r.description}
                  </TableCell>
                </TableRow>
              )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <QmDetailDrawer
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        entityType="bug"
        entityId={detail?.id ?? null}
        title={detail ? `${detail.ticket_number} – ${detail.title}` : ''}
      />
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bug bearbeiten {editing?.ticket_number}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Titel *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Produkt</Label><Input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} /></div>
              <div><Label>Modul</Label><Input value={form.module} onChange={e => setForm({ ...form, module: e.target.value })} /></div>
              <div><Label>Softwareversion</Label><Input value={form.software_version} onChange={e => setForm({ ...form, software_version: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUG_PRIORITY.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kritikalität</Label>
                <Select value={form.criticality} onValueChange={v => setForm({ ...form, criticality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BUG_CRITICALITY.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Fälligkeit</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={saveEdit}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
