/**
 * Diagnose-Helfer für Ladefehler im Modul „Bank & Kontoauszüge".
 * Liefert eine konkrete Fehlermeldung inkl. fehlendem API-Endpoint
 * und einem Korrelationscode, den der Nutzer beim Reload melden kann.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export interface BankLoadError {
  /** Kurzer Klartext für den Nutzer */
  message: string;
  /** z. B. "GET /rest/v1/bank_transactions" */
  endpoint: string;
  /** Vollständige URL, falls ermittelbar */
  url?: string;
  /** Postgres-/HTTP-Fehlercode */
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
  /** Korrelationscode für Support / Logs */
  correlationId: string;
  at: string;
}

function makeCorrelationId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BANK-${t}-${r}`;
}

const HUMAN: Record<string, string> = {
  '42501': 'Keine Berechtigung für diese Tabelle (RLS/GRANT fehlt).',
  '42P01': 'Die angeforderte Tabelle existiert nicht.',
  '42703': 'Eine angeforderte Spalte existiert nicht.',
  PGRST116: 'Kein Datensatz gefunden.',
  PGRST202: 'Der API-Endpoint (RPC/Funktion) existiert nicht.',
  PGRST204: 'Spalte im Schema-Cache nicht gefunden.',
  PGRST301: 'Sitzung abgelaufen – bitte neu anmelden.',
};

/**
 * @param e         gefangener Fehler
 * @param endpoint  z. B. "GET /rest/v1/bank_transactions"
 */
export function describeBankLoadError(e: any, endpoint: string): BankLoadError {
  const code = e?.code ? String(e.code) : undefined;
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const base =
    (code && HUMAN[code]) ||
    e?.message ||
    'Unbekannter Fehler beim Laden der Bankdaten.';

  const isNetwork =
    e?.name === 'TypeError' || /fetch|Network|Failed to fetch/i.test(String(e?.message ?? ''));

  const err: BankLoadError = {
    message: isNetwork
      ? 'Der API-Endpoint ist nicht erreichbar (Netzwerk-/CORS-Fehler).'
      : base,
    endpoint,
    url: SUPABASE_URL ? `${SUPABASE_URL}${endpoint.replace(/^\w+\s+/, '')}` : undefined,
    code,
    status,
    details: e?.details ?? undefined,
    hint: e?.hint ?? undefined,
    correlationId: makeCorrelationId(),
    at: new Date().toISOString(),
  };

  console.error(`[${err.correlationId}] Bank-Ladefehler @ ${endpoint}`, e);
  return err;
}

export function formatBankLoadError(e: BankLoadError) {
  return [
    `Korrelationscode: ${e.correlationId}`,
    `Zeitpunkt: ${e.at}`,
    `Endpoint: ${e.endpoint}`,
    e.url ? `URL: ${e.url}` : null,
    e.status ? `HTTP-Status: ${e.status}` : null,
    e.code ? `Fehlercode: ${e.code}` : null,
    `Meldung: ${e.message}`,
    e.details ? `Details: ${e.details}` : null,
    e.hint ? `Hinweis: ${e.hint}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
