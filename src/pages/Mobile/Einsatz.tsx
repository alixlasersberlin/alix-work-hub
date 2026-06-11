import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Camera, FileSignature, ClipboardCheck, Phone, MapPin, ArrowLeft, Loader2,
  Play, Square, Navigation, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function MobileEinsatz() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('route_plans').select('*').eq('id', id).maybeSingle();
    setT(data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const setStatus = async (planning_status: string, extra: Record<string, any> = {}) => {
    setBusy(true);
    const { error } = await supabase.from('route_plans').update({ planning_status, ...extra }).eq('id', id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(planning_status); load(); }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> lädt…
      </div>
    );
  }
  if (!t) return <div className="p-6 text-center text-muted-foreground">Einsatz nicht gefunden.</div>;

  const address = [t.address_line, t.zip, t.city].filter(Boolean).join(', ');
  const mapsUrl = address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null;
  const done = !!t.check_out_at;
  const active = !!t.check_in_at && !done;

  return (
    <div className="p-4 space-y-4">
      <Link to="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> zurück
      </Link>

      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.tour_type || 'Einsatz'}</div>
          {done && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> erledigt</span>}
          {active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">vor Ort</span>}
        </div>
        <h1 className="text-xl font-bold">{t.contact_name || '—'}</h1>
        <div className="text-sm text-muted-foreground flex items-start gap-1">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{address || '—'}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          {t.contact_phone ? (
            <Button asChild variant="outline">
              <a href={`tel:${t.contact_phone}`}><Phone className="w-4 h-4 mr-1" /> Anrufen</a>
            </Button>
          ) : <Button variant="outline" disabled><Phone className="w-4 h-4 mr-1" /> —</Button>}
          {mapsUrl ? (
            <Button asChild variant="outline">
              <a href={mapsUrl} target="_blank" rel="noreferrer"><Navigation className="w-4 h-4 mr-1" /> Navigation</a>
            </Button>
          ) : <Button variant="outline" disabled><Navigation className="w-4 h-4 mr-1" /> —</Button>}
        </div>

        {t.device_model && (
          <div className="mt-2 text-sm border-t border-border pt-2">
            Gerät: <span className="font-medium">{t.device_model}</span>
            {t.device_serial_number && <span className="text-muted-foreground"> · SN {t.device_serial_number}</span>}
          </div>
        )}
      </Card>

      <Card className="p-3">
        {!t.check_in_at ? (
          <Button onClick={() => setStatus('Vor Ort', { check_in_at: new Date().toISOString(), work_started_at: new Date().toISOString() })} disabled={busy} className="w-full h-12 gold-gradient">
            <Play className="w-5 h-5 mr-2" /> Check-in starten
          </Button>
        ) : !t.check_out_at ? (
          <Button onClick={() => setStatus('Erledigt', { check_out_at: new Date().toISOString(), work_ended_at: new Date().toISOString() })} disabled={busy} variant="secondary" className="w-full h-12">
            <Square className="w-5 h-5 mr-2" /> Einsatz abschließen
          </Button>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-2">
            Abgeschlossen am {new Date(t.check_out_at).toLocaleString('de-DE')}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link to={`/m/einsatz/${id}/fotos`}><Camera className="w-5 h-5" /><span className="text-xs">Fotos</span></Link>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link to={`/m/einsatz/${id}/checkliste`}><ClipboardCheck className="w-5 h-5" /><span className="text-xs">Checkliste</span></Link>
        </Button>
        <Button asChild variant="outline" className="h-16 flex-col gap-1">
          <Link to={`/m/einsatz/${id}/signatur`}><FileSignature className="w-5 h-5" /><span className="text-xs">Signatur</span></Link>
        </Button>
      </div>

      {t.planning_notes && (
        <Card className="p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notiz</div>
          {t.planning_notes}
        </Card>
      )}
    </div>
  );
}
