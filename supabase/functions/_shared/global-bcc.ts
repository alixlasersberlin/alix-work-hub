// Systemweiter BCC-Archiv-Empfänger für ALLE ausgehenden E-Mails.
// Side-Effect-Import: patcht globalThis.fetch und ergänzt bei jedem
// Resend-Aufruf (connector-gateway .../resend/emails oder api.resend.com/emails)
// automatisch die Archiv-Adresse im BCC-Feld.

export const GLOBAL_BCC = "rde@alix-lasers.com";
// Systemweiter CC-Empfänger für ALLE ausgehenden E-Mails
export const GLOBAL_CC = "buchhaltung@alix-lasers.com";

const g = globalThis as any;

if (!g.__alixGlobalBccInstalled) {
  g.__alixGlobalBccInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  const isEmailEndpoint = (url: string) =>
    /\/resend\/emails(\?|$)/.test(url) || /api\.resend\.com\/emails(\?|$)/.test(url);

  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

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
        const apply = (obj: any) => {
          if (!obj || typeof obj !== "object") return;
          // Mahnungen: keine System-Kopien (service@/buchhaltung@/Archiv)
          const subj = String(obj.subject ?? "");
          if (/mahn|zahlungserinnerung|dunning/i.test(subj)) return;
          const to = Array.isArray(obj.to) ? obj.to : obj.to ? [obj.to] : [];
          // Nicht doppelt an denselben Empfänger senden
          if (to.some((t: unknown) => norm(t).includes(GLOBAL_BCC))) return;
          const list = Array.isArray(obj.bcc) ? [...obj.bcc] : obj.bcc ? [obj.bcc] : [];
          if (!list.some((b: unknown) => norm(b).includes(GLOBAL_BCC))) list.push(GLOBAL_BCC);
          obj.bcc = list;

          // Systemweites CC an die Buchhaltung
          if (!to.some((t: unknown) => norm(t).includes(GLOBAL_CC))) {
            const ccList = Array.isArray(obj.cc) ? [...obj.cc] : obj.cc ? [obj.cc] : [];
            if (!ccList.some((c: unknown) => norm(c).includes(GLOBAL_CC))) ccList.push(GLOBAL_CC);
            obj.cc = ccList;
          }
        };

        if (Array.isArray(payload)) payload.forEach(apply);
        else apply(payload);

        init = { ...init, body: JSON.stringify(payload) };
      }
    } catch (_e) {
      // Bei Problemen unverändert weiterleiten
    }
    return await originalFetch(input, init);
  }) as typeof fetch;
}