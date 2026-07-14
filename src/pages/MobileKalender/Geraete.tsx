import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Smartphone, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Device {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string | null;
}

function parseUA(ua: string | null) {
  if (!ua) return 'Unbekanntes Gerät';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS · ' + (ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || '');
  if (/Android/i.test(ua)) return 'Android · ' + (ua.match(/Android ([\d.]+)/)?.[1] || '');
  if (/Mac/i.test(ua)) return 'macOS Safari';
  if (/Windows/i.test(ua)) return 'Windows';
  return ua.slice(0, 40);
}

export default function KalenderGeraete() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('mobile_push_subscriptions')
      .select('id,endpoint,user_agent,created_at,last_seen_at')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false, nullsFirst: false });
    setDevices((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from('mobile_push_subscriptions').delete().eq('id', id);
    if (error) return toast.error('Konnte Gerät nicht entfernen');
    toast.success('Gerät abgemeldet');
    load();
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Geräte</h1>
        <p className="text-xs text-muted-foreground">Alle Geräte, die Push-Nachrichten für dich empfangen.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Noch keine Geräte registriert. Aktiviere Push-Benachrichtigungen in den Einstellungen.
        </Card>
      ) : (
        devices.map((d) => (
          <Card key={d.id} className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{parseUA(d.user_agent)}</div>
              <div className="text-[11px] text-muted-foreground">
                Registriert: {new Date(d.created_at).toLocaleDateString('de-DE')}
                {d.last_seen_at && ` · zuletzt aktiv ${new Date(d.last_seen_at).toLocaleDateString('de-DE')}`}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(d.id)} aria-label="Abmelden">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))
      )}
    </div>
  );
}
