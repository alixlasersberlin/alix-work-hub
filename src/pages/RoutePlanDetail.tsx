import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, ClipboardList, Building2, Loader2, Pencil } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export default function RoutePlanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const canWrite = isAdmin || hasRole('Tourenplanung');

  const [plan, setPlan] = useState<any>(null);
  const [reservedDevices, setReservedDevices] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data } = await supabase
        .from('route_plans')
        .select('*, orders(order_number, order_status, total_amount, currency, customers(company_name, contact_name, email, phone))')
        .eq('id', id)
        .maybeSingle();
      setPlan(data);
      if (data?.order_id) {
        const [{ data: devs }, { data: items }] = await Promise.all([
          supabase.from('lager_devices').select('id, model_name, serial_number').eq('reserved_order_id', data.order_id),
          supabase.from('order_items').select('id, item_name, description, sku, quantity, unit, rate, amount, item_order').eq('order_id', data.order_id).order('item_order', { ascending: true }),
        ]);
        setReservedDevices(devs ?? []);
        setOrderItems(items ?? []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!plan) return <div className="p-8 text-center text-muted-foreground">Tour nicht gefunden.</div>;

  const addr = (a: any) => {
    if (!a) return '—';
    if (typeof a === 'string') return a;
    return [a.street, a.zip, a.city, a.country].filter(Boolean).join(', ') || JSON.stringify(a);
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate('/tourenplanung')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Übersicht
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Tour: {plan.orders?.order_number || '—'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plan.planned_date ? new Date(plan.planned_date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Kein Datum'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={plan.planning_status} />
          {canWrite && (
            <Button onClick={() => navigate(`/tourenplanung/${id}/bearbeiten`)} variant="outline" className="border-border">
              <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan Details */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-primary" /> Tourendetails
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Datum', plan.planned_date ? new Date(plan.planned_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'],
              ['Zeitfenster', plan.time_window_start && plan.time_window_end ? `${plan.time_window_start.slice(0, 5)} – ${plan.time_window_end.slice(0, 5)}` : '—'],
              ['Status', plan.planning_status],
              ['Priorität', plan.priority || 'normal'],
              ['Mitarbeiter', plan.assigned_employee],
              ['Team', plan.assigned_team],
              ['Fahrzeug', plan.vehicle_info],
              ['Adresse', addr(plan.location_address)],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between">
                <dt className="text-muted-foreground">{l}</dt>
                <dd className="text-foreground font-medium text-right max-w-[60%]">{(v as string) || '—'}</dd>
              </div>
            ))}
          </dl>
          {plan.planning_note && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Planungsnotiz</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{plan.planning_note}</p>
            </div>
          )}
        </div>

        {/* Order & Customer */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" /> Auftrag
            </h2>
            {plan.orders ? (
              <dl className="space-y-3 text-sm">
                {[
                  ['Auftragsnummer', plan.orders.order_number],
                  ['Auftragsstatus', plan.orders.order_status],
                  ['Betrag', plan.orders.total_amount != null ? Number(plan.orders.total_amount).toLocaleString('de-DE', { style: 'currency', currency: plan.orders.currency || 'EUR' }) : '—'],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between">
                    <dt className="text-muted-foreground">{l}</dt>
                    <dd className="text-foreground font-medium">{(v as string) || '—'}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-muted-foreground text-sm">Kein Auftrag verknüpft.</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" /> Positionen
              {orderItems.length > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">({orderItems.length})</span>}
            </h2>
            {orderItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Positionen vorhanden.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-2 py-2 font-medium">Position</th>
                      <th className="px-2 py-2 font-medium text-right">Menge</th>
                      <th className="px-2 py-2 font-medium text-right">Preis</th>
                      <th className="px-2 py-2 font-medium text-right">Summe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orderItems.map(it => (
                      <tr key={it.id}>
                        <td className="px-2 py-2">
                          <div className="text-foreground font-medium">{it.item_name || '—'}</div>
                          {it.sku && <div className="text-xs text-muted-foreground">SKU: {it.sku}</div>}
                          {it.description && <div className="text-xs text-muted-foreground whitespace-pre-wrap">{it.description}</div>}
                        </td>
                        <td className="px-2 py-2 text-right text-foreground">{it.quantity != null ? Number(it.quantity) : '—'}{it.unit ? ` ${it.unit}` : ''}</td>
                        <td className="px-2 py-2 text-right text-muted-foreground">{it.rate != null ? Number(it.rate).toLocaleString('de-DE', { style: 'currency', currency: plan.orders?.currency || 'EUR' }) : '—'}</td>
                        <td className="px-2 py-2 text-right text-foreground font-medium">{it.amount != null ? Number(it.amount).toLocaleString('de-DE', { style: 'currency', currency: plan.orders?.currency || 'EUR' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" /> Reservierte Lagergeräte
            </h2>
            {reservedDevices.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Geräte reserviert.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {reservedDevices.map(d => (
                  <li key={d.id} className="flex justify-between rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2">
                    <span className="font-medium text-foreground">{d.model_name}</span>
                    <span className="text-yellow-600 dark:text-yellow-300">SN: {d.serial_number}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" /> Kunde
            </h2>
            {plan.orders?.customers ? (
              <dl className="space-y-3 text-sm">
                {[
                  ['Firma', plan.orders.customers.company_name],
                  ['Kontakt', plan.orders.customers.contact_name],
                  ['E-Mail', plan.orders.customers.email],
                  ['Telefon', plan.orders.customers.phone],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between">
                    <dt className="text-muted-foreground">{l}</dt>
                    <dd className="text-foreground font-medium">{(v as string) || '—'}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-muted-foreground text-sm">Keine Kundendaten verfügbar.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
