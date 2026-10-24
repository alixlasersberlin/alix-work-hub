import { useState, type Dispatch, type SetStateAction } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useMailPermissions } from '@/hooks/useMailPermissions';
import { orderMailRecipients } from '@/lib/order-bulk-email';
import OrderBulkEmailDialog from '@/components/OrderBulkEmailDialog';

type Order = Parameters<typeof orderMailRecipients>[0][number];
export function OrderSelectionToolbar({ orders, selected, onSelectionChange, loading = false }: {
  orders: Order[];
  selected: Set<string>;
  onSelectionChange: Dispatch<SetStateAction<Set<string>>>;
  loading?: boolean;
}) {
  const [mailOpen, setMailOpen] = useState(false);
  const permissions = useMailPermissions();
  const recipients = orderMailRecipients(orders, selected);
  return <>
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm text-muted-foreground">{recipients.length} markiert</span>
      <Button size="sm" variant="ghost" disabled={loading || !orders.length} onClick={() => onSelectionChange(new Set(orders.map(o => o.id)))}>Alle {orders.length} markieren</Button>
      <Button size="sm" variant="ghost" disabled={!selected.size} onClick={() => onSelectionChange(new Set())}>Markierung aufheben</Button>
      {permissions.can('emails', 'send') && <Button size="sm" className="ml-auto" disabled={loading || !recipients.length} onClick={() => setMailOpen(true)}><Mail className="h-4 w-4 mr-2" />E-Mail senden ({recipients.length})</Button>}
    </div>
    {mailOpen && <OrderBulkEmailDialog recipients={recipients} onClose={() => setMailOpen(false)} />}
  </>;
}

export function OrderPageCheckbox({ orders, selected, onSelectionChange }: {
  orders: { id: string }[];
  selected: Set<string>;
  onSelectionChange: Dispatch<SetStateAction<Set<string>>>;
}) {
  const count = orders.filter(o => selected.has(o.id)).length;
  return <Checkbox aria-label="Seite markieren" checked={orders.length > 0 && count === orders.length ? true : count > 0 ? 'indeterminate' : false} disabled={!orders.length} onCheckedChange={checked => onSelectionChange(previous => {
    const next = new Set(previous);
    orders.forEach(o => checked === true ? next.add(o.id) : next.delete(o.id));
    return next;
  })} />;
}