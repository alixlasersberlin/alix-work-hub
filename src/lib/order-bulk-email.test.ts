import { describe, expect, it } from 'vitest';
import { orderMailRecipients, personalizeOrderMail, validOrderRecipient, orderMailSchema } from './order-bulk-email';

const customer = { company_name: 'Studio', contact_name: 'Frau Beispiel', email: 'kunde@example.com' };
const customerId = '45820f2c-6d6c-4067-9816-cc6dc4500db4';
const orders = ['a', 'b', 'c'].map(id => ({ id, customer_id: customerId, order_number: id, customers: customer }));
describe('Auftrags-Einzelversand', () => {
  it('nimmt ausschließlich markierte Aufträge', () => {
    expect(orderMailRecipients(orders, new Set(['b'])).map(r => r.orderId)).toEqual(['b']);
  });
  it('alle Aufträge behalten eigene Empfängerzuordnung auch bei gleichem Kunden', () => {
    const recipients = orderMailRecipients(orders, new Set(['a', 'b', 'c']));
    expect(recipients).toHaveLength(3);
    expect(recipients.map(r => [r.orderId, r.customerId, r.email])).toEqual(['a', 'b', 'c'].map(id => [id, customerId, customer.email]));
  });
  it('personalisiert freien Text je Auftrag', () => {
    expect(personalizeOrderMail('Hallo {{kunde}}, Auftrag {{auftrag}}', orderMailRecipients(orders, new Set(['a']))[0])).toBe('Hallo Frau Beispiel, Auftrag a');
  });
  it('fehlende Kundenadresse sperrt den Versand', () => {
    expect(validOrderRecipient({ orderId: 'a', customerId, orderNumber: 'a', name: 'Studio', email: '' })).toBe(false);
  });
  it('leerer freier Text kann nicht versendet werden', () => {
    expect(orderMailSchema.safeParse({ subject: 'Auftrag', text: ' ', from: 'vertrieb@alixwork.de' }).success).toBe(false);
  });
});