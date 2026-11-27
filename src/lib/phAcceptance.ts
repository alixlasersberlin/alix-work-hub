/** Pure rules for the PRODUCT HUB final technical acceptance (display only; never activates production). */
export type AcceptanceTest = { reachable?: boolean; http_get?: number | null; http_signed?: number | null; signature?: string; receipt?: boolean; result?: string; message?: string; test_id?: string; response_ms?: number } | undefined;
export type CheckKey = 'reachable' | 'api' | 'signature' | 'receipt' | 'test_id';
export const CHECK_LABELS: Record<CheckKey, string> = { reachable: 'Erreichbarkeit der Webseite', api: 'API-Verbindung', signature: 'Signaturprüfung', receipt: 'Signierte Rückmeldung', test_id: 'Übereinstimmung der Test-ID' };

export function evaluateChecks(p: AcceptanceTest): Record<CheckKey, boolean | null> {
  if (!p) return { reachable: null, api: null, signature: null, receipt: null, test_id: null };
  const reachable = p.http_get != null && p.http_get < 500 && p.http_get !== 404 && p.http_get !== 410;
  const api = p.http_signed === 200 || p.http_signed === 202;
  const signature = p.signature === 'verified';
  // ph-signal-admin only accepts a receipt whose signed payload carries the same test_id it sent.
  const receipt = p.receipt === true;
  return { reachable, api, signature, receipt, test_id: receipt && !!p.test_id };
}

export const isAccepted = (p: AcceptanceTest) => p?.result === 'accepted' && Object.values(evaluateChecks(p)).every(v => v === true);

/** First failing check with cause, for clear error attribution. */
export function failureCause(p: AcceptanceTest): string | null {
  if (!p) return 'Noch kein vollständiger Verbindungstest';
  const c = evaluateChecks(p);
  const bad = (Object.keys(c) as CheckKey[]).find(k => c[k] !== true);
  if (!bad && p.result === 'accepted') return null;
  return `${bad ? CHECK_LABELS[bad] : 'Abnahme'} fehlgeschlagen: ${p.message || 'unbekannte Ursache'}`;
}

/** Overall readiness only when every required site passed all checks. */
export const allReady = (codes: string[], protocol: Record<string, AcceptanceTest>) => codes.length > 0 && codes.every(c => isAccepted(protocol[c]));
