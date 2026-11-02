import { describe, expect, it } from 'vitest';
import { normalizeUserEmail, userCreationAuthError } from '../../supabase/functions/_shared/user-email';

describe('user creation email validation', () => {
  it('normalizes surrounding whitespace and preserves valid addresses', () => {
    expect(normalizeUserEmail('  employee+team@example.de \n')).toBe('employee+team@example.de');
  });
  it.each(['invalid', 'a@@example.de', 'a b@example.de', 'a@example', 'a@example.de;', '.a@example.de', 'a@-example.de', '', null])('rejects malformed email %s', (email) => {
    expect(normalizeUserEmail(email)).toBeNull();
  });
  it('handles the reported provider rejection', () => {
    expect(userCreationAuthError('Unable to validate email address: invalid format')).toBe('Bitte eine gültige E-Mail-Adresse eingeben.');
  });
});