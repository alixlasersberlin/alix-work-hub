import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarClock, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;

export default function IcsFeedCard() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const url = token
    ? `https://${PROJECT_ID}.supabase.co/functions/v1/esc-ics?token=${token}`
    : '';
  const webcal = url ? url.replace(/^https:/, 'webcal:') : '';

  const issue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('esc-feed-issue');
      if (error) throw error;
      setToken((data as any)?.token || null);
    } catch (e: any) {
      toast.error(e?.message || 'ICS-Feed konnte nicht erstellt werden');
    } finally { setLoading(false); }
  };

  useEffect(() => { issue(); /* eslint-disable-next-line */ }, []);

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success('ICS-Feed-Link kopiert');
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-sm">Externer Kalender-Abo (ICS)</div>
          <div className="text-xs text-muted-foreground">
            Deine Termine als Live-Feed für Apple Kalender, Google Calendar, Outlook, Thunderbird etc. Read-only, aktualisiert sich automatisch.
          </div>
        </div>
      </div>
      {url && (
        <>
          <Input readOnly value={url} className="text-[11px] font-mono" onFocus={(e) => e.currentTarget.select()} />
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" />Kopieren</Button>
            <a href={webcal}><Button size="sm" variant="outline" className="w-full"><ExternalLink className="h-3.5 w-3.5 mr-1" />Abonnieren</Button></a>
            <Button size="sm" variant="ghost" onClick={issue} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Neu
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <b>Apple/iOS:</b> Einstellungen → Kalender → Accounts → Account hinzufügen → Andere → Kalenderabo hinzufügen.<br />
            <b>Google:</b> calendar.google.com → Weitere Kalender → Per URL.<br />
            <b>Outlook:</b> Kalender → Kalender hinzufügen → Aus dem Internet.
          </div>
        </>
      )}
    </Card>
  );
}
