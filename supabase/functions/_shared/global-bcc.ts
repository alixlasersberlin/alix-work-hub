// Systemweite Kopie-Regeln für ALLE ausgehenden E-Mails.
// Side-Effect-Import: patcht globalThis.fetch und ergänzt bei jedem
// Resend-Aufruf (connector-gateway .../resend/emails oder api.resend.com/emails)
// automatisch die Archiv-Adresse im BCC-Feld.
//
// WICHTIG (01.11.2026): service@alix-lasers.com und buchhaltung@alix-lasers.com
// stehen beim E-Mail-Anbieter auf der Sperrliste ("suppressed"). Steht eine
// gesperrte Adresse in CC/BCC, unterdrückt der Anbieter die GESAMTE E-Mail –
// auch für den Kunden. Diese Adressen werden deshalb aus CC/BCC entfernt,
// bis sie beim Anbieter wieder freigegeben sind.

export const GLOBAL_BCC = "rde@alix-lasers.com";

/** Beim Anbieter gesperrte Adressen – dürfen nie als Kopie mitlaufen. */
export const BLOCKED_COPY_ADDRESSES = [
  "service@alix-lasers.com",
  "buchhaltung@alix-lasers.com",
];

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? [...v] : v ? [v] : []);
const isBlocked = (v: unknown) => BLOCKED_COPY_ADDRESSES.some((b) => norm(v).includes(b));

/** Wendet die systemweiten Kopie-Regeln auf eine Resend-Payload an (mutiert obj). */
export function applySystemCopies(obj: any): void {
  if (!obj || typeof obj !== "object") return;

  const noSystemCopies = !!(obj.headers && obj.headers["X-Alix-No-System-Copies"]);
  if (noSystemCopies) delete obj.headers["X-Alix-No-System-Copies"];

  const subj = String(obj.subject ?? "");
  const isDunning = /mahn|zahlungserinnerung|dunning/i.test(subj);
  const to = asList(obj.to);

  // Archiv-BCC (nicht bei Mahnungen, nicht wenn Absender Kopien selbst festlegt)
  if (!noSystemCopies && !isDunning && !to.some((t) => norm(t).includes(GLOBAL_BCC))) {
    const list = asList(obj.bcc);
    if (!list.some((b) => norm(b).includes(GLOBAL_BCC))) list.push(GLOBAL_BCC);
    obj.bcc = list;
  }

  // Gesperrte Adressen immer aus CC/BCC entfernen – sonst wird die ganze Mail unterdrückt
  for (const key of ["cc", "bcc"] as const) {
    if (obj[key] === undefined || obj[key] === null) continue;
    const cleaned = asList(obj[key]).filter((a) => !isBlocked(a));
    if (cleaned.length) obj[key] = cleaned;
    else delete obj[key];
  }
}

const g = globalThis as any;

if (!g.__alixGlobalBccInstalled) {
  g.__alixGlobalBccInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  const isEmailEndpoint = (url: string) =>
    /\/resend\/emails(\/batch)?(\?|$)/.test(url) || /api\.resend\.com\/emails(\/batch)?(\?|$)/.test(url);

  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input?.url ?? "");

      const method = (init?.method ?? (typeof input === "object" ? input?.method : "GET") ?? "GET")
        .toString()
        .toUpperCase();

      if (isEmailEndpoint(url) && method === "POST" && init?.body && typeof init.body === "string") {
        const payload = JSON.parse(init.body);
        if (Array.isArray(payload)) payload.forEach(applySystemCopies);
        else applySystemCopies(payload);
        init = { ...init, body: JSON.stringify(payload) };
      }
    } catch (_e) {
      // Bei Problemen unverändert weiterleiten
    }
    return await originalFetch(input, init);
  }) as typeof fetch;
}
