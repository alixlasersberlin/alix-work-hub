import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { useEchMessages } from '@/hooks/esc/useEchMessages';

export default function EchHistory() {
  const messages = useEchMessages();
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');

  const filtered = messages.filter((m) =>
    (!channel || m.channel === channel) &&
    (!q || (m.recipient + ' ' + (m.subject ?? '') + ' ' + m.body).toLowerCase().includes(q.toLowerCase()))
  );

  const channels = Array.from(new Set(messages.map((m) => m.channel)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Versandhistorie</h1>
      </div>
      <Card>
        <CardContent className="p-3 grid md:grid-cols-[1fr_180px] gap-2">
          <Input placeholder="Suche in Empfänger/Betreff/Inhalt…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-[12.5px]">
            <option value="">Alle Kanäle</option>
            {channels.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Nachrichten ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border/50">
          {filtered.length === 0 && <div className="py-4 text-center text-muted-foreground text-[12.5px]">Keine Nachrichten.</div>}
          {filtered.map((m) => (
            <div key={m.id} className="py-2 grid grid-cols-1 md:grid-cols-[110px_90px_1fr_140px_100px] gap-2 items-center text-[12.5px]">
              <span className="font-mono text-[11px] text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
              <Badge variant="outline" className="text-[10px] uppercase w-fit">{m.channel}</Badge>
              <span className="truncate">{m.subject ?? m.body.slice(0, 80)}</span>
              <span className="truncate text-muted-foreground">{m.recipient}</span>
              <Badge variant={m.status === 'failed' ? 'destructive' : m.status === 'delivered' || m.status === 'sent' ? 'default' : 'secondary'} className="text-[10px]">{m.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
