import { format, isValid, parse } from 'date-fns';
import { z } from 'zod';

export type DueDateInvoice = {
  id: string; invoice_number: string | null; legal_invoice_number: string | null;
  due_date: string | null; invoice_date: string | null;
};

export function parseDueDate(value: string): Date | undefined {
  const checked = z.string().trim().regex(/^\d{2}\.\d{2}\.\d{4}$/).safeParse(value);
  if (!checked.success) return undefined;
  const date = parse(checked.data, 'dd.MM.yyyy', new Date(2000, 0, 1));
  return isValid(date) && format(date, 'dd.MM.yyyy') === checked.data ? date : undefined;
}

export async function changeInvoiceDueDates(
  invoices: DueDateInvoice[], dueDate: string,
  write: (invoice: DueDateInvoice, dueDate: string) => Promise<void>,
  progress: (done: number) => void,
) {
  const succeeded: string[] = [];
  const failed: { invoice: DueDateInvoice; message: string }[] = [];
  for (const invoice of invoices) {
    try {
      if (invoice.invoice_date && dueDate < invoice.invoice_date.slice(0, 10)) {
        throw new Error('Fälligkeit darf nicht vor dem Rechnungsdatum liegen.');
      }
      await write(invoice, dueDate);
      succeeded.push(invoice.id);
    } catch (failure) {
      failed.push({ invoice, message: failure instanceof Error ? failure.message : String((failure as { message?: string })?.message || failure) });
    }
    progress(succeeded.length + failed.length);
  }
  return { succeeded, failed };
}