---
name: Systemweites BCC & CC
description: Alle ausgehenden E-Mails (auch Mahnungen) gehen in BCC an service@alix-lasers.com; außer Mahnungen zusätzlich BCC rde@alix-lasers.com und CC buchhaltung@alix-lasers.com
type: feature
---
- service@alix-lasers.com als BCC bei ausnahmslos jeder E-Mail, auch Mahnungen (Nutzerwunsch 26.09.2026).
- Außer bei Mahnungen: BCC an `rde@alix-lasers.com` und CC an `buchhaltung@alix-lasers.com`.
Umsetzung: `supabase/functions/_shared/global-bcc.ts` patcht `globalThis.fetch` für Resend-Aufrufe.
Neue mailversendende Edge Functions MÜSSEN `import "../_shared/global-bcc.ts";` als erste Zeile enthalten.

Signatur (`_shared/mail-signature.ts`): Rollen-/Funktionsbezeichnungen wie "Chief Operations" werden
als Signaturname unterdrückt (`SUPPRESSED_NAMES`).
