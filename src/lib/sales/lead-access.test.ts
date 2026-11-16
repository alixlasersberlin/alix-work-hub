import { describe, expect, it } from 'vitest';
import { canAccessSalesLeads, canAccessSalesInquiryPath, canReadSalesInquiries, INQUIRY_READ_ROLE, isSalesLeadPath } from './lead-access';

describe('sales inquiry permissions', () => {
  it('restores inquiry viewing without administrator privileges', () => {
    const roles = ['Order', 'SACHBEARBEITUNG', INQUIRY_READ_ROLE];
    expect(canReadSalesInquiries(roles)).toBe(true);
    expect(canAccessSalesInquiryPath(roles, '/verkauf/anfragen')).toBe(true);
    expect(canAccessSalesInquiryPath(roles, '/verkauf/anfragen/45820f2c-6d6c-4067-9816-cc6dc4500db4')).toBe(true);
    expect(canAccessSalesLeads(roles)).toBe(false);
  });
  it.each(['/verkauf/anfragen/neu', '/verkauf/neue-anfrage', '/verkauf/anfragen/import', '/verkauf/anfragen/dashboard', '/vertrieb/whatsapp-eingang'])('read access does not authorize %s', path => {
    expect(canAccessSalesInquiryPath([INQUIRY_READ_ROLE], path)).toBe(false);
  });
  it('does not open inquiries to other restored operational roles', () => {
    expect(canReadSalesInquiries(['Order', 'Auftragsverwaltung'])).toBe(false);
    expect(canAccessSalesInquiryPath(['Admin'], '/verkauf/anfragen')).toBe(false);
  });
  it.each(['Super Admin'])('allows %s', role => {
    expect(canAccessSalesLeads([role])).toBe(true);
  });
  it.each(['Admin', 'Order', 'Vertrieb', 'Vertriebsleitung', 'SACHBEARBEITUNG', 'Auftragsverwaltung', 'Finance', 'Tourenplanung', 'Österreich', 'Read Only Audit', 'QM', 'Kundenservice', 'Lieferant', 'Geschäftsführung'])('denies %s', role => {
    expect(canAccessSalesLeads([role])).toBe(false);
  });
  it('denies missing roles and admins with additional roles', () => {
    expect(canAccessSalesLeads([])).toBe(false);
    expect(canAccessSalesLeads(['Order', 'Admin'])).toBe(false);
  });
  it('allows Super Admin with additional roles', () => {
    expect(canAccessSalesLeads(['Order', 'Admin', 'Super Admin'])).toBe(true);
  });
  it.each(['/verkauf/anfragen', '/verkauf/anfragen/neu', '/verkauf/anfragen/dashboard', '/verkauf/anfragen/import', '/verkauf/anfragen/123', '/verkauf/neue-anfrage'])('protects inquiry path %s', path => {
    expect(isSalesLeadPath(path)).toBe(true);
  });
  it.each(['/verkauf/angebote', '/verkauf/angebot/neu', '/auftraege', '/finanzierungen/anfragen-offen'])('preserves unrelated permissions for %s', path => {
    expect(isSalesLeadPath(path)).toBe(false);
  });
});