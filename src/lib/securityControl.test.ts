import { describe, it, expect } from 'vitest';
import { correctionApproved, securityTotals, type SecurityFinding } from './securityControl';
const finding = (id: string, extra: Partial<SecurityFinding> = {}): SecurityFinding => ({
  id, nativeId: id, source: 'deep', title: id, area: 'Product Hub 2.0', component: 'test',
  priority: 'P1', confirmed: false, status: 'open', cause: '', impact: '', recommendation: '',
  plannedChange: '', dependencies: [], tests: [], rollback: '', packageId: '', potentialFalsePositive: false, relatedIds: [], review: '', ...extra,
});
describe('Security Control Center evidence rules', () => {
  it('does not add 188 findings and 493 database hints into an unverified total', () => {
    const findings = [...Array.from({ length: 188 }, (_, i) => finding(`deep:${i}`)), ...Array.from({ length: 493 }, (_, i) => finding(`db:${i}`))];
    expect(securityTotals({ findings, deduplicationComplete: false }).total).toBeNull();
    expect(securityTotals({ findings, deduplicationComplete: false }).records).toBe(681);
  });
  it('counts only confirmed open critical or high Product Hub findings as blockers', () => {
    const findings = [finding('high', { confirmed: true }), finding('critical', { confirmed: true, priority: 'P0' }), finding('unverified'), finding('fixed', { confirmed: true, status: 'resolved' }), finding('other', { confirmed: true, area: 'Buchhaltung' }), finding('medium', { confirmed: true, priority: 'P2' })];
    expect(securityTotals({ findings, deduplicationComplete: false }).confirmedBlockers.map(f => f.id)).toEqual(['high','critical']);
  });
  it('deduplicates exact identities without merging unrelated root causes', () => {
    const f = finding('same');
    expect(securityTotals({ findings: [f,f,finding('different')], deduplicationComplete: true }).total).toBe(2);
  });
  it('approvals bind the report revision and never mark a finding resolved', () => {
    const approvals = [{ target: 'scc:v1:item', approved_at: '2026-11-28T03:00:00Z', approved_by: 'super-admin' }];
    expect(correctionApproved('v1','item', approvals)).toBe(true);
    expect(correctionApproved('v2','item', approvals)).toBe(false);
    expect(securityTotals({ findings: [finding('item')], deduplicationComplete: false }).resolved).toBe(0);
  });
});