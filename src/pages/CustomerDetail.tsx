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
import FinanceAccountTab from '@/components/finance/FinanceAccountTab';
import PortalAccessTab from '@/components/customer/PortalAccessTab';
import AlixDocsPanel from '@/components/alixdocs/AlixDocsPanel';
import CustomerSocialMediaTab from '@/components/customer/CustomerSocialMediaTab';
import CustomerAllTransactions from '@/components/customer/CustomerAllTransactions';

import CustomerReturnDebits, { PaymentRiskWarning } from '@/components/finance/CustomerReturnDebits';
import { withAt } from '@/lib/atSuffix';

/** Nur die in der Übersicht angezeigten Spalten — `raw_data` (im Schnitt 3 KB pro Kunde) bleibt draußen. */
const CUSTOMER_COLS =
  'id, company_name, contact_name, email, phone, source_system, external_customer_id, billing_address, shipping_address, created_at, is_vip';
const ORDER_COLS = 'id, order_number, order_date, order_status, total_amount, currency, source_system';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [rawData, setRawData] = useState<any>(null);
  const [fullCustomer, setFullCustomer] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    loadCustomer();
  }, [id]);

  async function loadCustomer() {
    setLoading(true);
    setRawData(null);
    setFullCustomer(null);
    const [cRes, oRes, bRes] = await Promise.all([
      supabase.from('customers').select(CUSTOMER_COLS).eq('id', id!).maybeSingle(),
      supabase.from('orders').select(ORDER_COLS).eq('customer_id', id!).order('order_date', { ascending: false }).limit(200),
      // Bankdaten sind Finance-only; für andere Rollen liefert RLS ein leeres Ergebnis.
      supabase.from('customer_bank_details').select('iban, bic, bank_name').eq('customer_id', id!).maybeSingle(),
    ]);
    setCustomer(cRes.data ? { ...cRes.data, ...(bRes.data ?? { iban: null, bic: null, bank_name: null }) } : null);
    setOrders(oRes.data ?? []);
    setLoading(false);
  }

  /** Rohdaten und Volldatensatz erst laden, wenn sie wirklich gebraucht werden. */
  async function ensureRawData() {
    if (rawData !== null || !id) return;
    const { data } = await supabase.from('customers').select('raw_data').eq('id', id).maybeSingle();
    setRawData(data?.raw_data ?? {});
  }

  async function openEdit() {
    if (!id) return;
    if (!fullCustomer) {
      const { data } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
      setFullCustomer(data ? { ...data, iban: customer?.iban, bic: customer?.bic, bank_name: customer?.bank_name } : customer);
    }
    setEditOpen(true);
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
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Ändern
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Löschen
            </Button>
          </div>
        )}
      </div>

      <PaymentRiskWarning customerId={customer.id} className="mb-4" />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'social') ensureRawData(); }} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="vorgaenge">Alle Vorgänge</TabsTrigger>
          <TabsTrigger value="kontoauszug">Kontoauszug</TabsTrigger>
          <TabsTrigger value="communication">Kommunikation</TabsTrigger>
          <TabsTrigger value="finance">Finanzakte</TabsTrigger>
          <TabsTrigger value="portal">Kundenportal</TabsTrigger>
          <TabsTrigger value="alixdocs">AlixDocs</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
        </TabsList>

        <TabsContent value="vorgaenge" className="mt-4">
          <CustomerAllTransactions
            customerId={customer.id}
            externalCustomerId={customer.external_customer_id}
            customerName={customer.company_name || customer.contact_name}
          />
        </TabsContent>


        <TabsContent value="overview" className="mt-4">
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
        </TabsContent>

        <TabsContent value="communication" className="mt-4">
          <CustomerCommunication customer={customer} />
        </TabsContent>

        <TabsContent value="finance" className="mt-4 space-y-4">
          <FinanceAccountTab customerId={customer.id} />
          <CustomerReturnDebits customerId={customer.id} />
        </TabsContent>

        <TabsContent value="portal" className="mt-4">
          <PortalAccessTab customerId={customer.id} customerEmail={customer.email} />
        </TabsContent>

        <TabsContent value="alixdocs" className="mt-4">
          <AlixDocsPanel scope="customer" customerId={customer.id} />
        </TabsContent>

        <TabsContent value="social" className="mt-4">
          <CustomerSocialMediaTab
            customerId={customer.id}
            customerName={customer.company_name || customer.contact_name || '—'}
            customerEmail={customer.email}
            customerPhone={customer.phone}
            customerContactName={customer.contact_name}
            customerBillingAddress={customer.billing_address}
            customerRawData={rawData ?? {}}
          />
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      {editOpen && customer && (
        <CustomerEditDialog
          customer={fullCustomer ?? customer}
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
