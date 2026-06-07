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
import { ArrowLeft, Loader2, MessageSquare, Paperclip, Save, Send, Wrench, Truck, Banknote, ClipboardList, RefreshCw, History, CheckCircle2, AlertCircle, Lock, Unlock, Upload, UserPlus, Flag, Activity } from 'lucide-react';
import { sbRepair } from '@/lib/repair/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AiAnalysisPanel } from '@/components/ai-service/AiAnalysisPanel';

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
  last_outbound_sync_at: string | null;
  created_at: string;
  updated_at: string;
  repair_order_id: string | null;
  auto_category?: string | null;
  auto_priority?: string | null;
  suggested_technician_id?: string | null;
  sla_status?: string | null;
}
interface LinkedRepair {
  id: string;
  repair_number: string | null;
  repair_status: string | null;
}
interface OutboundLog {
  id: string;
  action: string;
  status: string;
  error_message: string | null;
  payload: any;
  created_at: string;
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
  const canEdit = isAdmin || hasAnyRole(['Kundenservice', 'Technik', 'Service', 'Reparaturannahme', 'Order']);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [attachments, setAttachments] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [msgInternal, setMsgInternal] = useState(true);
  const [outboundLogs, setOutboundLogs] = useState<OutboundLog[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linkedRepair, setLinkedRepair] = useState<LinkedRepair | null>(null);
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  async function loadLinkedRepair(repairId: string | null) {
    if (!repairId) { setLinkedRepair(null); return; }
    const { data } = await sbRepair
      .from('repair_orders')
      .select('id, repair_number, repair_status')
      .eq('id', repairId)
      .maybeSingle();
    setLinkedRepair((data as LinkedRepair) || null);
  }

  async function loadOutboundLogs() {
    if (!id) return;
    const { data } = await supabase
      .from('ticket_outbound_sync_logs')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    setOutboundLogs((data as OutboundLog[]) || []);
  }

  async function syncToAlixSmart(action: string, message_id?: string | null) {
    if (!ticket?.external_ticket_id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-to-alixsmart', {
        body: { ticket_id: ticket.id, action, message_id: message_id || null },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success('An AlixSmart übertragen');
        setTicket(t => t ? { ...t, last_outbound_sync_at: new Date().toISOString() } : t);
      } else if (data?.skipped) {
        toast.info('Sync übersprungen: ' + data.skipped);
      } else {
        toast.error('Sync-Fehler: ' + (data?.error || 'unbekannt'));
      }
    } catch (e: any) {
      toast.error('Sync-Fehler: ' + (e?.message || e));
    } finally {
      setSyncing(false);
      loadOutboundLogs();
    }
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    const [t, m, a] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).maybeSingle(),
      supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
      supabase.from('ticket_attachments').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
    ]);
    if (t.error) { console.error(t.error); toast.error('Ticket nicht gefunden'); }
    const tk = (t.data as Ticket) || null;
    setTicket(tk);
    setMessages((m.data as Msg[]) || []);
    setAttachments((a.data as Att[]) || []);
    loadLinkedRepair(tk?.repair_order_id || null);
    setLoading(false);
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(500);
    setUsers(((data as any[]) || []).map(u => ({ id: u.id, label: u.full_name || u.email || u.id.slice(0, 8) })));
  }

  async function uploadAttachment(file: File) {
    if (!ticket || !file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `tickets/${ticket.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('repair-files')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('repair-files').getPublicUrl(path);
      const { error: insErr } = await supabase.from('ticket_attachments').insert({
        ticket_id: ticket.id,
        file_url: pub.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        source_system: 'alixwork',
      });
      if (insErr) throw insErr;
      toast.success('Anhang hochgeladen');
      load();
      if (ticket.external_ticket_id) syncToAlixSmart('manual');
    } catch (e: any) {
      toast.error('Upload fehlgeschlagen: ' + (e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function toggleClose() {
    if (!ticket) return;
    const isClosed = ticket.status === 'geschlossen' || ticket.status === 'gelöst';
    await patch({ status: isClosed ? 'offen' : 'geschlossen' });
  }

  useEffect(() => { load(); loadOutboundLogs(); loadUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function patch(updates: Partial<Ticket>) {
    if (!ticket) return;
    setSaving(true);
    const { error } = await supabase.from('tickets').update(updates).eq('id', ticket.id);
    setSaving(false);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    const merged = { ...ticket, ...updates };
    setTicket(merged);
    toast.success('Gespeichert');

    // Auto-sync to AlixSmart on customer-relevant changes
    let action: string | null = null;
    if ('status' in updates && updates.status !== ticket.status) {
      action = (updates.status === 'geschlossen' || updates.status === 'gelöst') ? 'ticket_closed' : 'status_change';
    } else if ('priority' in updates && updates.priority !== ticket.priority) {
      action = 'priority_change';
    } else if ('assigned_to' in updates && updates.assigned_to !== ticket.assigned_to) {
      action = 'assignment_change';
    } else if ('customer_visible_status' in updates && updates.customer_visible_status !== ticket.customer_visible_status) {
      action = 'customer_status_change';
    }
    if (action && merged.external_ticket_id) {
      syncToAlixSmart(action);
    }
  }

  async function addMessage() {
    if (!ticket || !newMsg.trim()) return;
    const { data, error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'agent',
      sender_name: user?.email || 'Mitarbeiter',
      sender_email: user?.email || null,
      message: newMsg.trim(),
      is_internal: msgInternal,
      source_system: 'alixwork',
    }).select('id').single();
    if (error) { toast.error(error.message); return; }
    setNewMsg('');
    toast.success(msgInternal ? 'Interne Notiz hinzugefügt' : 'Nachricht hinzugefügt');
    // Only sync public messages to AlixSmart
    if (!msgInternal && ticket.external_ticket_id && data?.id) {
      syncToAlixSmart('new_public_message', data.id);
    }
    load();
  }

  async function handover(dept: string, statusLabel: string) {
    await patch({ department: dept, customer_visible_status: statusLabel });
  }

  async function copyAttachmentsToRepair(repairId: string) {
    if (!attachments.length) return;
    let copied = 0;
    for (const a of attachments) {
      if (!a.file_url || !a.file_name) continue;
      try {
        const res = await fetch(a.file_url);
        if (!res.ok) continue;
        const blob = await res.blob();
        const safeName = a.file_name.replace(/[^\w.\-]+/g, '_');
        const path = `${repairId}/files/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('repair-files')
          .upload(path, blob, { contentType: a.file_type || blob.type, upsert: false });
        if (!upErr) copied++;
      } catch (e) {
        console.warn('Anhang konnte nicht übernommen werden', a.file_name, e);
      }
    }
    if (copied > 0) toast.success(`${copied} Anhang/Anhänge übernommen`);
  }

  async function createRepairFromTicket() {
    if (!ticket) return;
    if (ticket.repair_order_id) {
      navigate(`/reparatur/${ticket.repair_order_id}`);
      return;
    }
    setSaving(true);
    try {
      // Versuche Auftrag/Kunde anhand der Auftragsnummer aufzulösen
      let orderRow: { id: string; order_number: string; customer_id: string } | null = null;
      if (ticket.order_number) {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number, customer_id')
          .eq('order_number', ticket.order_number)
          .maybeSingle();
        if (data) orderRow = data as any;
      }

      const payload: any = {
        customer_name: ticket.customer_name || ticket.company_name || 'Unbekannt',
        customer_company: ticket.company_name || '',
        customer_email: ticket.customer_email || '',
        customer_phone: ticket.customer_phone || '',
        address_street: ticket.customer_address || '',
        priority: ticket.priority === 'kritisch' ? 'dringend'
                 : ticket.priority === 'hoch' ? 'hoch'
                 : ticket.priority === 'niedrig' ? 'niedrig' : 'normal',
        device_model: ticket.device_name || '',
        device_serial_number: ticket.serial_number || '',
        issue_description: ticket.description || ticket.title || 'Ticket übernommen',
        customer_error_description: ticket.description || '',
        internal_notes: `Aus Ticket übernommen: ${ticket.external_ticket_id || ticket.id}`,
        repair_status: 'Neu',
        order_id: orderRow?.id || null,
        order_number: orderRow?.order_number || ticket.order_number || null,
        customer_id: orderRow?.customer_id || null,
        ticket_id: ticket.id,
        created_by: user?.id,
        updated_by: user?.id,
      };

      const { data: repair, error } = await sbRepair
        .from('repair_orders')
        .insert(payload)
        .select('id, repair_number, repair_status')
        .single();
      if (error) throw error;

      // Anhänge in repair-files Bucket übernehmen
      await copyAttachmentsToRepair(repair.id);

      // Ticket aktualisieren + interne Notiz + Verknüpfung speichern
      await supabase.from('tickets').update({
        repair_order_id: repair.id,
        department: 'technik',
        status: 'in_bearbeitung',
        customer_visible_status: `Reparaturauftrag ${repair.repair_number} erstellt`,
      }).eq('id', ticket.id);

      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        sender_type: 'agent',
        sender_name: user?.email || 'Mitarbeiter',
        sender_email: user?.email || null,
        message: `Reparaturauftrag ${repair.repair_number} aus Ticket erstellt.`,
        is_internal: true,
        source_system: 'alixwork',
      });

      toast.success(`Reparaturauftrag ${repair.repair_number} angelegt`);
      setLinkedRepair(repair as LinkedRepair);
      setTicket(t => t ? { ...t, repair_order_id: repair.id } : t);
      load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
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
          {ticket.auto_category && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/40">
              Auto: {ticket.auto_category}
            </Badge>
          )}
          {ticket.auto_priority === 'Hoch' && (
            <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">
              Prio Hoch (Auto)
            </Badge>
          )}
          {ticket.sla_status && ticket.sla_status !== 'ok' && (
            <Badge variant="outline" className={ticket.sla_status === 'breach'
              ? 'bg-red-500/15 text-red-300 border-red-500/40'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/40'}>
              SLA: {ticket.sla_status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AiAnalysisPanel sourceKind="ticket" recordId={ticket.id} />
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <div>Letzter Inbound-Sync: {ticket.last_synced_at ? new Date(ticket.last_synced_at).toLocaleString('de-DE') : '—'}</div>
            <div className="flex items-center gap-1">
              {ticket.last_outbound_sync_at && <CheckCircle2 className="w-3 h-3 text-green-500" />}
              An AlixSmart: {ticket.last_outbound_sync_at ? new Date(ticket.last_outbound_sync_at).toLocaleString('de-DE') : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Sichtbare Aktionsleiste */}
      {canEdit && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card p-4 flex items-center gap-2 flex-wrap shadow-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mr-1 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> Aktionen
          </span>

          <div className="flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={ticket.status} onValueChange={v => patch({ status: v })} disabled={saving}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Select value={ticket.priority} onValueChange={v => patch({ priority: v })} disabled={saving}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Priorität" /></SelectTrigger>
              <SelectContent>{PRIORITY.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <Select
              value={ticket.assigned_to || 'none'}
              onValueChange={v => patch({ assigned_to: v === 'none' ? null : v })}
              disabled={saving}
            >
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Mitarbeiter zuweisen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— nicht zugewiesen —</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const isClosed = ticket.status === 'geschlossen' || ticket.status === 'gelöst';
            return (
              <Button
                size="sm"
                variant={isClosed ? 'outline' : 'default'}
                onClick={toggleClose}
                disabled={saving}
              >
                {isClosed ? <><Unlock className="w-4 h-4 mr-1" /> Ticket wieder öffnen</> : <><Lock className="w-4 h-4 mr-1" /> Ticket schließen</>}
              </Button>
            );
          })()}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const el = document.getElementById('ticket-new-message');
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => (el as HTMLTextAreaElement | null)?.focus(), 350);
            }}
          >
            <MessageSquare className="w-4 h-4 mr-1" /> Kommentar
          </Button>

          <label className="inline-flex">
            <input
              type="file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); e.currentTarget.value = ''; }}
            />
            <span className={`inline-flex items-center h-9 px-3 rounded-md text-sm cursor-pointer border border-input bg-background hover:bg-muted/40 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
              Anhang hochladen
            </span>
          </label>

          {ticket.external_ticket_id && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => syncToAlixSmart('manual')}
              disabled={syncing}
              title="Manuell an AlixSmart übertragen"
            >
              {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Sync
            </Button>
          )}
        </div>
      )}


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

          {linkedRepair && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Verknüpfter Reparaturauftrag
              </h2>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-mono text-base font-semibold text-foreground">{linkedRepair.repair_number || '—'}</span>
                  <span className="text-xs text-muted-foreground">Status: <Badge variant="outline">{linkedRepair.repair_status || '—'}</Badge></span>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/reparatur/${linkedRepair.id}`}>Öffnen</Link>
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Übergaben</h2>
            <Button variant="outline" className="w-full justify-start" disabled={!canEdit || saving}
              onClick={createRepairFromTicket}>
              <Wrench className="w-4 h-4 mr-2" />
              {linkedRepair ? `Reparaturauftrag öffnen (${linkedRepair.repair_number || ''})` : 'Reparaturauftrag erstellen'}
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

          <div className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> AlixSmart Sync
            </h2>
            <div className="text-xs text-muted-foreground">
              {ticket.external_ticket_id
                ? <>External ID: <span className="font-mono text-foreground">{ticket.external_ticket_id}</span></>
                : 'Keine externe Ticket-ID vorhanden — Sync nicht möglich.'}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {ticket.last_outbound_sync_at
                ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> Letzte erfolgreiche Übertragung: {new Date(ticket.last_outbound_sync_at).toLocaleString('de-DE')}</>
                : <><AlertCircle className="w-3 h-3 text-amber-500" /> Noch keine Übertragung</>}
            </div>
            <Button variant="outline" className="w-full justify-start"
              disabled={!canEdit || syncing || !ticket.external_ticket_id}
              onClick={() => syncToAlixSmart('manual')}>
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Jetzt synchronisieren
            </Button>
            <Dialog open={historyOpen} onOpenChange={(o) => { setHistoryOpen(o); if (o) loadOutboundLogs(); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <History className="w-4 h-4 mr-2" /> Sync-Historie anzeigen ({outboundLogs.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>AlixSmart Sync-Historie</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {outboundLogs.length === 0 && <div className="text-sm text-muted-foreground p-4">Noch keine Synchronisationen.</div>}
                  {outboundLogs.map(l => (
                    <div key={l.id} className={`rounded-lg border p-3 text-xs ${l.status === 'success' ? 'border-green-500/30 bg-green-500/5' : l.status === 'skipped' ? 'border-amber-500/30 bg-amber-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {l.status === 'success'
                            ? <CheckCircle2 className="w-3 h-3 text-green-500" />
                            : <AlertCircle className="w-3 h-3 text-destructive" />}
                          <span className="font-medium text-foreground">{l.action}</span>
                          <Badge variant="outline">{l.status}</Badge>
                        </div>
                        <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString('de-DE')}</span>
                      </div>
                      {l.error_message && <div className="text-destructive mt-1">{l.error_message}</div>}
                      {l.payload && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground">Payload</summary>
                          <pre className="mt-1 p-2 rounded bg-background overflow-auto text-[10px]">{JSON.stringify(l.payload, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
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
