---
name: Systemweites BCC
description: Alle ausgehenden E-Mails gehen automatisch in BCC an rde@alix-lasers.com
type: feature
---
Jede ausgehende E-Mail (alle Edge Functions) erhält automatisch BCC an `rde@alix-lasers.com`.
Umsetzung: `supabase/functions/_shared/global-bcc.ts` patcht `globalThis.fetch` und ergänzt das
`bcc`-Feld bei allen Resend-Aufrufen (`/resend/emails`, `api.resend.com/emails`).
Neue mailversendende Edge Functions MÜSSEN `import "../_shared/global-bcc.ts";` als erste Zeile enthalten.
