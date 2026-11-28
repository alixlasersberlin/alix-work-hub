import report from './control-inventory.json' with { type: 'json' };

export const controlInventory = report;

export function correctionProposal(reportId: unknown, ids: unknown) {
  if (reportId !== report.reportId) throw new Error('Prüfbericht wurde geändert; neu laden.');
  if (!Array.isArray(ids) || !ids.length || ids.length > 25 || ids.some(id => typeof id !== 'string')) throw new Error('Einzelkorrektur oder zusammengehöriges Paket mit höchstens 25 Befunden wählen.');
  const selected = [...new Set(ids)].map(id => report.findings.find(f => f.id === id));
  if (selected.some(f => !f || f.status !== 'open' || f.potentialFalsePositive)) throw new Error('Unbekannter, bereits behobener oder noch als Fehlalarm zu prüfender Befund.');
  const findings = selected.filter((f): f is NonNullable<typeof f> => !!f);
  if (new Set(findings.map(f => f.component)).size !== 1) throw new Error('Korrekturpakete müssen dieselbe betroffene Komponente haben.');
  return findings;
}

export async function approvalIdentity(reportId: string, id: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`scc:${reportId}:${id}`)));
  const hex = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20)}`;
}