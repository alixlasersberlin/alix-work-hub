import { describe, expect, it } from 'vitest';
import { REVISION_ROLES, validRevisionReview } from './revision';
describe('Revision rules', () => {
  it('limits initial access to existing administrators', () => {
    expect(REVISION_ROLES).toEqual(['Admin', 'Super Admin']);
  });
  it('rejects short or missing reasons', () => {
    expect(validRevisionReview('reviewed', '    ')).toBe(false);
    expect(validRevisionReview('reviewed', 'abcd')).toBe(false);
    expect(validRevisionReview('reviewed', 'Beleg geprüft')).toBe(true);
  });
  it('rejects unknown states and oversized notes', () => {
    expect(validRevisionReview('paid', 'Beleg geprüft')).toBe(false);
    expect(validRevisionReview('open', 'a'.repeat(4001))).toBe(false);
    expect(validRevisionReview('clarification', 'a'.repeat(4000))).toBe(true);
  });
});