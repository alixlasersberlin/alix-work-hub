import { describe, expect, it } from 'vitest';
import { commissionCustomerName, matchesCommissionSearch } from './search';

describe('Kundensuche in Provisionen', () => {
  const entry = { customer_name: null, order_number: 'SO-3731', order: { customer: { company_name: 'Beauty Berlin', contact_name: 'Anna Müller' } } };

  it('findet den Kunden über den Auftrag, wenn der Provisionsname fehlt', () => {
    expect(commissionCustomerName(entry)).toBe('Beauty Berlin');
    expect(matchesCommissionSearch(entry, ' BEAUTY ')).toBe(true);
    expect(matchesCommissionSearch(entry, 'anderer Kunde')).toBe(false);
  });

  it('findet auch den Ansprechpartner unabhängig von Großschreibung', () => {
    expect(matchesCommissionSearch(entry, 'müller')).toBe(true);
    expect(matchesCommissionSearch(entry, 'Schmidt')).toBe(false);
  });

  it('behält vorhandene Kundennamen und die Suche nach Auftrag und Mitarbeiter', () => {
    expect(commissionCustomerName({ ...entry, customer_name: 'Gespeicherter Kunde' })).toBe('Gespeicherter Kunde');
    expect(matchesCommissionSearch(entry, 'SO-3731')).toBe(true);
    expect(matchesCommissionSearch(entry, 'scheidler', 'L. Scheidler')).toBe(true);
    expect(matchesCommissionSearch(entry, 'Meier', 'L. Scheidler')).toBe(false);
  });
});