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
