// PRODUCT HUB 2.0 – pure evaluation of the full connection test. Never treats 405 as authentication.
export type Probe = { status: number | null; ms?: number };
export type TestOutcome = {
  reachable: boolean; auth_required: boolean; signature: 'verified' | 'rejected' | 'unsupported' | 'unknown';
  receipt: boolean; result: 'accepted' | 'reachable' | 'auth_required' | 'signature_ok' | 'receipt_ok' | 'error'; message: string;
};
export function evaluateConnectionTest(get: Probe, unsigned: Probe, signed: Probe, receipt: boolean): TestOutcome {
  const reachable = get.status !== null && get.status !== 404 && get.status !== 410 && get.status < 500;
  const auth_required = unsigned.status === 401;
  const signature: TestOutcome['signature'] = signed.status === null ? 'unknown'
    : signed.status === 200 || signed.status === 202 ? 'verified' : signed.status === 401 ? 'rejected'
    : signed.status === 400 || signed.status === 404 || signed.status === 422 ? 'unsupported' : 'unknown';
  if (!reachable) return { reachable, auth_required, signature, receipt, result: 'error', message: get.status === null ? 'Empfänger nicht erreichbar' : `Empfangsmodul nicht verfügbar (HTTP ${get.status})` };
  if (!auth_required) return { reachable, auth_required, signature, receipt, result: 'error', message: `Empfänger nimmt unsignierte Signale an oder antwortet unerwartet (HTTP ${unsigned.status ?? '—'}) – Sicherheitsprüfung fehlgeschlagen` };
  if (signature === 'rejected') return { reachable, auth_required, signature, receipt, result: 'auth_required', message: 'Signatur abgelehnt – Schlüsselwerte in AlixWork und Webseite stimmen nicht überein' };
  if (signature === 'unsupported') return { reachable, auth_required, signature, receipt, result: 'auth_required', message: 'Empfänger unterstützt das Testsignal noch nicht – Testprompt auf der Webseite umsetzen' };
  if (signature !== 'verified') return { reachable, auth_required, signature, receipt, result: 'auth_required', message: `Unerwartete Antwort auf signiertes Testsignal (HTTP ${signed.status ?? '—'})` };
  if (!receipt) return { reachable, auth_required, signature, receipt, result: 'signature_ok', message: 'Signatur geprüft, aber keine authentifizierte Rückmeldung der Webseite erhalten' };
  return { reachable, auth_required, signature, receipt, result: 'accepted', message: 'Technische Abnahme erfolgreich' };
}
