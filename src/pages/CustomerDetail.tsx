import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building2, ClipboardList, Loader2, Inbox, Pencil, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import CustomerEditDialog from '@/components/CustomerEditDialog';
import CustomerDeleteDialog from '@/components/CustomerDeleteDialog';
import CustomerCommunication from '@/components/CustomerCommunication';
import { withAt } from '@/lib/atSuffix';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadCustomer();
  }, [id]);

  async function loadCustomer() {
    setLoading(true);
    const [cRes, oRes] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id!).maybeSingle(),
      supabase.from('orders').select('*').eq('customer_id', id!).order('created_at', { ascending: false }),
    ]);
    setCustomer(cRes.data);
    setOrders(oRes.data ?? []);
    setLoading(false);
  }

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

      {/* Header with actions */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">{customer?.company_name || customer?.contact_name || 'Kunde'}</h1>
        {isAdmin && customer && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Ändern
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Löschen
            </Button>
          </div>
        )}
      </div>

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
              ['Ext. Kunden-ID', withAt(customer.external_customer_id, customer.source_system)],
              ['IBAN', customer.iban],
              ['BIC', customer.bic],
              ['Bank', customer.bank_name],
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
                    <p className="font-medium text-foreground text-sm">{withAt(o.order_number, o.source_system)}</p>
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

      {/* Dialogs */}
      {editOpen && customer && (
        <CustomerEditDialog
          customer={customer}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); loadCustomer(); }}
        />
      )}
      {deleteOpen && customer && (
        <CustomerDeleteDialog
          customer={customer}
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => { setDeleteOpen(false); navigate('/kunden'); }}
        />
      )}
    </div>
  );
}
