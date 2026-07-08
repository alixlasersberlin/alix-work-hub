import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, Send, CheckCircle2, AlertTriangle, MessageSquare, MailOpen, Video, Star } from 'lucide-react';
import { useEchMessages } from '@/hooks/esc/useEchMessages';

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[12px] font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-primary/70" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function EchDashboard() {
  const messages = useEchMessages();
  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const heute = messages.filter((m) => m.createdAt.slice(0, 10) === today);
    const sent = messages.filter((m) => m.status === 'sent' || m.status === 'delivered');
    const opened = messages.filter((m) => m.status === 'opened' || m.openedAt);
    const failed = messages.filter((m) => m.status === 'failed' || m.status === 'bounced');
    const sms = messages.filter((m) => m.channel === 'sms').length;
    const wa = messages.filter((m) => m.channel === 'whatsapp').length;
    const meet = messages.filter((m) => ['teams', 'zoom', 'google_meet'].includes(m.channel)).length;
    const openRate = sent.length ? Math.round((opened.length / sent.length) * 100) : 0;
    return { heute: heute.length, sent: sent.length, failed: failed.length, sms, wa, meet, openRate };
  }, [messages, today]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Communication Hub · Übersicht</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi icon={Send} label="Heute versendet" value={stats.heute} />
        <Kpi icon={CheckCircle2} label="Zugestellt" value={stats.sent} />
        <Kpi icon={AlertTriangle} label="Fehlgeschlagen" value={stats.failed} />
        <Kpi icon={MessageSquare} label="SMS" value={stats.sms} />
        <Kpi icon={MessageSquare} label="WhatsApp" value={stats.wa} />
        <Kpi icon={Video} label="Meetings" value={stats.meet} />
        <Kpi icon={MailOpen} label="Öffnungsrate" value={`${stats.openRate}%`} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Letzte Nachrichten</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border/50">
          {messages.length === 0 && <div className="py-6 text-center text-[12.5px] text-muted-foreground">Noch keine Nachrichten – Kanäle können in „Integrationen" konfiguriert und Vorlagen unter „Vorlagen" angelegt werden.</div>}
          {messages.slice(0, 10).map((m) => (
            <div key={m.id} className="py-2 grid grid-cols-1 md:grid-cols-[110px_120px_1fr_auto] gap-2 items-center text-[12.5px]">
              <span className="text-muted-foreground font-mono text-[11px]">{new Date(m.createdAt).toLocaleTimeString()}</span>
              <span className="uppercase text-[10.5px] tracking-wide text-primary">{m.channel}</span>
              <span className="truncate">{m.subject ?? m.body.slice(0, 80)}</span>
              <span className="text-[10.5px] text-muted-foreground">{m.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5" /> Alle Kanäle sind modular. Neue Integrationen (Teams, Zoom, Meet, WhatsApp, SMS-Provider) werden in „Integrationen" freigeschaltet.
      </div>
    </div>
  );
}
