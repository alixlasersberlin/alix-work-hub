---
name: Systemweites BCC & CC
description: Alle ausgehenden E-Mails gehen automatisch in BCC an rde@alix-lasers.com und in CC an buchhaltung@alix-lasers.com
type: feature
---
Jede ausgehende E-Mail (alle Edge Functions) erhält automatisch BCC an `rde@alix-lasers.com`
und CC an `buchhaltung@alix-lasers.com`.
Umsetzung: `supabase/functions/_shared/global-bcc.ts` patcht `globalThis.fetch` und ergänzt die
`bcc`- und `cc`-Felder bei allen Resend-Aufrufen (`/resend/emails`, `api.resend.com/emails`).
Neue mailversendende Edge Functions MÜSSEN `import "../_shared/global-bcc.ts";` als erste Zeile enthalten.

Signatur (`_shared/mail-signature.ts`): Rollen-/Funktionsbezeichnungen wie "Chief Operations" werden
als Signaturname unterdrückt (`SUPPRESSED_NAMES`).
