import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, FileSignature, ClipboardCheck, Phone, MapPin, ArrowLeft, Loader2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

export default function MobileEinsatz() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from('route_plans').select('*').eq('id', id).maybeSingle();
    setT(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const setStatus = async (planning_status: string, extra: Record<string, any> = {}) => {
    const { error } = await supabase.from('route_plans').update({ planning_status, ...extra }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success(planning_status); load(); }
  };

  if (loading) return <div className="p-4 flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> lädt…</div>;
  if (!t) return <div className="p-4">Nicht gefunden.</div>;

  return (
    <div className="p-4 space-y-4">
      <Link to="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> zurück
      </Link>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{t.tour_type || 'Einsatz'}</div>
        <h1 className="text-xl font-bold mt-1">{t.contact_name || '—'}</h1>
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
          <MapPin className="w-4 h-4" />
          {[t.address_line, t.zip, t.city].filter(Boolean).join(', ') || '—'}
        </div>
        {t.contact_phone && (
          <a href={`tel:${t.contact_phone}`} className="mt-2 inline-flex items-center gap-1 text-primary">
            <Phone className="w-4 h-4" /> {t.contact_phone}
          </a>
        )}
        {t.device_model && (
          <div className="mt-2 text-sm">Gerät: <span className="font-medium">{t.device_model}</span>
            {t.device_serial_number && <span className="text-muted-foreground"> · SN {t.device_serial_number}</span>}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {!t.check_in_at ? (
          <Button onClick={() => setStatus('Vor Ort', { check_in_at: new Date().toISOString(), work_started_at: new Date().toISOString() })} className="gold-gradient">
            <Play className="w-4 h-4 mr-1" /> Check-in
          </Button>
        ) : !t.check_out_at ? (
          <Button onClick={() => setStatus('Erledigt', { check_out_at: new Date().toISOString(), work_ended_at: new Date().toISOString() })} variant="secondary">
            <Square className="w-4 h-4 mr-1" /> Check-out
          </Button>
        ) : (
          <Button disabled variant="outline">Erledigt</Button>
        )}
        <Button asChild variant="outline"><Link to={`/m/einsatz/${id}/fotos`}><Camera className="w-4 h-4 mr-1" /> Fotos</Link></Button>
        <Button asChild variant="outline"><Link to={`/m/einsatz/${id}/checkliste`}><ClipboardCheck className="w-4 h-4 mr-1" /> Checkliste</Link></Button>
        <Button asChild variant="outline"><Link to={`/m/einsatz/${id}/signatur`}><FileSignature className="w-4 h-4 mr-1" /> Signatur</Link></Button>
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
