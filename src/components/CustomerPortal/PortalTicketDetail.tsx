import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Paperclip, Download, MessageSquare, User } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  ticketId: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  onClose: () => void;
};

type Msg = {
  id: string;
  sender_type: string;
  sender_name: string | null;
  message: string | null;
  created_at: string;
  kind: 'message';
};
type Att = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  kind: 'attachment';
};
type Item = Msg | Att;

const senderLabel: Record<string, string> = {
  customer: 'Sie',
  agent: 'Team',
  system: 'System',
  email_in: 'Sie (E-Mail)',
  email_out: 'Team (E-Mail)',
};

function fmtSize(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function PortalTicketDetail({ ticketId, customerName, customerEmail, onClose }: Props) {
  const [ticket, setTicket] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!ticketId) return;
    setLoading(true);
    const [{ data: t }, { data: msgs }, { data: atts }] = await Promise.all([
      supabase.from('tickets')
        .select('id, ticket_number, title, subject, status, category, priority, created_at, device_name, serial_number')
        .eq('id', ticketId).maybeSingle(),
      supabase.from('ticket_messages')
        .select('id, sender_type, sender_name, message, created_at')
        .eq('ticket_id', ticketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true }),
      supabase.from('ticket_attachments')
        .select('id, file_url, file_name, file_type, file_size, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }),
    ]);
    setTicket(t);
    const merged: Item[] = [
      ...(msgs ?? []).map((m: any) => ({ ...m, kind: 'message' as const })),
      ...(atts ?? []).map((a: any) => ({ ...a, kind: 'attachment' as const })),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));
    setItems(merged);
    setLoading(false);
  };

  useEffect(() => { if (ticketId) load(); /* eslint-disable-next-line */ }, [ticketId]);

  const download = async (att: Att) => {
    // If file_url is already a full URL, open directly. Otherwise treat as storage path.
    if (/^https?:\/\//i.test(att.file_url)) {
      window.open(att.file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(att.file_url, 60 * 15);
    if (error || !data?.signedUrl) return toast.error('Download nicht möglich');
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const send = async () => {
    if (!reply.trim() || !ticketId) return;
    setSending(true);
    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_type: 'customer',
      sender_name: customerName ?? customerEmail ?? 'Kunde',
      sender_email: customerEmail ?? null,
      message: reply.trim(),
      is_internal: false,
      source_system: 'kundenportal',
    });
    setSending(false);
    if (error) return toast.error('Antwort konnte nicht gesendet werden');
    setReply('');
    toast.success('Antwort gesendet');
    load();
  };

  return (
    <Dialog open={!!ticketId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            {ticket?.subject || ticket?.title || 'Ticket'}
            {ticket?.ticket_number && (
              <span className="text-xs font-mono text-muted-foreground ml-2">{ticket.ticket_number}</span>
            )}
          </DialogTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {ticket?.category && <Badge variant="outline">{ticket.category}</Badge>}
            {ticket?.status && <Badge variant="secondary">{ticket.status}</Badge>}
            {ticket?.device_name && <span>{ticket.device_name}</span>}
            {ticket?.serial_number && <span>· {ticket.serial_number}</span>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Noch keine Nachrichten.</p>
          ) : (
            items.map((it) => {
              const mine = it.kind === 'message' && (it.sender_type === 'customer' || it.sender_type === 'email_in');
              return (
                <div key={`${it.kind}-${it.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${mine ? 'bg-primary/10 border-primary/30' : 'bg-muted/40 border-border'}`}>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                      <User className="w-3 h-3" />
                      <span>{it.kind === 'message' ? (senderLabel[it.sender_type] ?? it.sender_name ?? it.sender_type) : 'Anhang'}</span>
                      <span>·</span>
                      <span>{new Date(it.created_at).toLocaleString('de-DE')}</span>
                    </div>
                    {it.kind === 'message' ? (
                      <div className="whitespace-pre-wrap break-words">{it.message}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => download(it as Att)}
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {(it as Att).file_name}
                        <span className="text-xs text-muted-foreground">{fmtSize((it as Att).file_size)}</span>
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border pt-3 mt-2">
          <Textarea
            placeholder="Ihre Antwort..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end mt-2">
            <Button onClick={send} disabled={sending || !reply.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Antwort senden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
