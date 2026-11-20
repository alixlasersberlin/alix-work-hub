import { describe, it, expect } from 'vitest';
import { sortOpenItems } from './open-item-sort';
const mk = (id: string, o: any) => ({ id, customer_name: null, invoice_number: null, legal_invoice_number: null, due_date: null, total: null, paid: null, balance: null, ...o });
describe('sortOpenItems', () => {
  it('sorts by amount descending', () => {
    const r = sortOpenItems([mk('a', { balance: 5 }), mk('b', { balance: 50 }), mk('c', { balance: 10 })], 'balance', 'desc');
    expect(r.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('sorts customers alphabetically (German, case-insensitive)', () => {
    const r = sortOpenItems([mk('a', { customer_name: 'zeta' }), mk('b', { customer_name: 'Ärzte' }), mk('c', { customer_name: 'Beta' })], 'customer', 'asc');
    expect(r.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
  it('sorts by due date and keeps empty last', () => {
    const r = sortOpenItems([mk('a', {}), mk('b', { due_date: '2026-02-01' }), mk('c', { due_date: '2026-01-01' })], 'due', 'desc');
    expect(r.map(x => x.id)).toEqual(['b', 'c', 'a']);
  });
});
