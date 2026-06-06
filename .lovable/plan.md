## Ziel

MailCenter wird zur zentralen Kommunikationszentrale: Posteingang pro Abteilung, interne Nachrichten, Notizen, Ticket-Verknüpfungen, Zuweisungen, Benachrichtigungen und Kunden-Timeline.

## Wichtige Vorab-Entscheidung: Eingehende E-Mails

Aktuell sendet das System nur ausgehend über Resend. Für einen echten **Posteingang** mit eingehenden Mails an `finance@`, `vertrieb@`, `service@`, `news@alixwork.de` braucht es Resend Inbound (oder einen MX/IMAP-Bridge-Dienst).

Vorschlag für diesen Schritt:
- Eine neue Edge Function `inbound-mail` wird angelegt, die Resend-Inbound-Webhooks entgegennimmt und Einträge als `direction='inbound'` in `mail_messages` schreibt.
- Du kannst die Funktion später in Resend hinterlegen, sobald Inbound bei euch aktiviert ist. Bis dahin ist der Posteingang sichtbar, aber leer (oder zeigt eingehende Antworten, sobald aktiviert).

Falls du stattdessen eine andere Quelle (IMAP, Zoho Mail, MS365) nutzen willst, sag bitte Bescheid — dann passen wir die Schnittstelle an.

## Schema-Erweiterungen (additiv, keine bestehenden Spalten ändern)

`mail_messages`: ergänzen
- `direction` (`inbound` | `outbound`)
- `mailbox` (`finance` | `vertrieb` | `service` | `marketing` | `personal`)
- `is_read` boolean
- `assigned_to` uuid (user)
- `priority` (`Niedrig` | `Normal` | `Hoch` | `Kritisch`)
- `due_date` timestamptz
- `in_reply_to` text, `thread_id` text

Neue Tabellen:
- `mail_internal_messages` — interne Chat-Nachrichten (sender, recipient_user/recipient_department, body, customer_id?, order_id?, is_read)
- `mail_notes` — interne Notizen an Mail- oder Kunden-Bezug (message_id?, customer_id?, body, created_by)
- `mail_notifications` — In-App Notifications (user_id, type, title, body, link, is_read)

RLS:
- `mail_messages` zusätzliche Policy: Benutzer sieht nur Nachrichten mit `mailbox` seiner Abteilung; Super Admin sieht alles
- Interne Nachrichten/Notizen lesbar für Empfänger/Abteilung/Sender; Super Admin alles
- Benachrichtigungen nur für eigenen User

## Neue MailCenter-Seiten

```text
MailCenter
├─ Dashboard (erweitert)
├─ Posteingang        (neu)
├─ Gesendet           (neu)
├─ Entwürfe           (neu, gefiltert aus mail_messages mit status='draft')
├─ Interne Nachrichten (neu)
├─ E-Mail schreiben
├─ Vorlagen
├─ Kampagnen
├─ Automationen
├─ Tracking
├─ Abmeldungen
├─ Domains
├─ Berichte
└─ Einstellungen
```

### Posteingang
- Tabelle mit Datum, Absender, Betreff, Kunde, Status, Abteilung, Priorität, Zuständig
- Filter: Ungelesen / Heute / Diese Woche / Mit Kunde verknüpft / Mit Auftrag verknüpft
- Klick öffnet Detail-Dialog mit:
  - E-Mail-Inhalt
  - Verknüpfungen (Auftrag/Reparatur/Rechnung/Ticket — automatisch erkannt anhand Kunden-ID)
  - Zuweisung (Mitarbeiter, Priorität, Fälligkeit)
  - Interne Notizen
  - Antworten-Button (öffnet Compose vorausgefüllt)

### Gesendet
- Filter `direction='outbound'` aus `mail_messages`, nach Abteilung gescoped

### Entwürfe
- `status='draft'` aus `mail_messages`; Compose-Page erhält neuen "Als Entwurf speichern"-Button

### Interne Nachrichten
- Zwei-Spalten-Layout: links Liste, rechts Konversation
- Adressaten: einzelner Benutzer oder ganze Abteilung
- Optional verknüpft mit Kunde/Auftrag
- Erscheint nicht als E-Mail, sondern als In-App-Eintrag + Benachrichtigung

## Kundenakte – Kommunikations-Timeline

Bestehendes `CustomerCommunication`-Tab erweitern: zeigt zusätzlich
- Interne Nachrichten (zu diesem Kunden)
- Notizen
- Verknüpfte Tickets/Reparaturen/Aufträge als Timeline-Einträge
- Bestehendes Verhalten bleibt unverändert (nur additive Sektion)

## Zuweisungen

Im Posteingang-Detail:
- Dropdown "Zuständig" (User-Picker aus `user_profiles`)
- Dropdown Priorität
- Datepicker Fälligkeit
- Beim Speichern: Benachrichtigung an den zugewiesenen User

## Benachrichtigungen

- `useNotifications`-Hook (Realtime via Supabase Channel auf `mail_notifications`)
- Glocke im Header (sofern vorhanden) bzw. Badge im MailCenter-Layout
- Trigger:
  - Neue eingehende Mail an Abteilung
  - Zuweisung an mich
  - Neue interne Nachricht an mich/meine Abteilung

## Dashboard-Erweiterungen

Neue Kacheln in MailCenter-Dashboard:
- Neue Nachrichten (ungelesen, eigene Abteilung)
- Offene Kundenanfragen (inbound, unzugewiesen)
- Offene Reparaturen (aus `repair_orders` mit Status ≠ abgeschlossen)
- Offene Tickets (Hinweis: derzeit keine Tickets-Tabelle vorhanden → Kachel zeigt 0 bis Tickets-Modul existiert)
- Kritische Vorgänge (`priority='Kritisch'`)

## Rechte (Mailbox-Sichtbarkeit)

| Rolle              | Mailboxen                                  |
|--------------------|--------------------------------------------|
| Super Admin / Admin | alle                                       |
| Geschäftsführung   | alle (Lesezugriff)                         |
| Finance            | `finance`                                  |
| Vertrieb / Order   | `vertrieb`                                 |
| Technik / Kundenservice / Reparaturannahme | `service`               |
| Marketing          | `marketing`                                |
| Read Only          | nur Lesen (alle die er sehen darf)         |

Umgesetzt via neue SECURITY-DEFINER-Funktion `user_mailboxes()` und Policy `mailbox = ANY(user_mailboxes())`.

## Edge Functions (neu)

- `inbound-mail` (verify_jwt = false) — empfängt Resend-Inbound-Webhook, sucht Kunde per `to`-Domain → `mailbox`, per `from`-Email → `customer_id`, legt `mail_messages` an, erstellt Benachrichtigung für Abteilung.
- `send-internal-message` — nicht zwingend nötig; Insert kann direkt aus dem Client erfolgen (RLS schützt). Wir nehmen die Client-Insert-Variante, um Komplexität gering zu halten.

## Was sich nicht ändert

- `orders`, `customers`, `repair_orders`, `production_orders`, `user_profiles`, `roles`, `user_roles` werden nicht angefasst.
- Bestehende MailCenter-Funktionen (Compose, Vorlagen, Kampagnen, Automationen, Tracking, Abmeldungen) bleiben unverändert; sie bekommen nur additive Querverweise (z.B. Compose erhält "Als Entwurf speichern", Detail-Dialog kann von Posteingang aus aufgerufen werden).

## Offene Frage vor Umsetzung

Eingehende Mails: ist **Resend Inbound** für eure Domain aktiviert/geplant, oder soll der Posteingang vorerst nur intern gesendete + manuell erfasste Einträge zeigen?

Wenn du grünes Licht gibst (auch ohne sofortiges Inbound-Setup), baue ich alles oben aufgeführte in einem Rutsch.