
## Ziel

Ein neuer Menüpunkt **„Nummernkreise"** unter **OPERATIONS** (nur Super Admin), über den die Start-/Folgenummern aller Vorgangs- und Dokumentarten zentral gepflegt werden. Wird ein Kreis aktiviert, vergeben alle System-Stellen (UI, Edge Functions, PDFs) ab diesem Zeitpunkt Nummern aus diesem Kreis.

## Erfasste Dokument-/Vorgangsarten (initial)

| Code            | Bezeichnung                       | Beispiel-Format          |
|-----------------|-----------------------------------|--------------------------|
| `offer`         | Angebot                           | `ANG-{YYYY}-{00000}`     |
| `order`         | Auftragsbestätigung               | `AB-{YYYY}-{00000}`      |
| `delivery_note` | Lieferschein                      | `LS-{YYYY}-{00000}`      |
| `invoice`       | Rechnung                          | `RG-{YYYY}-{00000}`      |
| `credit_note`   | Gutschrift                        | `GU-{YYYY}-{00000}`      |
| `repair`        | Reparaturauftrag                  | `REP-{YYYY}-{000000}`    |
| `repair_quote`  | Reparatur-Kostenvoranschlag       | `KV-{YYYY}-{00000}`      |
| `work_order`    | Werkstattauftrag                  | `WA-{YYYY}-{00000}`      |
| `ticket`        | Support-Ticket                    | `TKT-{YYYY}-{000000}`    |
| `production`    | Produktionsauftrag                | `PRD-{YYYY}-{00000}`     |
| `purchase`      | Bestellung Lieferant              | `BST-{YYYY}-{00000}`     |
| `goods_receipt` | Wareneingang                      | `WE-{YYYY}-{00000}`      |
| `bank_request`  | Finanzierungsantrag               | `FIN-{YYYY}-{00000}`     |
| `sepa_run`      | SEPA-Lauf                         | `SEPA-{YYYY}-{00000}`    |
| `reminder`      | Mahnung                           | `MA-{YYYY}-{00000}`      |
| `bug`           | Bug-Report (QM)                   | `BUG-{YYYY}-{00000}`     |
| `capa`          | CAPA                              | `CAPA-{YYYY}-{00000}`    |
| `audit`         | Audit-Finding                     | `AUD-{YYYY}-{00000}`     |
| `pdf_security`  | PDF-Security-ID                   | `SEC-{YYYY}-{HEX8}`      |

Liste erweiterbar — neue Codes werden über Migration nachgepflegt.

## Datenmodell

Neue Tabelle `public.number_ranges` (Super-Admin-only):

```text
code            text PK         -- z. B. "offer"
label           text            -- "Angebot"
prefix          text            -- "ANG"
separator       text DEFAULT '-' 
include_year    boolean         -- true → JJJJ-Bestandteil
padding         int             -- Stellenanzahl Zähler (z. B. 5)
current_value   bigint          -- letzter vergebener Wert
start_value     bigint          -- konfigurierter Startwert
reset_yearly    boolean
last_reset_year int
active          boolean         -- AN = systemweit nutzen
format_hint     text            -- Live-Preview-Beispiel, generiert
notes           text
updated_at/by   …
```

Plus zentrale RPC `public.next_document_number(p_code text)`:
- atomar (Row-Lock via `FOR UPDATE`)
- führt Jahresreset durch, wenn `reset_yearly`
- erhöht `current_value`, gibt formatierten String zurück
- ist `active=false` → liefert `NULL` (Aufrufer behält Legacy-Logik)

Plus Helper `public.peek_document_number(p_code text)` für Vorschau ohne Increment.

## Frontend

### Neuer Menüeintrag

`src/components/AppLayout.tsx` → OPERATIONS-Children um  
`{ path: '/operation/nummernkreise', label: 'Nummernkreise', icon: Hash, roles: ['Super Admin'] }` ergänzen.

### Neue Seite `src/pages/operation/Nummernkreise.tsx`

- Tabelle aller Kreise mit Spalten: Aktiv (Switch), Code, Bezeichnung, Präfix, Jahr inkl., Padding, Startwert, aktueller Wert, Beispiel-Vorschau, Bearbeiten.
- „Bearbeiten" öffnet Dialog (Präfix, Jahr, Padding, Startwert, Reset jährlich, Notizen). Live-Preview wird beim Tippen aktualisiert.
- Schalter „Aktiv" speichert sofort und zeigt Toast „Nummernkreis ist jetzt systemweit aktiv".
- Sicherheits-Hinweisbox: Änderungen am Startwert nur möglich, wenn `current_value <= start_value` (sonst Bestätigungsdialog mit Risiko-Hinweis).

### Helper `src/lib/number-ranges.ts`

```text
export async function nextNumber(code: string, fallback: () => string): Promise<string>
export async function peekNumber(code: string): Promise<string | null>
```

`nextNumber` ruft RPC; bei `null` (inaktiv) oder Fehler → `fallback()`. So bleibt das System rückwärtskompatibel.

### Aufrufer umstellen (Phase 1, sichtbarste Stellen)

- `src/pages/AngebotErstellen.tsx` → `nextNumber('offer', legacyAngebot)`
- `src/components/OrderConfirmationTab.tsx` → `nextNumber('order', () => order.order_number)`
- `src/components/DeliveryNoteTab.tsx` → `nextNumber('delivery_note', …)`
- Repair-/Quote-/Work-Order-PDFs (`src/lib/repair/*`)
- `src/lib/pdf-utils.ts` (Security-ID `SEC-…`) → `nextNumber('pdf_security', randomHex)`

Weitere Stellen werden im Anschluss in derselben Form nachgezogen — der Helper ist die einzige Schnittstelle.

## Rechte / RLS

- `number_ranges`: nur `Super Admin` darf SELECT/UPDATE; `authenticated` darf RPC `next_document_number` aufrufen, jedoch nicht direkt auf die Tabelle zugreifen.
- RPC `SECURITY DEFINER`, `search_path = public`.

## Technische Details

- Migration legt Tabelle, GRANTs, RLS und Seed-Zeilen für alle oben gelisteten Codes an (mit aktuellen Werten = 0, `active = false`, damit zunächst Legacy-Logik weiterläuft).
- Edge Functions (`order-confirmation-pdf`, `convert-signed-offer-to-order`, `alix-sign-create` etc.) verwenden den RPC über den Service-Role-Client.
- UI-Komponente nutzt vorhandene Infinity-/Card-Styles, keine neuen Design-Tokens.

## Lieferumfang dieses Schritts

1. Migration `number_ranges` + RPC + Seeds.
2. Sidebar-Eintrag + Route.
3. Seite `Nummernkreise.tsx` (Liste, Edit-Dialog, Aktiv-Schalter, Vorschau).
4. Helper `src/lib/number-ranges.ts`.
5. Erste Integration: **Angebot**, **Auftragsbestätigung**, **PDF-Security-ID** (sofort sichtbarer Effekt). Weitere Module folgen in Folge-Iterationen auf Zuruf.
