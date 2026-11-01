import { describe, it, expect } from 'vitest';
import { recoverable, key } from './policy';
const base = { last_event: 'suppressed', from: 'Alix <noreply@alixwork.de>', created_at: '2026-10-30', subject: 'Ihre Bewertung', to: ['kunde@example.org'], bcc: ['service@alix-lasers.com'] };
describe('authorized October recovery', () => {
  it('never repeats delivered mail', () => expect(recoverable({ ...base, last_event: 'delivered' })).toBe(false));
  it('excludes expired security codes', () => expect(recoverable({ ...base, subject: 'Ihr Sicherheitscode' })).toBe(false));
  it('keeps unrelated connected apps out', () => expect(recoverable({ ...base, from: 'Zenbar <noreply@eanamnese.de>' })).toBe(false));
  it('excludes already-recovered November reminders', () => expect(recoverable({ ...base, created_at: '2026-11-01' })).toBe(false));
  it('accepts proven copy suppression', () => expect(recoverable(base)).toBe(true));
  it('deduplicates deposit stages by order', () => expect(key({ ...base, subject: '1. Mahnung – Anzahlung AB-2026-1' })).toBe(key({ ...base, subject: '2. Mahnung – Anzahlung AB-2026-1' })));
});