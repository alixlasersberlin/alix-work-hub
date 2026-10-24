import { useRef, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Mail, Paperclip, Send, Eye, X, Loader2, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useMailPermissions } from '@/hooks/useMailPermissions';
import { encodeMailFiles, orderMailSchema, personalizeOrderMail, validOrderRecipient, type OrderMailRecipient } from '@/lib/order-bulk-email';
import { toast } from 'sonner';

type Outcome = { status: 'sent' | 'failed' | 'uncertain'; detail: string };
export default function OrderBulkEmailDialog({ recipients, onClose }: { recipients: OrderMailRecipient[]; onClose: () => void }) {
  const permissions = useMailPermissions();
  const senders = [
    ['vertrieb', 'vertrieb@alixwork.de'], ['finance', 'finance@alixwork.de'],
    ['service', 'service@alixwork.de'], ['marketing', 'news@alixwork.de'],
  ].filter(([mailbox]) => permissions.canUseMailbox(mailbox as 'vertrieb' | 'finance' | 'service' | 'marketing'));
  const [from, setFrom] = useState(senders[0]?.[1] ?? '');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [included, setIncluded] = useState(new Set(recipients.filter(validOrderRecipient).map(r => r.orderId)));
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [preview, setPreview] = useState(false);
  const [previewId, setPreviewId] = useState(recipients[0]?.orderId ?? '');
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const stop = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const chosen = recipients.filter(r => included.has(r.orderId) && validOrderRecipient(r));
  const pending = chosen.filter(r => !outcomes[r.orderId]);
  const current = recipients.find(r => r.orderId === previewId);
  const started = Object.keys(outcomes).length > 0;
  const locked = sending || started;
  const completed = chosen.filter(r => outcomes[r.orderId]).length;

  async function send() {
    if (sending || !confirmed || !pending.length) return;
    const parsed = orderMailSchema.safeParse({ from, subject, text });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Nachricht unvollständig'); return; }
    setSending(true); stop.current = false;
    try {
      const attachments = await encodeMailFiles(files);
      for (const recipient of pending) {
        if (stop.current) break;
        let outcome: Outcome;
        try {
          const { data, error } = await supabase.functions.invoke('send-mail', { body: {
            order_bulk: true,
            order_id: recipient.orderId, customer_id: recipient.customerId,
            to_email: recipient.email, to_name: recipient.name,
            from_email: from, subject: personalizeOrderMail(parsed.data.subject, recipient),
            body_text: personalizeOrderMail(parsed.data.text, recipient), attachments,
          } });
          if (error) {
            const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
            throw new Error(details);
          }
          if (!data?.success) throw new Error(data?.error || 'Versandstatus unbekannt');
          outcome = { status: 'sent', detail: data.archive_warning || 'Gesendet · in Kundenakte gespeichert' };
        } catch (e) {
          outcome = { status: 'uncertain', detail: `${e instanceof Error ? e.message : 'Versandstatus unbekannt'} — vor erneutem Versand Kundenakte prüfen.` };
        }
        setOutcomes(previous => ({ ...previous, [recipient.orderId]: outcome }));
        if (outcome.status !== 'sent') { stop.current = true; break; }
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Vorbereitung fehlgeschlagen'); }
    finally { setSending(false); }
  }

  function addFiles(list: FileList | null) {
    const next = [...files, ...Array.from(list ?? [])];
    if (next.length > 10 || next.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) {
      toast.error('Maximal 10 Anhänge mit zusammen 10 MB'); return;
    }
    setFiles(next); setConfirmed(false);
  }

  return <Dialog open onOpenChange={open => { if (!open && !sending) onClose(); }}>
    <DialogContent className="max-w-4xl" onEscapeKeyDown={e => { if (sending) e.preventDefault(); }} onPointerDownOutside={e => { if (sending) e.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />E-Mail an markierte Aufträge</DialogTitle>
        <DialogDescription>{chosen.length} einzelne E-Mails · {new Set(chosen.map(r => r.email.toLowerCase())).size} verschiedene Adressen · Ablage unter Kundenakte → Kommunikation</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Label htmlFor="order-mail-from">Absender</Label>
          <Select value={from} onValueChange={v => { setFrom(v); setConfirmed(false); }} disabled={locked}>
            <SelectTrigger id="order-mail-from"><SelectValue /></SelectTrigger>
            <SelectContent>{senders.map(([, email]) => <SelectItem value={email} key={email}>{email}</SelectItem>)}</SelectContent>
          </Select>
          <Label htmlFor="order-mail-subject">Betreff</Label>
          <Input id="order-mail-subject" value={subject} maxLength={200} disabled={locked} onChange={e => { setSubject(e.target.value); setConfirmed(false); }} />
          <Label htmlFor="order-mail-text">Nachricht</Label>
          <Textarea id="order-mail-text" value={text} rows={9} maxLength={30000} disabled={locked} onChange={e => { setText(e.target.value); setConfirmed(false); }} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={locked} onClick={() => { setText(t => `${t}{{kunde}}`); setConfirmed(false); }}>Kundenname</Button>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => { setText(t => `${t}{{auftrag}}`); setConfirmed(false); }}>Auftragsnummer</Button>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => input.current?.click()}><Paperclip className="mr-1 h-4 w-4" />Anhänge</Button>
            <Button size="sm" variant="outline" onClick={() => setPreview(v => !v)}><Eye className="mr-1 h-4 w-4" />Vorschau</Button>
          </div>
          <input ref={input} type="file" multiple className="hidden" aria-label="Anhänge hochladen" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="break-all">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
            <Button size="icon" variant="ghost" className="ml-auto shrink-0" title="Anhang entfernen" disabled={locked} onClick={() => { setFiles(f => f.filter((_, i) => i !== index)); setConfirmed(false); }}><X className="h-4 w-4" /></Button>
          </div>)}
        </div>
        <div className="space-y-3 min-w-0">
          <h3 className="text-sm font-semibold">Empfänger ({recipients.length} Aufträge)</h3>
          <div className="max-h-80 overflow-auto divide-y divide-border">
            {recipients.map(r => <div key={r.orderId} className="flex items-start gap-3 py-3">
              <Checkbox aria-label={`${r.orderNumber} auswählen`} disabled={locked || !validOrderRecipient(r)} checked={included.has(r.orderId)} onCheckedChange={value => { setIncluded(old => { const next = new Set(old); value ? next.add(r.orderId) : next.delete(r.orderId); return next; }); setConfirmed(false); }} />
              <div className="min-w-0 text-sm"><p className="font-medium">{r.orderNumber} · {r.name || 'Kein Kunde'}</p><p className="break-all text-muted-foreground">{r.email || 'E-Mail fehlt'}</p>
                {!validOrderRecipient(r) && <p className="text-destructive">Keine gültige Kundenadresse / Zuordnung</p>}
                {outcomes[r.orderId] && <p className={outcomes[r.orderId].status === 'sent' ? 'text-primary break-words' : 'text-destructive break-words'}>{outcomes[r.orderId].detail}</p>}
              </div>
            </div>)}
          </div>
          {preview && current && <div className="space-y-3 border-t border-border pt-3">
            <Select value={previewId} onValueChange={setPreviewId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{recipients.map(r => <SelectItem key={r.orderId} value={r.orderId}>{r.orderNumber} · {r.name}</SelectItem>)}</SelectContent></Select>
            <p className="font-semibold break-words">{personalizeOrderMail(subject, current)}</p>
            <p className="whitespace-pre-wrap break-words text-sm">{personalizeOrderMail(text, current)}</p>
          </div>}
        </div>
      </div>
      {(sending || started) && <div className="space-y-2"><Progress value={chosen.length ? completed / chosen.length * 100 : 0} /><p className="text-sm text-muted-foreground">{completed} von {chosen.length} bearbeitet · {chosen.filter(r => outcomes[r.orderId]?.status === 'sent').length} gesendet</p></div>}
      <div className="flex items-start gap-2 text-sm"><Checkbox id="order-mail-confirm" checked={confirmed} disabled={sending} onCheckedChange={v => setConfirmed(v === true)} /><Label htmlFor="order-mail-confirm" className="leading-5">Empfänger, Text und Anhänge geprüft. Je Auftrag eine separate E-Mail senden, auch bei gleicher Kundenadresse.</Label></div>
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={sending} onClick={onClose}>Schließen</Button>
        {sending ? <Button variant="outline" onClick={() => { stop.current = true; }}><Square className="h-4 w-4 mr-2" />Nach aktueller E-Mail stoppen</Button> : <Button disabled={!confirmed || !pending.length || !permissions.can('emails', 'send')} onClick={send}><Send className="h-4 w-4 mr-2" />{started ? 'Verbleibende' : 'Einzeln'} senden ({pending.length})</Button>}
        {sending && <Loader2 className="h-5 w-5 animate-spin self-center" />}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}