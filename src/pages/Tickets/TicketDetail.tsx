import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, MessageSquare, Paperclip, Save, Send, Wrench, Truck, Banknote, ClipboardList } from 'lucide-react';
import { sbRepair } from '@/lib/repair/api';

interface Ticket {
  id: string;
  external_ticket_id: string | null;
  source_system: string | null;
  customer_name: string | null;
  company_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  order_number: string | null;
  device_name: string | null;
  serial_number: string | null;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  department: string;
  assigned_to: string | null;
  customer_visible_status: string;
  internal_note: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
interface Msg {
  id: string;
  sender_type: string | null;
  sender_name: string | null;
  sender_email: string | null;
  message: string | null;
  is_internal: boolean;
  source_system: string | null;
  created_at: string;
}
interface Att {
  id: string;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

const STATUS = ['offen', 'in_bearbeitung', 'wartet_kunde', 'gelöst', 'geschlossen'];
const PRIORITY = ['niedrig', 'normal', 'hoch', 'kritisch'];
const DEPARTMENT = ['service', 'technik', 'finance', 'tourenplanung', 'lieferung', 'abholung', 'austausch'];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, hasAnyRole } = useAuth();
  const canEdit = isAdmin || hasAnyRole(['Kundenservice', 'Technik']);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [attachments, setAttachments] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [msgInternal, setMsgInternal] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [t, m, a] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
      supabase.from('ticket_attachments').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
    ]);
    if (t.error) { console.error(t.error); toast.error('Ticket nicht gefunden'); }
    setTicket((t.data as Ticket) || null);
    setMessages((m.data as Msg[]) || []);
    setAttachments((a.data as Att[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function patch(updates: Partial<Ticket>) {
    if (!ticket) return;
    setSaving(true);
    const { error } = await supabase.from('tickets').update(updates).eq('id', ticket.id);
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    setTicket({ ...ticket, ...updates });
    toast.success('Gespeichert');
  }

  async function addMessage() {
    if (!ticket || !newMsg.trim()) return;
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'agent',
      sender_name: user?.email || 'Mitarbeiter',
      sender_email: user?.email || null,
      message: newMsg.trim(),
      is_internal: msgInternal,
      source_system: 'alixwork',
    });
    if (error) { toast.error(error.message); return; }
    setNewMsg('');
    toast.success(msgInternal ? 'Interne Notiz hinzugefügt' : 'Nachricht hinzugefügt');
    load();
  }

  async function handover(dept: string, statusLabel: string) {
    await patch({ department: dept, customer_visible_status: statusLabel });
  }

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!ticket) return <div className="p-8">Ticket nicht gefunden. <Link to="/tickets" className="underline">Zurück</Link></div>;

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {ticket.title || ticket.external_ticket_id || 'Ticket'}
          </h1>
          <Badge variant="outline">{ticket.external_ticket_id || ticket.id.slice(0, 8)}</Badge>
          <Badge variant="outline">{ticket.source_system}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Letzter Sync: {ticket.last_synced_at ? new Date(ticket.last_synced_at).toLocaleString('de-DE') : '—'}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Linke Spalte */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kunde + Gerät */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Kunde & Gerät</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Kunde" value={ticket.customer_name} />
              <Info label="Firma" value={ticket.company_name} />
              <Info label="E-Mail" value={ticket.customer_email} />
              <Info label="Telefon" value={ticket.customer_phone} />
              <Info label="Adresse" value={ticket.customer_address} className="sm:col-span-2" />
              <Info label="Auftragsnummer" value={ticket.order_number} />
              <Info label="Gerät" value={ticket.device_name} />
              <Info label="Seriennummer" value={ticket.serial_number} />
            </div>
          </div>

          {/* Beschreibung */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Fehlerbeschreibung</h2>
            <p className="text-sm whitespace-pre-wrap text-foreground">{ticket.description || '—'}</p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="messages" className="w-full">
            <TabsList>
              <TabsTrigger value="messages"><MessageSquare className="w-4 h-4 mr-1" /> Nachrichten ({messages.length})</TabsTrigger>
              <TabsTrigger value="attachments"><Paperclip className="w-4 h-4 mr-1" /> Anhänge ({attachments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="messages" className="space-y-3">
              {messages.length === 0 && <div className="text-sm text-muted-foreground p-4">Noch keine Nachrichten.</div>}
              {messages.map(m => (
                <div key={m.id} className={`rounded-lg border p-3 ${m.is_internal ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-background'}`}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-medium text-foreground">{m.sender_name || m.sender_email || m.sender_type || 'Unbekannt'}</span>
                    <span>{new Date(m.created_at).toLocaleString('de-DE')}{m.is_internal && ' · intern'}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                </div>
              ))}
              {canEdit && (
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <Textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Nachricht oder interne Notiz..." rows={3} />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={msgInternal} onChange={e => setMsgInternal(e.target.checked)} />
                      Als interne Notiz speichern
                    </label>
                    <Button size="sm" onClick={addMessage} disabled={!newMsg.trim()}>
                      <Send className="w-4 h-4 mr-1" /> Senden
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="attachments" className="space-y-2">
              {attachments.length === 0 && <div className="text-sm text-muted-foreground p-4">Keine Anhänge.</div>}
              {attachments.map(a => (
                <a key={a.id} href={a.file_url || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    {a.file_name || a.file_url}
                  </div>
                  <span className="text-xs text-muted-foreground">{a.file_type || ''}</span>
                </a>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* Rechte Spalte: Aktionen */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bearbeitung</h2>
            <div className="space-y-3">
              <Field label="Status">
                <Select value={ticket.status} onValueChange={v => patch({ status: v })} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Priorität">
                <Select value={ticket.priority} onValueChange={v => patch({ priority: v })} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Abteilung">
                <Select value={ticket.department} onValueChange={v => patch({ department: v })} disabled={!canEdit || saving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Kundensichtbarer Status">
                <Input
                  defaultValue={ticket.customer_visible_status}
                  disabled={!canEdit || saving}
                  onBlur={e => { if (e.target.value !== ticket.customer_visible_status) patch({ customer_visible_status: e.target.value }); }}
                />
              </Field>
              <Field label="Interne Notiz">
                <Textarea
                  defaultValue={ticket.internal_note || ''}
                  rows={3}
                  disabled={!canEdit || saving}
                  onBlur={e => { if (e.target.value !== (ticket.internal_note || '')) patch({ internal_note: e.target.value }); }}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Übergaben</h2>
            <Button variant="outline" className="w-full justify-start" disabled={!canEdit}
              onClick={() => handover('technik', 'Arbeitsauftrag erstellt')}>
              <Wrench className="w-4 h-4 mr-2" /> Arbeitsauftrag erstellen
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled={!canEdit} asChild>
              <Link to="/reparatur/neu"><ClipboardList className="w-4 h-4 mr-2" /> Reparaturannahme erstellen</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled={!canEdit}
              onClick={() => handover('finance', 'An Finance übergeben')}>
              <Banknote className="w-4 h-4 mr-2" /> Finance übergeben
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled={!canEdit}
              onClick={() => handover('tourenplanung', 'An Tourenplanung übergeben')}>
              <Truck className="w-4 h-4 mr-2" /> Tourenplanung übergeben
            </Button>
          </div>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg px-4 py-2 text-sm flex items-center gap-2 shadow-lg">
          <Save className="w-4 h-4 animate-pulse" /> Speichert...
        </div>
      )}
    </div>
  );
}

function Info({ label, value, className = '' }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm text-foreground mt-1">{value || '—'}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      {children}
    </div>
  );
}
