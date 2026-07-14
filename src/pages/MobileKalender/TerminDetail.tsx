import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadEvent, confirmEvent, KalenderEvent } from '@/hooks/useKalenderEvents';
import { eventStyle, STATUS_LABELS } from '@/lib/kalender/event-colors';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { enqueueAction } from '@/lib/offline/kalender-queue';
import {
  Phone, Mail, MessageSquare, Navigation, CheckCircle2, Clock,
  MapPin, User, Building2, Ticket as TicketIcon, FileText, StickyNote,
  Play, Ban
} from 'lucide-react';

export default function KalenderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [event, setEvent] = useState<KalenderEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => { setLoading(true); setEvent(await loadEvent(id)); setLoading(false); })();
  }, [id]);

  if (loading) return <div className="space-y-2"><Skeleton className="h-32" /><Skeleton className="h-24" /></div>;
  if (!event) return <div className="p-6 text-center text-sm text-muted-foreground">Termin nicht gefunden.</div>;

  const s = eventStyle(event.event_kind);
  const startTime = new Date(event.start_at).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' });
  const endTime = new Date(event.end_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const action = async (status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled', msg: string) => {
    if (!id) return;
    setBusy(true);
    // Offline? -> in Outbox schreiben, optimistisch UI updaten
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await enqueueAction({ kind: 'status', event_id: id, status });
        setEvent(prev => prev ? { ...prev, status } as KalenderEvent : prev);
        toast.success(`${msg} (offline gespeichert – wird bei Verbindung gesendet)`);
      } catch (e: any) {
        toast.error(e?.message || 'Konnte nicht offline gespeichert werden');
      } finally { setBusy(false); }
      return;
    }
    try { await confirmEvent(id, status); toast.success(msg); setEvent(await loadEvent(id)); }
    catch (e: any) {
      // Netzwerkfehler trotz online? -> in Queue
      try {
        await enqueueAction({ kind: 'status', event_id: id, status });
        setEvent(prev => prev ? { ...prev, status } as KalenderEvent : prev);
        toast.warning(`${msg} – vorgemerkt für erneuten Versand`);
      } catch {
        toast.error(e?.message || 'Aktion fehlgeschlagen');
      }
    }
    finally { setBusy(false); }
  };

  const mapsUrl = event.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`
    : (event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : null);

  return (
    <div className="space-y-3">
      <Card className={`p-4 border-l-4 ${s.border}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Badge className={`${s.bg} ${s.fg} border-0 mb-2`}>{s.label}</Badge>
            <h1 className="text-xl font-bold leading-tight">{event.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">{STATUS_LABELS[event.status || ''] || event.status}</div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {startTime} – {endTime}</div>
          {event.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {event.location}</div>}
          {event.address && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {event.address}</div>}
          {event.customer_name && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {event.customer_name}</div>}
          {event.contact_person && <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> {event.contact_person}</div>}
        </div>
      </Card>

      {/* Schnellaktionen */}
      <div className="grid grid-cols-4 gap-2">
        {event.customer_phone && (
          <a href={`tel:${event.customer_phone}`}>
            <Button variant="outline" className="w-full h-16 flex-col gap-1"><Phone className="h-4 w-4" /><span className="text-[10px]">Anrufen</span></Button>
          </a>
        )}
        {event.customer_email && (
          <a href={`mailto:${event.customer_email}`}>
            <Button variant="outline" className="w-full h-16 flex-col gap-1"><Mail className="h-4 w-4" /><span className="text-[10px]">E-Mail</span></Button>
          </a>
        )}
        {event.customer_phone && (
          <a href={`https://wa.me/${event.customer_phone.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full h-16 flex-col gap-1"><MessageSquare className="h-4 w-4" /><span className="text-[10px]">WhatsApp</span></Button>
          </a>
        )}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full h-16 flex-col gap-1"><Navigation className="h-4 w-4" /><span className="text-[10px]">Navigation</span></Button>
          </a>
        )}
      </div>

      {/* Bestätigungs-Aktionen */}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => action('confirmed', 'Termin bestätigt')} disabled={busy}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Bestätigen
        </Button>
        <Button variant="outline" onClick={() => action('in_progress', 'Termin gestartet')} disabled={busy}>
          <Play className="h-4 w-4 mr-1" /> Starten
        </Button>
        <Button variant="outline" onClick={() => action('completed', 'Termin erledigt')} disabled={busy}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Erledigt
        </Button>
        <Button variant="outline" onClick={() => action('cancelled', 'Termin abgesagt')} disabled={busy}>
          <Ban className="h-4 w-4 mr-1" /> Absagen
        </Button>
      </div>

      {/* Verknüpfungen */}
      {(event.ticket_id || event.customer_id) && (
        <div className="space-y-2">
          {event.ticket_id && (
            <Button variant="ghost" className="w-full justify-start" onClick={() => nav(`/tickets/${event.ticket_id}`)}>
              <TicketIcon className="h-4 w-4 mr-2" /> Ticket öffnen
            </Button>
          )}
          {event.customer_id && (
            <Button variant="ghost" className="w-full justify-start" onClick={() => nav(`/kunden/${event.customer_id}`)}>
              <Building2 className="h-4 w-4 mr-2" /> Kunde öffnen
            </Button>
          )}
        </div>
      )}

      {event.description && (
        <Card className="p-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Beschreibung</div>
          <div className="text-sm mt-1 whitespace-pre-wrap">{event.description}</div>
        </Card>
      )}
      {event.internal_note && (
        <Card className="p-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1"><StickyNote className="h-3 w-3" /> Interne Notiz</div>
          <div className="text-sm mt-1 whitespace-pre-wrap">{event.internal_note}</div>
        </Card>
      )}
    </div>
  );
}
