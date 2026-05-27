import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { Building2, Calendar, Euro, Hash } from 'lucide-react';
import { withAt } from '@/lib/atSuffix';

interface OrderCardProps {
  order: any;
  displayNumber?: string;
  onClick?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
  /** Extra slot rendered inside the card footer (e.g. driving time, actions) */
  footer?: ReactNode;
  /** Override the customer label (default: company_name → contact_name) */
  customerLabel?: string;
}

/**
 * Reusable card representation of an order/auftrag.
 * Used by the "Kachel" view across all list pages.
 */
export function OrderCard({
  order,
  displayNumber,
  onClick,
  selected,
  selectionMode,
  onToggleSelect,
  footer,
  customerLabel,
}: OrderCardProps) {
  const number = displayNumber || order._displayNumber || order.order_number || '—';
  const customer =
    customerLabel ||
    order.customers?.company_name ||
    order.customers?.contact_name ||
    order.customer_name ||
    '—';
  const date = order.order_date
    ? new Date(order.order_date).toLocaleDateString('de-DE')
    : null;
  const amount =
    order.total_amount != null
      ? Number(order.total_amount).toLocaleString('de-DE', {
          style: 'currency',
          currency: order.currency || 'EUR',
        })
      : null;

  return (
    <Card
      onClick={(e) => {
        if (selectionMode) {
          e.preventDefault();
          onToggleSelect?.();
        } else {
          onClick?.();
        }
      }}
      className={cn(
        "group relative p-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-primary/40",
        selected && "ring-2 ring-primary border-primary/60 bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground truncate">
          <Hash className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="truncate">{number}</span>
        </div>
        <StatusBadge status={order.order_status || 'offen'} />
      </div>

      <div className="flex items-start gap-1.5 text-sm text-foreground mb-1">
        <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <span className="truncate font-medium">{customer}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
        {date && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {date}
          </span>
        )}
        {amount && (
          <span className="inline-flex items-center gap-1 text-foreground font-medium">
            <Euro className="w-3 h-3" /> {amount}
          </span>
        )}
        {order.source_system && (
          <span className="opacity-70">{order.source_system}</span>
        )}
      </div>

      {footer && <div className="mt-3 pt-3 border-t border-border">{footer}</div>}
    </Card>
  );
}

export function OrderCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {children}
    </div>
  );
}
