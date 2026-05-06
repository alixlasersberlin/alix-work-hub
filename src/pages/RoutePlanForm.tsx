import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, CalendarIcon, Loader2, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function RoutePlanForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [reservedDevices, setReservedDevices] = useState<any[]>([]);

  function formatAddress(a: any): string {
    if (!a) return '';
    if (typeof a === 'string') return a;
    return [a.street, a.address, a.street2, a.zip, a.zip_code, a.city, a.state, a.country]
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ');
  }

  // Form state
  const [orderId, setOrderId] = useState('');
  const [plannedDate, setPlannedDate] = useState<Date | undefined>();
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [employee, setEmployee] = useState('');
  const [team, setTeam] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('offen');
  const [priority, setPriority] = useState('normal');
  const [note, setNote] = useState('');

  useEffect(() => {
    supabase.from('orders').select('id, order_number, shipping_address, billing_address, customers(company_name, shipping_address, billing_address)').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => { setOrders(data ?? []); setOrdersLoading(false); });

    if (isEdit) {
      supabase.from('route_plans').select('*').eq('id', id).maybeSingle().then(({ data }) => {
        if (data) {
          setOrderId(data.order_id);
          setPlannedDate(data.planned_date ? new Date(data.planned_date + 'T00:00:00') : undefined);
          setTimeStart(data.time_window_start?.slice(0, 5) || '');
          setTimeEnd(data.time_window_end?.slice(0, 5) || '');
          setEmployee(data.assigned_employee || '');
          setTeam(data.assigned_team || '');
          setVehicle(data.vehicle_info || '');
          setAddress(typeof data.location_address === 'string' ? data.location_address : data.location_address ? ((data.location_address as any).raw || formatAddress(data.location_address)) : '');
          setStatus(data.planning_status || 'offen');
          setPriority(data.priority || 'normal');
          setNote(data.planning_note || '');
        }
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (!orderId) { setReservedDevices([]); return; }
    const o = orders.find(x => x.id === orderId);
    if (o && !address) {
      const addr =
        formatAddress(o.shipping_address) ||
        formatAddress(o.billing_address) ||
        formatAddress(o.customers?.shipping_address) ||
        formatAddress(o.customers?.billing_address);
      if (addr) setAddress(addr);
    }
    supabase.from('lager_devices').select('id, model_name, serial_number').eq('reserved_order_id', orderId)
      .then(({ data }) => setReservedDevices(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orders]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) { toast.error('Bitte einen Auftrag auswählen.'); return; }

    setSaving(true);
    let addressJson: any = address;
    try { addressJson = JSON.parse(address); } catch { addressJson = address ? { raw: address } : null; }

    const payload: any = {
      order_id: orderId,
      planned_date: plannedDate ? format(plannedDate, 'yyyy-MM-dd') : null,
      time_window_start: timeStart || null,
      time_window_end: timeEnd || null,
      assigned_employee: employee || null,
      assigned_team: team || null,
      vehicle_info: vehicle || null,
      location_address: addressJson,
      planning_status: status,
      priority,
      planning_note: note || null,
    };

    if (isEdit) {
      payload.updated_by = user?.id;
      const { error } = await supabase.from('route_plans').update(payload).eq('id', id!);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Tour aktualisiert.');
      navigate(`/tourenplanung/${id}`);
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from('route_plans').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Tour erstellt.');
      navigate('/tourenplanung');
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-3xl">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate(isEdit ? `/tourenplanung/${id}` : '/tourenplanung')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
      </Button>

      <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2 mb-6">
        <MapPin className="w-5 h-5 text-primary" />
        {isEdit ? 'Tour bearbeiten' : 'Neue Tour anlegen'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Selection */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Auftragszuordnung</h2>
          <Select value={orderId} onValueChange={setOrderId} disabled={isEdit}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder={ordersLoading ? 'Laden...' : 'Auftrag auswählen'} />
            </SelectTrigger>
            <SelectContent>
              {orders.map(o => (
                <SelectItem key={o.id} value={o.id}>
                  {o.order_number} – {o.customers?.company_name || 'Unbekannt'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date & Time */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Datum & Zeit</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start bg-secondary border-border", !plannedDate && "text-muted-foreground")}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {plannedDate ? format(plannedDate, 'dd.MM.yyyy') : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={plannedDate} onSelect={setPlannedDate} locale={de} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Von</label>
              <Input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bis</label>
              <Input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
        </div>

        {/* Assignment */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Zuweisung</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mitarbeiter</label>
              <Input value={employee} onChange={e => setEmployee(e.target.value)} placeholder="Name" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Team</label>
              <Input value={team} onChange={e => setTeam(e.target.value)} placeholder="Team" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fahrzeug</label>
              <Input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="Fahrzeuginfo" className="bg-secondary border-border" />
            </div>
          </div>
        </div>

        {/* Status & Priority */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Status & Priorität</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['offen', 'geplant', 'bestätigt', 'in Bearbeitung', 'abgeschlossen', 'storniert'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priorität</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Address & Note */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Adresse & Notiz</h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Adresse</label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ, Ort" className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Planungsnotiz</label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz zur Tour..." className="bg-secondary border-border" rows={3} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gold-gradient text-primary-foreground px-6">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Speichern...' : isEdit ? 'Aktualisieren' : 'Tour anlegen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
