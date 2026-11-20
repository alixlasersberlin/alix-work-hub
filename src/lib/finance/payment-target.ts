import { addMonths, format, parseISO } from 'date-fns';

export type DueDateChange = {
  invoice_id: string;
  metadata: { old_due_date?: string | null; new_due_date?: string | null } | null;
};

export function paymentTargetReason(
  invoice: { id: string; due_date: string | null; balance: number | null; status: string | null },
  latest: DueDateChange | undefined, today: string,
) {
  if (Number(invoice.balance || 0) <= 0 || ['draft', 'entwurf', 'void', 'storniert', 'cancelled'].includes((invoice.status || '').toLowerCase())) return null;
  const due = invoice.due_date?.slice(0, 10);
  if (!due) return null;
  const shifted = latest?.metadata?.new_due_date === due &&
    (!latest.metadata.old_due_date || due > latest.metadata.old_due_date);
  const longTerm = due > format(addMonths(parseISO(today), 6), 'yyyy-MM-dd');
  if (shifted && longTerm) return 'Verschoben · mehr als 6 Monate';
  if (shifted) return 'Fälligkeit verschoben';
  return longTerm ? 'Mehr als 6 Monate' : null;
}