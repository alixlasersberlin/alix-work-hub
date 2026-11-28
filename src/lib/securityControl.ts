export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
export type SecurityFinding = {
  id: string; source: string; nativeId: string; title: string; area: string;
  component: string; priority: Priority; confirmed: boolean; status: 'open' | 'resolved';
  cause: string; impact: string; recommendation: string; plannedChange: string;
  dependencies: string[]; tests: string[]; rollback: string; packageId: string;
  potentialFalsePositive: boolean; relatedIds: string[]; review: string;
  classification?: 'confirmed' | 'resolved' | 'duplicate' | 'outdated' | 'false_positive' | 'unresolved';
  productHubRelevant?: boolean; correctionPackage?: string; evidence?: string[];
};
export type SecurityReport = {
  version: string; reportId: string; generatedAt: string; scanStatus: string;
  lastCompleteScan: string | null; lastSuccessfulCheck: string | null;
  sourceCounts: Record<string, number>; deduplicationComplete: boolean;
  findings: SecurityFinding[]; approvals: { target: string; approved_at: string; approved_by: string }[];
  regression: { endpoint: string; unauthorizedStatus: number; authorized: string }[];
  release: { blocked: boolean; reasons: string[]; clientProof: string };
  audit?: { complete: boolean; classificationCounts: Record<string, number>; scope: string; limitations: string[]; protectionChecks: { name: string; result: string }[] };
};

export const CORRECTION_PACKAGES = [
  { id: 'A', priority: 'P0', title: 'Kritische Sicherheitsrisiken' },
  { id: 'B', priority: 'P1', title: 'Hohe Sicherheitsrisiken' },
  { id: 'C', priority: 'P2', title: 'Mittlere Sicherheitsrisiken' },
  { id: 'D', priority: 'P3', title: 'Niedrige Sicherheitsrisiken' },
  { id: 'E', priority: 'P4', title: 'Technische Optimierungen' },
] as const;

export const AUDIT_LABELS: Record<string, string> = { confirmed: 'Bestätigtes Risiko', resolved: 'Bereits behoben', duplicate: 'Doppelter Befund', outdated: 'Veraltet', false_positive: 'Kein Expositionsnachweis / Fehlalarm', unresolved: 'Nicht abschließend prüfbar' };

export function productHubSecurityFindings(findings: SecurityFinding[]) {
  return findings.filter(f => f.productHubRelevant ?? f.area === 'Product Hub 2.0');
}

export function productHubSecurityBlockers(findings: SecurityFinding[]) {
  return productHubSecurityFindings(findings).filter(f => f.status === 'open'
    && f.classification !== 'duplicate' && f.classification !== 'false_positive'
    && ((f.confirmed && ['P0', 'P1'].includes(f.priority)) || (!f.confirmed && f.priority === 'P0')));
}

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
    confirmedBlockers: productHubSecurityBlockers(open).filter(f => f.confirmed),
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