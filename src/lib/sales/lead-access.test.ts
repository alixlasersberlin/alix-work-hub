import { describe, expect, it } from 'vitest';
import { canAccessSalesLeads, isSalesLeadPath } from './lead-access';

describe('sales inquiry permissions', () => {
  it.each(['Admin', 'Super Admin'])('allows %s', role => {
    expect(canAccessSalesLeads([role])).toBe(true);
  });
  it.each(['Order', 'Vertrieb', 'Vertriebsleitung', 'SACHBEARBEITUNG', 'Auftragsverwaltung', 'Finance', 'Tourenplanung', 'Österreich', 'Read Only Audit', 'QM', 'Kundenservice', 'Lieferant', 'Geschäftsführung'])('denies %s', role => {
    expect(canAccessSalesLeads([role])).toBe(false);
  });
  it('denies missing roles and allows an admin with additional roles', () => {
    expect(canAccessSalesLeads([])).toBe(false);
    expect(canAccessSalesLeads(['Order', 'Admin'])).toBe(true);
  });
  it.each(['/verkauf/anfragen', '/verkauf/anfragen/neu', '/verkauf/anfragen/dashboard', '/verkauf/anfragen/import', '/verkauf/anfragen/123', '/verkauf/neue-anfrage'])('protects inquiry path %s', path => {
    expect(isSalesLeadPath(path)).toBe(true);
  });
  it.each(['/verkauf/angebote', '/verkauf/angebot/neu', '/auftraege', '/finanzierungen/anfragen-offen'])('preserves unrelated permissions for %s', path => {
    expect(isSalesLeadPath(path)).toBe(false);
  });
});