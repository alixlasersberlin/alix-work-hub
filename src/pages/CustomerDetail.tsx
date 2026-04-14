import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, ClipboardList, Loader2, Inbox } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const [cRes, oRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).maybeSingle(),
        supabase.from('orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      ]);
      setCustomer(cRes.data);
      setOrders(oRes.data ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!customer) return <div className="p-8 text-center text-muted-foreground">Kunde nicht gefunden.</div>;

  const addr = (a: any) => {
    if (!a) return '—';
    if (typeof a === 'string') return a;
    const street = a.address || a.street || '';
    const zip = a.zip || '';
    const city = a.city || '';
    const country = a.country || '';
    const parts = [street, `${zip} ${city}`.trim(), country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate('/kunden')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Kundenliste
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Customer Info */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-primary" /> Kundendaten
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Firma', customer.company_name],
              ['Kontakt', customer.contact_name],
              ['E-Mail', customer.email],
              ['Telefon', customer.phone],
              ['Quelle', customer.source_system],
              ['Ext. Kunden-ID', customer.external_customer_id],
              ['Rechnungsadresse', addr(customer.billing_address)],
              ['Lieferadresse', addr(customer.shipping_address)],
              ['Erstellt', new Date(customer.created_at).toLocaleString('de-DE')],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground font-medium text-right max-w-[60%] truncate">{(value as string) || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Customer Orders */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-primary" /> Aufträge ({orders.length})
          </h2>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Keine Aufträge vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto">
              {orders.map(o => (
                <div
                  key={o.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/auftraege/${o.id}`)}
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={o.order_status || 'offen'} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
