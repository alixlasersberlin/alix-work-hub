import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, RefreshCw, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { readLeadChat, remoteLeadChat, mergeChatMessages, type LeadChatMessage } from '@/lib/sales/lead-chat';

const statuses: Record<string, string> = { received: 'Empfangen', queued: 'Beim Anbieter vorgemerkt', sent: 'Gesendet', delivered: 'Zugestellt', read: 'Gelesen', failed: 'Fehlgeschlagen', undelivered: 'Nicht zugestellt' };
export default function LeadWhatsAppChat({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<LeadChatMessage[]>([]); const [error, setError] = useState('');
  const [connected, setConnected] = useState(false); const [canSend, setCanSend] = useState(false); const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [text, setText] = useState('');
  const [remoteCursor, setRemoteCursor] = useState<string | null>(null);
  const count = useRef(50); const activeLead = useRef(leadId); activeLead.current = leadId;
  const uncertainSend = useRef(false);
  const refresh = useCallback(async () => {
    const current = leadId;
    try {
      const page = await readLeadChat(leadId);
      if (activeLead.current !== current) return;
      setMessages(prev => mergeChatMessages([...prev, ...page.messages])); setMore(page.has_more);
      if (!page.linked) { setConnected(false); setCanSend(false); setError('Noch keine bestätigte ALIXSMART-Chatzuordnung.'); return; }
      const remote = await remoteLeadChat(leadId, 'read');
      if (activeLead.current !== current) return;
      setConnected(remote.ok && remote.connected); setCanSend(remote.ok && remote.can_send === true && !uncertainSend.current);
      if (remote.ok) { setMessages(prev => mergeChatMessages([...prev, ...(remote.messages || [])])); setRemoteCursor(remote.next_cursor || null); setError(''); }
      else setError(remote.error || 'ALIXSMART-Verbindung nicht bestätigt.');
    } catch (e) { if (activeLead.current === current) { setMessages([]); setError(e instanceof Error ? e.message : 'Chat konnte nicht geladen werden.'); setConnected(false); setCanSend(false); } }
    finally { if (activeLead.current === current) setLoading(false); }
  }, [leadId]);
  useEffect(() => { setMessages([]); setText(''); setError(''); setConnected(false); setCanSend(false); setLoading(true); count.current = 50; uncertainSend.current = false; setRemoteCursor(null); void refresh(); }, [refresh]);
  useRealtimeRefresh(['sales_lead_history', 'sales_leads'], refresh, { debounceMs: 1000 });
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden && !sending) void refresh(); }, 15000); return () => clearInterval(timer); }, [refresh, sending]);
  const older = async () => {
    try {
      if (connected && remoteCursor) {
        const remote = await remoteLeadChat(leadId, 'read', { before: remoteCursor });
        if (!remote.ok) throw new Error(remote.error);
        setMessages(prev => mergeChatMessages([...prev, ...(remote.messages || [])])); setRemoteCursor(remote.next_cursor || null);
      } else {
        const page = await readLeadChat(leadId, count.current); count.current += page.messages.length;
        setMessages(prev => mergeChatMessages([...prev, ...page.messages])); setMore(page.has_more);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ältere Nachrichten nicht abrufbar.'); }
  };
  const send = async () => {
    if (!canSend || sending || !text.trim()) return;
    setSending(true); const target = leadId;
    try {
      const result = await remoteLeadChat(leadId, 'send', { text: text.trim(), request_id: crypto.randomUUID() });
      if (activeLead.current !== target) return;
      if (!result.ok || !result.message) { uncertainSend.current = true; setCanSend(false); throw new Error(result.error || 'Versand nicht bestätigt. Verlauf vor erneutem Versand prüfen.'); }
      setMessages(prev => mergeChatMessages([...prev, result.message as LeadChatMessage])); setText('');
    } catch (e) { if (activeLead.current === target) { uncertainSend.current = true; setCanSend(false); setError(e instanceof Error ? e.message : 'Versand nicht bestätigt.'); } }
    finally { setSending(false); }
  };
  return <section className="border-t border-border pt-6 space-y-4" aria-label="WhatsApp Sales Chat">
    <header className="flex items-center justify-between gap-2 flex-wrap"><h2 className="text-lg font-semibold flex items-center gap-2"><MessageCircle className="h-5 w-5" />WhatsApp Sales</h2><div className="flex items-center gap-2"><Badge variant="outline">{connected ? 'ALIXSMART verbunden' : 'Nicht verbunden'}</Badge><Button size="icon" variant="ghost" aria-label="Chat aktualisieren" title="Chat aktualisieren" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button></div></header>
    {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
    {(more || remoteCursor) && <Button variant="outline" size="sm" onClick={() => void older()}>Ältere Nachrichten</Button>}
    <div className="max-h-[480px] min-h-24 overflow-y-auto space-y-3" aria-live="polite">{loading ? <p className="text-sm text-muted-foreground">Nachrichten werden geladen …</p> : !messages.length && <p className="text-sm text-muted-foreground">Keine übernommenen Nachrichten.</p>}{messages.map(m => <article key={m.id} className={`border-l-2 pl-4 py-2 ${m.direction === 'outbound' ? 'border-primary bg-muted/30' : 'border-border'}`}><p className="text-xs text-muted-foreground">{m.direction === 'inbound' ? 'Kunde' : 'Team'} · {new Date(m.at).toLocaleString('de-DE')}</p><p className="text-sm whitespace-pre-wrap break-words mt-1">{m.text}</p>{m.media.map(media => <p key={media.id} className="text-sm flex items-center gap-2 mt-2"><Paperclip className="h-3 w-3" />{media.name}</p>)}<p className="text-xs text-muted-foreground mt-1">{statuses[m.status] || m.status}</p></article>)}</div>
    <div className="flex gap-2 items-end"><Textarea aria-label="WhatsApp-Nachricht" placeholder="Nachricht" value={text} maxLength={4000} disabled={!canSend || sending} onChange={e => setText(e.target.value)} /><Button size="icon" aria-label="WhatsApp senden" title="WhatsApp senden" disabled={!canSend || sending || !text.trim()} onClick={() => void send()}><Send className="h-4 w-4" /></Button></div>
  </section>;
}