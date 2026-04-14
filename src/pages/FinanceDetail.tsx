import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Banknote, ClipboardList, Building2, Loader2, Pencil } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

export default function FinanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const canWrite = isAdmin || hasRole('Finance');

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('finance_records')
      .select('*, orders(order_number, order_status, total_amount, currency, customers(company_name, contact_name, email, phone))')
      .eq('id', id).maybeSingle()
      .then(({ data }) => { setRecord(data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!record) return <div className="p-8 text-center text-muted-foreground">Finance-Eintrag nicht gefunden.</div>;

  const fmt = (v: number | null, c: string | null) =>
    v != null ? Number(v).toLocaleString('de-DE', { style: 'currency', currency: c || 'EUR' }) : '—';

  const isOverdue = record.due_date && new Date(record.due_date) < new Date() && record.payment_status !== 'bezahlt';

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate('/finance')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Übersicht
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Finance: {record.orders?.order_number || '—'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fällig: {record.due_date ? new Date(record.due_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={record.payment_status || 'offen'} />
          {canWrite && (
            <Button onClick={() => navigate(`/finance/${id}/bearbeiten`)} variant="outline" className="border-border">
              <Pencil className="w-4 h-4 mr-2" /> Bearbeiten
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Finance Details */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Banknote className="w-4 h-4 text-primary" /> Finanzdaten
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Zahlungsstatus', record.payment_status || 'offen'],
              ['Rechnungsstatus', record.invoice_status || '—'],
              ['Fälligkeitsdatum', record.due_date ? new Date(record.due_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'],
              ['Betrag fällig', fmt(record.amount_due, record.currency)],
              ['Betrag bezahlt', fmt(record.amount_paid, record.currency)],
              ['Währung', record.currency || 'EUR'],
              ['Zuletzt geprüft', record.last_checked_at ? new Date(record.last_checked_at).toLocaleString('de-DE') : '—'],
              ['Erstellt', new Date(record.created_at).toLocaleString('de-DE')],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between">
                <dt className="text-muted-foreground">{l}</dt>
                <dd className={cn("text-foreground font-medium", l === 'Fälligkeitsdatum' && isOverdue && "text-destructive")}>{v as string}</dd>
              </div>
            ))}
          </dl>
          {record.finance_note && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Notiz</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{record.finance_note}</p>
            </div>
          )}
        </div>

        {/* Order & Customer */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" /> Auftrag
            </h2>
            {record.orders ? (
              <dl className="space-y-3 text-sm">
                {[
                  ['Auftragsnummer', record.orders.order_number],
                  ['Auftragsstatus', record.orders.order_status],
                  ['Auftragsbetrag', fmt(record.orders.total_amount, record.orders.currency)],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between">
                    <dt className="text-muted-foreground">{l}</dt>
                    <dd className="text-foreground font-medium">{v as string}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-muted-foreground text-sm">Kein Auftrag verknüpft.</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" /> Kunde
            </h2>
            {record.orders?.customers ? (
              <dl className="space-y-3 text-sm">
                {[
                  ['Firma', record.orders.customers.company_name],
                  ['Kontakt', record.orders.customers.contact_name],
                  ['E-Mail', record.orders.customers.email],
                  ['Telefon', record.orders.customers.phone],
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
