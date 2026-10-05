import { describe, it, expect } from 'vitest';
import { classifyTickets } from './ticketKind';

const base = { created_at: '2026-10-01T10:00:00Z' };

describe('classifyTickets', () => {
  it('erkennt automatische Meldungen am Absender', () => {
    expect(classifyTickets([{ ...base, id: 'a', customer_email: 'noreply@eanamnese.de' }]).a).toBe('auto');
  });
  it('erkennt automatische Meldungen am Betreff', () => {
    expect(classifyTickets([{ ...base, id: 'a', customer_email: 'x@web.de', subject: 'Automatische Antwort: Urlaub' }]).a).toBe('auto');
  });
  it('erste Mail eines Kunden ist neue Anfrage', () => {
    expect(classifyTickets([{ ...base, id: 'a', customer_email: 'kunde@web.de', subject: 'Frage' }]).a).toBe('neu');
  });
  it('weitere Mail desselben Kunden ist bestehender Vorgang', () => {
    const r = classifyTickets([
      { id: 'a', created_at: '2026-09-01T10:00:00Z', customer_email: 'kunde@web.de' },
      { id: 'b', created_at: '2026-10-01T10:00:00Z', customer_email: 'Kunde <KUNDE@web.de>' },
    ]);
    expect(r.a).toBe('neu');
    expect(r.b).toBe('vorgang');
  });
  it('AW:-Betreff ist bestehender Vorgang', () => {
    expect(classifyTickets([{ ...base, id: 'a', customer_email: 'k@web.de', subject: 'AW: Termin' }]).a).toBe('vorgang');
  });
});
