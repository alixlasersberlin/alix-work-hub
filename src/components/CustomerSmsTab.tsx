import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ExternalLink, MessageSquare, Loader2, Send, RotateCw, Inbox } from 'lucide-react';
import { toast } from 'sonner';

type Customer = {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type DocRow = {
  id: string;
  order_id: string;
  document_type: string | null;
  file_name: string;
  download_token: string | null;
  created_at: string;
  order_number?: string | null;
  order_status?: string | null;
};

type LogRow = {
  id: string;
  document_type: string | null;
  document_number: string | null;
  phone: string;
  message_text: string;
  status: string;
  twilio_sid: string | null;
  error_message: string | null;
  sent_at: string;
};

const TEMPLATES: Record<string, string> = {
  angebot: 'Hallo {{kunde}}, vielen Dank für Ihr Interesse an Alix Lasers. Ihr persönliches Angebot steht hier für Sie bereit: {{link}} Ihr Alix Lasers Team',
  auftrag: 'Hallo {{kunde}}, Ihr Auftrag bei Alix Lasers wurde erstellt. Die Unterlagen finden Sie hier: {{link}} Vielen Dank für Ihr Vertrauen.',
  auftragsbestaetigung: 'Hallo {{kunde}}, Ihre Auftragsbestätigung von Alix Lasers ist verfügbar: {{link}} Bei Fragen sind wir gerne für Sie da.',
  anzahlungsrechnung: 'Hallo {{kunde}}, Ihre Anzahlungsrechnung zu Ihrem Auftrag ist jetzt verfügbar: {{link}} Vielen Dank, Ihr Alix Lasers Team.',
  rechnung: 'Hallo {{kunde}}, Ihre Rechnung von Alix Lasers steht hier für Sie bereit: {{link}} Vielen Dank für die Zusammenarbeit.',
  lieferschein: 'Hallo {{kunde}}, Ihr Lieferschein wurde erstellt und ist hier abrufbar: {{link}} Ihr Alix Lasers Team.',
  reparaturbericht: 'Hallo {{kunde}}, der Reparaturbericht zu Ihrem Gerät ist verfügbar: {{link}} Ihr Alix Lasers Service-Team.',
  kostenvoranschlag: 'Hallo {{kunde}}, Ihr Kostenvoranschlag steht zur Prüfung bereit: {{link}} Ihr Alix Lasers Service-Team.',
  garantie: 'Hallo {{kunde}}, Ihre Garantieunterlagen sind hier abrufbar: {{link}} Ihr Alix Lasers Team.',
  default: 'Hallo {{kunde}}, ein Dokument von Alix Lasers steht hier für Sie bereit: {{link}} Ihr Alix Lasers Team.',
};

function pickTemplate(docType: string | null | undefined): string {
  const t = (docType || '').toLowerCase();
  if (t.includes('angebot')) return TEMPLATES.angebot;
  if (t.includes('auftragsbest')) return TEMPLATES.auftragsbestaetigung;
  if (t.includes('anzahlung')) return TEMPLATES.anzahlungsrechnung;
  if (t.includes('rechnung')) return TEMPLATES.rechnung;
  if (t.includes('liefer')) return TEMPLATES.lieferschein;
  if (t.includes('reparatur')) return TEMPLATES.reparaturbericht;
  if (t.includes('kostenvoranschlag') || t === 'kv') return TEMPLATES.kostenvoranschlag;
  if (t.includes('garantie') || t.includes('kulanz')) return TEMPLATES.garantie;
  if (t.includes('auftrag')) return TEMPLATES.auftrag;
  return TEMPLATES.default;
}

const ALLOWED_ROLES = ['Super Admin', 'Admin', 'Vertrieb', 'Kundenservice', 'Finance', 'Service', 'Serviceleitung', 'Reparaturannahme', 'Technik'];

export default function CustomerSmsTab({ customer, orderId }: { customer: Customer; orderId?: string }) {
  const { hasAnyRole, isAdmin } = useAuth();
  const allowed = isAdmin || hasAnyRole(ALLOWED_ROLES);

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogDoc, setDialogDoc] = useState<DocRow | null>(null);
  const [phone, setPhone] = useState('');
  const [recipient, setRecipient] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const customerName = customer.company_name || customer.contact_name || 'Kunde';

  async function load() {
    setLoading(true);
    const ordersQuery = supabase.from('orders').select('id, order_number, order_status').eq('customer_id', customer.id);
    const logsQuery = supabase
      .from('customer_sms_logs')
      .select('*')
      .eq('customer_id', customer.id)
      .order('sent_at', { ascending: false })
      .limit(100);
    if (orderId) logsQuery.eq('order_id', orderId);
    const [ordersRes, logsRes] = await Promise.all([ordersQuery, logsQuery]);
    const allOrders = ordersRes.data ?? [];
    const scopedOrders = orderId ? allOrders.filter((o: any) => o.id === orderId) : allOrders;
    const orderIds = scopedOrders.map((o: any) => o.id);
    const orderMap = new Map(allOrders.map((o: any) => [o.id, o]));
    let docRows: DocRow[] = [];
    if (orderIds.length > 0) {
      const { data: d } = await supabase
        .from('order_documents')
        .select('id, order_id, document_type, file_name, download_token, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });
      docRows = (d ?? []).map((doc: any) => ({
        ...doc,
        order_number: orderMap.get(doc.order_id)?.order_number ?? null,
        order_status: orderMap.get(doc.order_id)?.order_status ?? null,
      }));
    }
    setDocs(docRows);
    setLogs((logsRes.data ?? []) as LogRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (customer?.id && allowed) void load();
  }, [customer?.id, allowed, orderId]);

  function openDialog(doc: DocRow) {
    setDialogDoc(doc);
    setPhone(customer.phone ?? '');
    setRecipient(customer.contact_name || customer.company_name || '');
    const tmpl = pickTemplate(doc.document_type);
    setText(tmpl.replace(/\{\{kunde\}\}/g, customerName));
  }

  function openPdf(doc: DocRow) {
    if (!doc.download_token) {
      toast.error('Kein Download-Token vorhanden. Bitte Dokument neu erzeugen.');
      return;
    }
    window.open(`/d/${doc.download_token}`, '_blank', 'noopener');
  }

  async function sendSms(payload: {
    document_id: string;
    document_type: string | null;
    document_number: string | null;
    order_id: string | null;
    phone: string;
    recipient_name: string;
    message_text: string;
  }) {
    if (!payload.phone || payload.phone.trim().length < 5) {
      toast.error('Keine Mobilnummer hinterlegt');
      return false;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-customer-sms', {
        body: {
          customer_id: customer.id,
          order_id: payload.order_id,
          document_id: payload.document_id,
          document_type: payload.document_type,
          document_number: payload.document_number,
          recipient_name: payload.recipient_name,
          phone: payload.phone,
          message_text: payload.message_text,
          base_url: window.location.origin,
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || 'SMS konnte nicht gesendet werden';
        toast.error(msg);
        await load();
        return false;
      }
      toast.success('SMS erfolgreich gesendet');
      await load();
      return true;
    } catch (e: any) {
      toast.error(e?.message || 'Twilio-Verbindung nicht verfügbar');
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleSendFromDialog() {
    if (!dialogDoc) return;
    const ok = await sendSms({
      document_id: dialogDoc.id,
      document_type: dialogDoc.document_type,
      document_number: dialogDoc.order_number,
      order_id: dialogDoc.order_id,
      phone,
      recipient_name: recipient,
      message_text: text,
    });
    if (ok) setDialogDoc(null);
  }

  async function resend(log: LogRow) {
    // Try to find matching doc to keep token valid
    const doc = docs.find((d) => d.document_type === log.document_type && d.order_number === log.document_number);
    if (!doc) {
      toast.error('Originaldokument nicht mehr verfügbar.');
      return;
    }
    await sendSms({
      document_id: doc.id,
      document_type: doc.document_type,
      document_number: doc.order_number,
      order_id: doc.order_id,
      phone: log.phone,
      recipient_name: customerName,
      message_text: log.message_text,
    });
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Sie haben keine Berechtigung, SMS an Kunden zu senden.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" /> Verfügbare Dokumente
        </h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" /> Keine Dokumente verfügbar.
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Typ</TableHead>
                  <TableHead>Auftrag</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Datei</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.document_type || '—'}</TableCell>
                    <TableCell>{d.order_number || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{d.file_name}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openPdf(d)}>
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> PDF öffnen
                        </Button>
                        <Button size="sm" onClick={() => openDialog(d)}>
                          <Send className="w-3.5 h-3.5 mr-1.5" /> per SMS senden
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 card-glow">
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" /> Versandhistorie
        </h2>
        {logs.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">Noch keine SMS versendet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Text</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.sent_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell className="text-xs">{l.document_type || '—'} {l.document_number ? `· ${l.document_number}` : ''}</TableCell>
                  <TableCell className="text-xs">{l.phone}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === 'failed' ? 'destructive' : 'secondary'}>{l.status}</Badge>
                    {l.error_message && <div className="text-[10px] text-destructive mt-1 max-w-[200px] truncate">{l.error_message}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[320px] truncate">{l.message_text}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => resend(l)} disabled={sending}>
                      <RotateCw className="w-3.5 h-3.5 mr-1.5" /> Erneut
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!dialogDoc} onOpenChange={(o) => !o && setDialogDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS senden</DialogTitle>
            <DialogDescription>
              Dokument: {dialogDoc?.document_type} · {dialogDoc?.order_number ?? dialogDoc?.file_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Empfänger</Label>
              <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </div>
            <div>
              <Label>Mobilnummer</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" />
            </div>
            <div>
              <Label>SMS-Text</Label>
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">
                {`Platzhalter {{link}} wird beim Versand automatisch durch den signierten PDF-Link ersetzt.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogDoc(null)} disabled={sending}>Abbrechen</Button>
            <Button onClick={handleSendFromDialog} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              SMS senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
