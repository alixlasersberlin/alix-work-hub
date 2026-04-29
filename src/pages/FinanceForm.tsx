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
import { ArrowLeft, CalendarIcon, Loader2, Banknote, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function FinanceForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [orderId, setOrderId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('offen');
  const [invoiceStatus, setInvoiceStatus] = useState('offen');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [amountDue, setAmountDue] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [financeNote, setFinanceNote] = useState('');

  useEffect(() => {
    supabase.from('orders').select('id, order_number, customers(company_name)').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => { setOrders(data ?? []); setOrdersLoading(false); });

    if (isEdit) {
      supabase.from('finance_records').select('*').eq('id', id).maybeSingle().then(({ data }) => {
        if (data) {
          setOrderId(data.order_id);
          setPaymentStatus(data.payment_status || 'offen');
          setInvoiceStatus(data.invoice_status || 'offen');
          setDueDate(data.due_date ? new Date(data.due_date + 'T00:00:00') : undefined);
          setAmountDue(data.amount_due != null ? String(data.amount_due) : '');
          setAmountPaid(data.amount_paid != null ? String(data.amount_paid) : '');
          setCurrency(data.currency || 'EUR');
          setFinanceNote(data.finance_note || '');
        }
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) { toast.error('Bitte einen Auftrag auswählen.'); return; }
    setSaving(true);

    const payload: any = {
      order_id: orderId,
      payment_status: paymentStatus,
      invoice_status: invoiceStatus,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
      amount_due: amountDue ? parseFloat(amountDue) : null,
      amount_paid: amountPaid ? parseFloat(amountPaid) : null,
      currency,
      finance_note: financeNote || null,
      last_checked_at: new Date().toISOString(),
    };

    if (isEdit) {
      payload.updated_by = user?.id;
      const { error } = await supabase.from('finance_records').update(payload).eq('id', id!);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Eintrag aktualisiert.');
      navigate(`/finance/${id}`);
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from('finance_records').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Eintrag erstellt.');
      navigate('/finance');
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 lg:p-8 animate-fade-in max-w-3xl">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate(isEdit ? `/finance/${id}` : '/finance')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
      </Button>

      <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2 mb-6">
        <Banknote className="w-5 h-5 text-primary" />
        {isEdit ? 'Finance-Eintrag bearbeiten' : 'Neuer Finance-Eintrag'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Auftragszuordnung</h2>
          <Select value={orderId} onValueChange={setOrderId} disabled={isEdit}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue placeholder={ordersLoading ? 'Laden...' : 'Auftrag auswählen'} />
            </SelectTrigger>
            <SelectContent>
              {orders.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.order_number} – {o.customers?.company_name || 'Unbekannt'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Status</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Zahlungsstatus</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['bezahlt', 'offen', 'Reklamation', 'storniert', 'teilweise', 'überfällig'].sort((a,b) => a.localeCompare(b, 'de')).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rechnungsstatus</label>
              <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['offen', 'erstellt', 'versendet', 'bezahlt', 'storniert'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Amounts */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Beträge</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Betrag fällig</label>
              <Input type="number" step="0.01" value={amountDue} onChange={e => setAmountDue(e.target.value)} placeholder="0.00" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Betrag bezahlt</label>
              <Input type="number" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Währung</label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Date & Note */}
        <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-4">
          <h2 className="text-sm font-display font-bold text-foreground">Fälligkeit & Notiz</h2>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fälligkeitsdatum</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full sm:w-60 justify-start bg-secondary border-border", !dueDate && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dueDate ? format(dueDate, 'dd.MM.yyyy') : 'Datum wählen'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={de} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notiz</label>
            <Textarea value={financeNote} onChange={e => setFinanceNote(e.target.value)} placeholder="Finanznotiz..." className="bg-secondary border-border" rows={3} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gold-gradient text-primary-foreground px-6">
            <Save className="w-4 h-4 mr-2" /> {saving ? 'Speichern...' : isEdit ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
