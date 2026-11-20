import { expect, it } from 'vitest';
import { changeInvoiceDueDates, parseDueDate, type DueDateInvoice } from './invoice-due-date';
import { format } from 'date-fns';

const invoice = (id: string): DueDateInvoice => ({ id, invoice_number: id, legal_invoice_number: null, due_date: '2026-11-20', invoice_date: '2026-11-01' });

it('accepts a manually typed German date and rejects impossible dates', () => {
  const date = parseDueDate('25.11.2026');
  expect(date && format(date, 'yyyy-MM-dd')).toBe('2026-11-25');
  expect(parseDueDate('31.11.2026')).toBeUndefined();
  expect(parseDueDate('')).toBeUndefined();
});

it('changes every selected invoice to the same date, preserving the expected old date', async () => {
  const calls: string[] = [];
  const result = await changeInvoiceDueDates([invoice('a'), invoice('b')], '2026-11-25', async (row, date) => {
    calls.push(`${row.id}:${date}:${row.due_date}`);
  }, () => {});
  expect(calls).toEqual(['a:2026-11-25:2026-11-20', 'b:2026-11-25:2026-11-20']);
  expect(result.succeeded).toEqual(['a', 'b']);
});

it('records individual failures without retrying or skipping later selected invoices', async () => {
  const calls: string[] = [];
  const result = await changeInvoiceDueDates([invoice('a'), invoice('b'), invoice('c')], '2026-11-25', async row => {
    calls.push(row.id);
    if (row.id === 'b') throw new Error('Rechnungsperiode ist gesperrt.');
  }, () => {});
  expect(calls).toEqual(['a', 'b', 'c']);
  expect(result.succeeded).toEqual(['a', 'c']);
  expect(result.failed.map(row => row.invoice.id)).toEqual(['b']);
});

it('rejects a due date before the invoice date without writing', async () => {
  let writes = 0;
  const result = await changeInvoiceDueDates([invoice('a')], '2026-10-31', async () => { writes += 1; }, () => {});
  expect(writes).toBe(0);
  expect(result.failed).toHaveLength(1);
});