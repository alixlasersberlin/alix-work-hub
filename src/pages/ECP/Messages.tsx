import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { mockMessages } from '@/lib/ecp/mock';
import { useState } from 'react';
import { toast } from 'sonner';

export default function EcpMessages() {
  const [msg, setMsg] = useState('');
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-3 space-y-2">
        {mockMessages.map((m) => (
          <div key={m.id} className={`rounded-md p-2 ${m.unread ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.from} · {m.date}</div>
            <div className="text-sm font-medium">{m.subject}</div>
          </div>
        ))}
      </Card>
      <Card className="p-3 space-y-3">
        <div className="text-sm font-medium">Neue Nachricht</div>
        <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={6} placeholder="Nachricht an AlixWorks…" />
        <Button onClick={() => { setMsg(''); toast.success('Nachricht gesendet'); }}>Senden</Button>
      </Card>
    </div>
  );
}
