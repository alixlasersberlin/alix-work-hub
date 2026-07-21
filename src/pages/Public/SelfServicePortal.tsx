import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, MessageCircle, Search, HandshakeIcon, Mail, Ticket } from 'lucide-react';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

function genToken() {
  const t = localStorage.getItem('ac_portal_token');
  if (t) return t;
  const n = crypto.randomUUID();
  localStorage.setItem('ac_portal_token', n);
  return n;
}

export default function SelfServicePortal() {
  const token = genToken();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState('');
  const [q, setQ] = useState('');
  const [kb, setKb] = useState<any[]>([]);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('ac_kb_articles').select('id,title,content,category').eq('status', 'published').eq('public_visible', true).limit(20)
      .then(({ data }) => setKb((data as any) ?? []));
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [messages]);

  const send = async (handoff = false) => {
    const text = input.trim();
    if (!text && !handoff) return;
    setSending(true);
    const userMsg: Msg = { role: 'user', content: text || '(Bitte an Support weiterleiten)' };
    setMessages(m => [...m, userMsg]);
    setInput('');
    try {
      const { data, error } = await supabase.functions.invoke('ac-portal-chat', {
        body: { session_token: token, message: userMsg.content, contact_email: email || undefined, request_handoff: handoff, handoff_channel: 'whatsapp' },
      });
      if (error) throw error;
      setMessages(m => [...m, { role: 'assistant', content: (data as any)?.reply ?? '…' }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `Fehler: ${e?.message ?? e}` }]);
    } finally { setSending(false); }
  };

  const filtered = kb.filter(a => !q || a.title.toLowerCase().includes(q.toLowerCase()) || (a.content ?? '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="text-center py-4">
          <h1 className="text-2xl md:text-3xl font-bold">ALIX Self-Service</h1>
          <p className="text-sm text-muted-foreground">FAQs durchsuchen oder direkt mit dem Assistenten chatten.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Hilfe-Artikel</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="Suche…" value={q} onChange={e => setQ(e.target.value)} />
              <div className="space-y-2 max-h-[520px] overflow-auto">
                {filtered.map(a => (
                  <div key={a.id} className="border rounded p-3">
                    <div className="font-medium text-sm">{a.title}</div>
                    {a.category && <Badge variant="outline" className="mt-1 text-[10px]">{a.category}</Badge>}
                    <div className="text-xs text-muted-foreground mt-2 line-clamp-4">{a.content}</div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-xs text-muted-foreground">Keine Artikel gefunden.</div>}
              </div>
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> Assistent</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col gap-2">
              <Input type="email" placeholder="E-Mail (optional, für Rückruf)" value={email} onChange={e => setEmail(e.target.value)} />
              <div ref={scroll} className="flex-1 min-h-[380px] max-h-[420px] overflow-auto border rounded p-3 space-y-2 bg-background">
                {messages.length === 0 && <div className="text-xs text-muted-foreground text-center py-8"><MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />Stelle deine Frage – der Assistent nutzt unser Wissen.</div>}
                {messages.map((m, i) => (
                  <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{m.content}</div>
                  </div>
                ))}
                {sending && <div className="text-xs text-muted-foreground">…</div>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Nachricht…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !sending && send()} />
                <Button onClick={() => send()} disabled={sending || !input.trim()}><Send className="h-4 w-4" /></Button>
              </div>
              <Button variant="outline" size="sm" onClick={() => send(true)} disabled={sending}><HandshakeIcon className="h-4 w-4 mr-1" />An echten Berater weiterleiten (WhatsApp)</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
