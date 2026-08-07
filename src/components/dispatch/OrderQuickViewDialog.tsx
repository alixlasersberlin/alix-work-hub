import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  orderNumber: string | null;
  onOpenChange: (open: boolean) => void;
}

function fmtMoney(v: any, currency?: string | null) {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(Number(v));
}

export function OrderQuickViewDialog({ orderNumber, onOpenChange }: Props) {
  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'order-quickview', orderNumber],
    enabled: !!orderNumber,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!order) return { order: null, items: [] as any[] };
      const { data: items } = await supabase
        .from('order_items')
        .select('id, item_name, quantity, rate, amount')
        .eq('order_id', (order as any).id);
      return { order: order as any, items: items ?? [] };
    },
  });

  const o = data?.order;

  return (
    <Dialog open={!!orderNumber} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auftrag {orderNumber}</DialogTitle>
        </DialogHeader>

        {isPending && <p className="text-sm text-muted-foreground">Lädt…</p>}
        {!isPending && !o && <p className="text-sm text-muted-foreground">Auftrag nicht gefunden.</p>}

        {o && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Kunde" value={o.company_name || o.customer_name} />
              <Field label="Status" value={o.order_status} />
              <Field label="Auftragsdatum" value={o.order_date ? format(new Date(o.order_date), 'dd.MM.yyyy') : null} />
              <Field label="Auftragswert" value={fmtMoney(o.total_amount, o.currency)} />
              <Field label="E-Mail" value={o.contact_email} />
              <Field label="Telefon" value={o.contact_phone} />
              <Field
                label="Lieferadresse"
                value={[o.delivery_street, [o.delivery_zip, o.delivery_city].filter(Boolean).join(' '), o.delivery_country]
                  .filter(Boolean)
                  .join(', ')}
              />
              <Field label="Verkäufer" value={o.salesperson_name} />
            </div>

            {(data?.items ?? []).length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Positionen</div>
                <div className="rounded-lg border divide-y">
                  {data!.items.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{Number(it.quantity ?? 1)}× {it.item_name}</span>
                      <span className="text-muted-foreground">{fmtMoney(it.amount, o.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link to={`/orders/${o.id}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Auftrag öffnen
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}
