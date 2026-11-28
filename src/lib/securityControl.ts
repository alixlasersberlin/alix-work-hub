export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type SecurityFinding = {
  id: string; source: string; nativeId: string; title: string; area: string;
  component: string; priority: Priority; confirmed: boolean; status: 'open' | 'resolved';
  cause: string; impact: string; recommendation: string; plannedChange: string;
  dependencies: string[]; tests: string[]; rollback: string; packageId: string;
  potentialFalsePositive: boolean; relatedIds: string[]; review: string;
};
export type SecurityReport = {
  version: string; reportId: string; generatedAt: string; scanStatus: string;
  lastCompleteScan: string | null; lastSuccessfulCheck: string | null;
  sourceCounts: Record<string, number>; deduplicationComplete: boolean;
  findings: SecurityFinding[]; approvals: { target: string; approved_at: string; approved_by: string }[];
  regression: { endpoint: string; unauthorizedStatus: number; authorized: string }[];
  release: { blocked: boolean; reasons: string[]; clientProof: string };
};

export function securityTotals(report: Pick<SecurityReport, 'findings' | 'deduplicationComplete'>) {
  const unique = [...new Map(report.findings.map(f => [f.id, f])).values()];
  const open = unique.filter(f => f.status === 'open');
  return {
    total: report.deduplicationComplete ? unique.length : null,
    records: unique.length,
    resolved: unique.filter(f => f.status === 'resolved').length,
    open: open.length,
    priorities: Object.fromEntries((['P0','P1','P2','P3','P4'] as const).map(p => [p, open.filter(f => f.priority === p).length])) as Record<Priority, number>,
    possibleFalsePositives: open.filter(f => f.potentialFalsePositive).length,
    confirmedBlockers: open.filter(f => f.area === 'Product Hub 2.0' && f.confirmed && ['P0','P1'].includes(f.priority)),
  };
}

export function correctionApproved(reportId: string, id: string, approvals: SecurityReport['approvals']) {
  return approvals.some(a => a.target === `scc:${reportId}:${id}` && !!a.approved_at && !!a.approved_by);
}

export function filterSecurityFindings(findings: SecurityFinding[], search: string, area: string, priority: string, status: string) {
  const q = search.trim().toLocaleLowerCase('de-DE');
  return findings.filter(f => (area === 'all' || f.area === area) && (priority === 'all' || f.priority === priority)
    && (status === 'all' || f.status === status)
    && (!q || `${f.nativeId} ${f.title} ${f.component} ${f.cause}`.toLocaleLowerCase('de-DE').includes(q)))
    .sort((a,b) => a.priority.localeCompare(b.priority) || a.component.localeCompare(b.component, 'de'));
}