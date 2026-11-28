# Paket C – Mittlere Risiken

Nur vorbereitet, nicht ausgeführt. Keine gemeinsame automatische Freigabe; ursprüngliche revisionsgebundene Einzel-/Komponentenfreigabe bleibt bestehen. Ungeklärte Risiken sind Prüfaufträge, keine bestätigten Schwachstellen.

## lov_finding_0102a501f467e0c8

unresolved · supabase/functions/plm-purchase-order-send/index.ts

Ursache: The handler verifies only sign-in and accepts a request-named po_id. Its service-role update bypasses policy plm_po_upd on public.plm_purchase_orders, whose authenticated UPDATE rule requires plm_can_write().

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler executes a privileged service-role database update on plm_purchase_orders, changing sent_at and status without verifying PLM update authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_017d28bf009065b2

unresolved · delivery-approval-escalation

Ursache: An internet visitor can invoke this route because JWT verification is disabled, and the handler processes pending approvals without checking a machine credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can trigger database notification inserts and send email reminders to employees.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_020175bdef3ecb52

unresolved · supabase/functions/mediapaket-portal/index.ts

Ursache: The token-authenticated save_section action reads values from the request body and spreads all of its properties into the database payload.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Unfiltered caller-supplied fields in values are directly persisted to Postgres database tables via admin client insert and update calls.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_06a1757d08bfe5a6

unresolved · supabase/functions/github-status/index.ts

Ursache: An unauthenticated HTTP request reaches the Deno handler at supabase/functions/github-status/index.ts:31. It loads the configured repository using the service key and fetches repository data with the server's GitHub token at lines 60 and 65, without authenticating the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Uses server GitHub token to query private GitHub repository details and commits, returning commit history to unauthenticated callers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_06a1b8184d6c963c

unresolved · notify-order-change-request

Ursache: The database trigger sends no machine credential, and the route has no scheduler or role check; a signed-in user can invoke it with a valid session and an existing request identifier.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Calls Resend API to send external emails to administrators without verifying caller authentication or shared secret.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0d8093ef07d6af38

unresolved · supabase/functions/ac-customer-score/index.ts

Ursache: Anyone on the internet can submit a contact_id; the function reads it without checking identity or contact ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service-role client mutates durable customer score records in ac_customer_scores table using unvalidated caller-supplied contact ID.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_150543f5792e8bf6

unresolved · supabase/functions/alixdocs2-workflow-scan/index.ts

Ursache: The Deno handler proceeds from OPTIONS handling directly into service-role setup; it has no authentication check before performing its work.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated function performs durable inserts into app_notifications using the service role client based on private document scans.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1907356ca29b5e03

unresolved · supabase/functions/admin-resend-sign/index.ts

Ursache: An unauthenticated request supplies an offer_number in its body.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler triggers external transactional emails to customer and internal mailboxes via sendLovableEmail.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1a19768baf09053c

unresolved · supabase/functions/ac-sentiment-emotion/index.ts

Ursache: The handler accepts caller-supplied contact_id and conversation_id and later uses them in a service-role insert.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts predictions into public.ac_predictions via service role client without validating contact_id or conversation_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_274746008eddd8d1_2cf3a0b0

unresolved · alix-copilot: lager_devices search

Ursache: A signed-in user supplies chat text that is passed to the AI tool loop, which generates the search_lager_devices argument used here.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: args.query is directly interpolated into PostgREST .or() filter string without sanitization, allowing query operator injection to extract durable database rows.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_274746008eddd8d1_4c48cf10

unresolved · alix-copilot: zoho_invoices search

Ursache: A signed-in user supplies chat text that is passed to the AI tool loop, which generates the search_invoices argument used here.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Unsanitized args.query is interpolated into PostgREST .or() query filter selecting zoho_invoices data from the database.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_274746008eddd8d1_52f768d4

unresolved · alix-copilot: production_orders search

Ursache: A signed-in user supplies chat text that is passed to the AI tool loop, which generates the search_production_orders argument used here.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unfiltered database records from production_orders are read via privileged admin client and returned in direct response/chat.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2989a7a085c7a5ca_43adb61f

unresolved · supabase/functions/dispatch-eta-sms/index.ts

Ursache: Any signed-in user supplies a route identifier; after validating only that the session exists, the action looks up the route with privileged credentials and does not check route ownership or staff authority.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged database read of customer contact phone followed by external SMS dispatch via Twilio API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2989a7a085c7a5ca_7bf9a994

unresolved · supabase/functions/dispatch-eta-sms/index.ts

Ursache: The handler parses route_plan_id from the request and uses it to select a route plan without an ownership check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler dispatches an external Twilio SMS to the contact's phone number and mutates route_plans.eta_at and customer_communication_log in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2cb579b793ccfdb4

unresolved · supabase/functions/ticket-csat-dispatch/index.ts

Ursache: There is no caller verification before service-role queries read customer emails from tickets and insert survey rows. The survey table's authenticated SELECT policy "csat_select_team" restricts reads to internal roles, but this handler's queries bypass that policy.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger service-role queries on private customer tickets, insert survey records with survey tokens, and trigger external email dispatches.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2fb7d1a4dd334d95

unresolved · ticket-customer-notify

Ursache: An internet visitor can invoke this route because JWT verification is disabled, and the handler accepts an email address and message details without checking a machine credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The trigger-invoked internal edge function has verify_jwt = false and no shared secret check, allowing unauthenticated email dispatch.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_32dd59d975d3ed9f

unresolved · supabase/functions/alixdocs-smart-match/index.ts

Ursache: The public POST handler accepts document_id without authenticating a user, then fetches the document using a service-role client.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated caller obtains extracted fields and matching candidates derived from private document data in alixdocs_documents.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_37aebb1aa2b73448

unresolved · supabase/functions/twilio-send-whatsapp-message/index.ts

Ursache: Any signed-in user can supply a conversation identifier in the request; after validating only that the user's token is valid, the code reads that conversation and uses its customer phone number without checking ownership or role.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Any authenticated user can supply any conversation_id or direct phone number to send outbound WhatsApp messages via service-role DB lookup and Twilio external messaging API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_44ec9efee945753d_16baf99a

unresolved · supabase/functions/return-note-send/index.ts

Ursache: Any authenticated caller supplies the return_id in the request body; the handler verifies sign-in but does not bind the record to the user.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler reads the delivery_returns record using the service role key based solely on a request-provided return_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_44ec9efee945753d_4d29d29f

unresolved · supabase/functions/return-note-send/index.ts

Ursache: Any signed-in user passes the identity check, and can supply a return ID and destination email without a role or ownership check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads unconstrained delivery return record and sends an email via external Resend connector.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_47008b040e014166_4d25e559

unresolved · supabase/functions/catalog-share-send/index.ts

Ursache: The handler accepts caller-controlled subject and body after verifying only that the caller is signed in.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Authenticated callers invoke send-mail with arbitrary caller-supplied subject and text body sent to external recipients.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_47008b040e014166_cf58c780

unresolved · supabase/functions/catalog-share-send/index.ts

Ursache: Any authenticated caller supplies link_id in the request body; the handler verifies sign-in but performs no ownership or role check for that ID.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The service-role query reads link tokens and recipient PII from catalog_share_links for arbitrary caller-chosen link IDs without verifying ownership or catalog roles.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_47008b040e014166_d4c40570

unresolved · supabase/functions/catalog-share-send/index.ts

Ursache: The handler accepts caller-controlled body after verifying only that the caller is signed in.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler makes outbound calls to Twilio's paid API sending caller-controlled body text to the link recipient.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5219762f92dc1e2c

unresolved · alixdocs-autofile

Ursache: A signed-in user supplies arbitrary base64 file contents and a MIME type in the request body; the handler decodes the contents without checking a maximum size or permitted type.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: admin.storage.from('alixdocs-private').upload writes unvalidated files to storage.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5422295243c00d10

unresolved · supabase/functions/sig-partner-api/index.ts

Ursache: A holder of any active partner key supplies a request ID in the GET path; the key check identifies the partner but does not bind the requested ID to that partner.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Queries and returns data from the durable public.sig_requests table via service-role client without verifying owner_user_id or partner binding.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_592ef954aadae794

unresolved · supabase/functions/sig-tsa-timestamp/index.ts

Ursache: Anyone can supply document_id and storage_path; no user, machine, or scoped bearer credential is verified before accessing the service-role database and storage client.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Downloads private documents and inserts audit records into sig_audit_log while triggering external TSA requests.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5dbd6ef95ef7bd34

unresolved · supabase/functions/delivery-escalation-engine/index.ts

Ursache: The Deno handler accepts requests without checking a caller credential and immediately queries with the service-role client.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated function performs durable batch updates, notification inserts across delivery tables, and invokes notification services.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5f0099b70185d10a

unresolved · supabase/functions/customer-portal-lookup/index.ts

Ursache: The public handler parses the request body and accepts order number, ZIP code, and email without verifying a caller credential.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Returns customer name, order number, tracking number, and delivery details from the database without caller authentication.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5f54f5d4f2f742e9

unresolved · supabase/functions/sig-entity-sync/index.ts

Ursache: Anyone can call the handler and supply a document_id in the JSON body; the handler only checks that it is present.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Directly updates database records via service-role client using caller-supplied document_id and status.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6ca1f9488e5d8b1f

unresolved · supabase/functions/ac-predict-cx/index.ts

Ursache: Anyone can submit prediction options to the public function.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler deletes existing records in ac_predictions using service-role authority.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_70c84e6ba8f516cf

unresolved · supabase/functions/alixdocs-signed-url/index.ts

Ursache: An internal signed-in user may insert an arbitrary storage_path through policy "ver_insert" on public.alixdocs_versions, whose only check is uploaded_by = auth.uid(), and may change current_version on a document they uploaded under policy "docs_update" on public.alixdocs_documents.

Erwartete Änderung: Quellobjekte und Dokumentbeziehungen mit den Rechten des Aufrufers prüfen, bevor privilegierte Kopien oder Signaturen entstehen.

Auswirkung auf bestehende Funktionen: The admin client generates a signed URL providing read access to arbitrary storage objects in protected buckets.

Abhängigkeiten: Private Buckets und Mandanten-/Dokumentbeziehungen; Maschinenaufrufer und legitime Kopierverträge

Tests: Andere Benutzer, Buckets und Pfade sperren; Gefälschte Dokumentversionen und Elternbeziehungen; Größe, Dateityp und signierte Ablaufzeiten mit Fixtures

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_72a458552fb60db4

unresolved · supabase/functions/ticket-user-notify/index.ts

Ursache: An authenticated caller who can read a ticket may insert a notification with an arbitrary user_id, title, and message under policy "ticket_notifications insert scoped". Database trigger function public.trg_ticket_notify_user_email invokes this endpoint with the new notification ID; the handler maps that ID to the profile email and forwards the stored content to Resend.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ticket readers inserting a notification row cause the trigger to invoke ticket-user-notify, dispatching an outbound email via Resend to the chosen user_id recipient.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_75970fb38ae01b38

unresolved · supabase/functions/ac-omnichannel-orchestrate/index.ts

Ursache: The caller supplies contact_id, which the handler uses directly as the target association in a privileged insert.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service-role insert writes a new prediction row referencing the caller-chosen contact_id into ac_predictions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7c49fdc537737f7d_50ac0c04 [PRODUCT HUB]

unresolved · supabase/functions/ph-com-registry-push/index.ts

Ursache: The Deno.serve handler processes requests without checking a user, machine, or provider credential.

Erwartete Änderung: Bestehende Legacy-Sperre erhalten; zusätzlich exakte aktive Super-Admin-/Mandantenprüfung vor privilegierten Aufrufen, erlaubte Zielpfade/Methoden und vorhandene Release-Regeln erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint reads internal product mapping rows from public.ph_lang_sync_map using service-role credentials and returns them to unauthenticated callers.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Fehlende Aufruferauthentifizierung im Quellcode bestätigt; bestehende controlled_modes-Sperre beendet den Handler aktuell VOR der beanstandeten Operation. Daher keine aktuelle externe Ausführung behauptet. Risiko bei späterer Aufhebung ungeklärt und freigabeblockierend.

## lov_finding_7c49fdc537737f7d_d30fbb88 [PRODUCT HUB]

unresolved · supabase/functions/ph-com-registry-push/index.ts

Ursache: Anyone on the internet can select the register action; the route creates a privileged database client without verifying a caller credential.

Erwartete Änderung: Bestehende Legacy-Sperre erhalten; zusätzlich exakte aktive Super-Admin-/Mandantenprüfung vor privilegierten Aufrufen, erlaubte Zielpfade/Methoden und vorhandene Release-Regeln erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger outbound registration requests to the external site API using the server's private write key.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Fehlende Aufruferauthentifizierung im Quellcode bestätigt; bestehende controlled_modes-Sperre beendet den Handler aktuell VOR der beanstandeten Operation. Daher keine aktuelle externe Ausführung behauptet. Risiko bei späterer Aufhebung ungeklärt und freigabeblockierend.

## lov_finding_860f4ef640ddf1ef

unresolved · supabase/functions/alix-copilot/index.ts

Ursache: Reads messages from the authenticated caller’s request body without validating or fixing their roles.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Authenticated users can specify arbitrary message roles including system instructions in AI requests, bounded by user session and available AI tools.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_87f0fa502bc83a67

unresolved · supabase/functions/portal-delivery-confirm/index.ts

Ursache: A visitor controls the request body, including order number, email, postal code, and response; matching these values is not verification of a user, machine, or provider credential.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Durable upsert to order_delivery_status via service-role client modifying customer confirmation status.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8810db495c44e4dc

unresolved · supabase/functions/ac-compliance-governance/index.ts

Ursache: The public handler accepts the log operation and contact_id from the request body without authenticating or binding the target contact to a caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged client inserts audit record linking arbitrary contact_id into ac_predictions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_94d5de7f4e719207

unresolved · supabase/functions/delivery-notify/index.ts

Ursache: Any signed-in caller may choose an order and set body.to; no authorization binds the caller to that order or its customer before the email is sent.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler sends external emails via Resend (and SMS via Twilio) to an arbitrary recipient chosen in request body (`body?.to`).

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a0a15fd7005174ce

unresolved · supabase/functions/ac-segment-preview/index.ts

Ursache: supabase/functions/ac-segment-preview/index.ts:16: The request supplies segment_id, which is used directly as the target ID.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The service-role client executes an update modifying contact_count and last_computed_at on the target ac_segments row.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a11f999fb688bec4

unresolved · supabase/functions/alixdocs-autofile/index.ts

Ursache: supabase/functions/alixdocs-autofile/index.ts

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: admin.from('alixdocs_documents').insert associates documents with arbitrary order_id or customer_id using privileged service_role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a9aed7be0c362baa

unresolved · ac-playbook-run

Ursache: The scheduled request uses the published anonymous key, which a visitor can replay, and the route runs enabled playbooks without validating a machine credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated invocations trigger external Twilio SMS, WhatsApp messages, transactional emails, and database ticket insertions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ad6f5c1d67558ce5

unresolved · ticket-create-appointment

Ursache: Anyone can submit a public booking with chosen name, service, and email values; the booking stores those values in a ticket that the appointment email later reads.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sends outbound appointment emails with unescaped HTML markup interpolated from stored ticket data.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_add1d8017d448ff5

unresolved · supabase/functions/esc-send-email/index.ts

Ursache: The handler accepts caller-controlled recipient and body/subject override from the JSON request after checking only that the recipient is present.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Any signed-in user can supply arbitrary recipient, subject, and body parameters that are forwarded to the send-mail service to trigger outbound emails to external recipients.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_af4f84c67e6034af

unresolved · supabase/functions/sig-reminders-run/index.ts

Ursache: Anyone on the public internet can invoke this handler; it processes overdue private requests without requiring a user, machine, or provider credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated edge function performs durable updates to sig_requests and sig_documents and sends external transactional emails.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b143826790bf7b30

unresolved · supabase/functions/ac-marketplace/index.ts

Ursache: The handler verifies only that the bearer token is valid, then accepts body.url from that caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler executes an outbound HTTP POST to an arbitrary HTTPS destination chosen by the requester.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b58065ea66d180e4

unresolved · supabase/functions/mail-unsubscribe/index.ts

Ursache: supabase/functions/mail-unsubscribe/index.ts

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service-role update mutates the unsubscribed_at timestamp on mail_messages rows matching any supplied to_email.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b6bb2ca602686e62

unresolved · supabase/functions/ac-compliance-governance/index.ts

Ursache: The Deno.serve handler accepts the audit operation from the request body without checking any caller credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated caller can read aggregated counts of calls, recordings, conversations, and scans.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b9ad2e8dc0cbf43e

unresolved · supabase/functions/esc-calendar-sync/index.ts

Ursache: The handler accepts a request-supplied user_id without authenticating the caller before processing calendar connections.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Pushes calendar events to external Google Calendar API using stored third-party credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ba12e323f71e0fa4

unresolved · supabase/functions/return-note-send/index.ts

Ursache: An authenticated caller controls email in the request body; only a basic email format is checked.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function makes an outbound API call to Resend with a caller-supplied recipient email and record details.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bcaf4da9778a3843

unresolved · license-royalty-run

Ursache: The scheduled request uses only the public anonymous key, and the route has no machine-credential or user-role check; a signed-in user can invoke it directly.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts durable royalty transaction records and triggers downstream invoice generation without invoker authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bd3c66fffca55a42

unresolved · supabase/functions/delivery-approval-escalation/index.ts

Ursache: An internet caller invokes the Deno handler; it processes requests without checking an identity or credential before querying delivery records.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated invocation triggers escalation workflows that write to delivery_approval_events, insert app_notifications, and send outbound reminder emails.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cc294c6fc858dbbb

unresolved · supabase/functions/carrier-shipment-send/index.ts

Ursache: A signed-in user supplies any assignment_id; after verifying only that the user is signed in, the action loads the matching assignment with privileged access and does not check the user's authority over it.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function bypasses RLS using the service role key to query sensitive appointment and customer details by caller-supplied assignmentId without authorization checks, then dispatches an external email containing these details.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cec0ac18e56d6bd7_b5f2cb8f

unresolved · supabase/functions/offer-followup-engine/index.ts

Ursache: An authenticated caller without tenant assignments gets unrestricted scope and can invoke task insertion without any role check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Direct insert into offer_followup_tasks creates tasks in durable store for offer owners.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cec0ac18e56d6bd7_f40c647c

unresolved · supabase/functions/offer-followup-engine/index.ts

Ursache: A signed-in user without tenant assignments receives unrestricted scope; the handler has no role check and processes offers using service-role credentials.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Direct upsert to offer_outcomes modifies offer outcome states in durable storage.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d73d2342e76a806c_30da19e3

unresolved · supabase/functions/ac-copilot-act/index.ts

Ursache: After sign-in, the handler accepts customer_id from params and uses a service-role client for the ticket insert without binding that customer to the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts a ticket record directly associated with an arbitrary customer_id into public.tickets via service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d73d2342e76a806c_b7f288c1

unresolved · supabase/functions/ac-copilot-act/index.ts

Ursache: The handler accepts target_user_id and message content from params; no authorization check binds the target user to the signed-in caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts a notification record directly for any target_user_id into public.app_notifications via service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_da722e431603e2f7

unresolved · supabase/functions/recurring-prenotification/index.ts

Ursache: Any authenticated user passes the handler's only ordinary-user check, token validation; no role or resource-ownership policy runs. The request controls lead_days, which determines the query's due-date population.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged query retrieves customer details from zoho_recurring_profiles and exposes customer names and emails in response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_db22a4167bb6e8c4

unresolved · supabase/functions/ticket-customer-reminder/index.ts

Ursache: An internet visitor can invoke the registered action without a credential; it queries due tickets and uses their stored customer addresses to send reminders.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sending external emails via Resend and updating ticket status and history in Supabase without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e1bc98324f66bddf

unresolved · supabase/functions/ac-report-snapshot/index.ts

Ursache: The Deno handler accepts requests and creates a service-role client without verifying a user or provider credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Handler queries durable tables using service-role client and returns aggregated private KPIs in response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e2d6374bd0210117

unresolved · ticket-customer-reminder

Ursache: Anyone can submit a public booking-ticket request with chosen name, service, and email values; the request stores those values in the ticket. An agent reply can move the ticket into the reminder-eligible state, after which the reminder sends the unescaped name and title as HTML to the stored email address.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sends outbound emails via Resend containing unescaped HTML markup derived from ticket inputs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e82aaa3ddb8d3869

unresolved · ticket-customer-notify

Ursache: Anyone can submit a request that supplies the recipient, customer name, and message; those values are used to build the email without authentication or HTML escaping.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Untrusted message and customer_name values are interpolated directly into the HTML email template and dispatched via Resend.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e89e49121b9f1117

unresolved · supabase/functions/plm-purchase-order-send/index.ts

Ursache: The handler verifies only that the request has a valid signed-in user; it accepts the request's purchase-order id and PDF string without an authorization or content bound.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The edge function sends an outbound email to an external supplier with an attacker-controlled PDF attachment payload (pdf_base64) provided directly in the request body.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_edd66577e687284b

unresolved · supabase/functions/alix-copilot/index.ts

Ursache: Any authenticated caller can submit a request whose tool call names an order number; get_order then queries with the service-role client without applying a verified user or tenant scope.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged admin client queries orders, customer details, and related tables from the durable database and feeds them into copilot response context.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f77af877b06e48ba

unresolved · supabase/functions/delivery-approval-monthly-report/index.ts

Ursache: The public Deno handler proceeds from request parsing to service-role database access without authenticating the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler queries rows from the durable delivery_approvals table using a service role client without authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## db:authenticated:public.ac_dashboard_kpis()

unresolved · public.ac_dashboard_kpis()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_dashboard_kpis(p_tenant_id uuid)

unresolved · public.ac_dashboard_kpis(p_tenant_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_breakdown(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone, _dim text)

unresolved · public.ac_web_breakdown(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone, _dim text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_click_heatmap(_website_id uuid, _page text, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_click_heatmap(_website_id uuid, _page text, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_click_pages(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_click_pages(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_daily_series(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_daily_series(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_live(_website_id uuid)

unresolved · public.ac_web_live(_website_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_session_events(_session_hash text)

unresolved · public.ac_web_session_events(_session_hash text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_sessions(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone, _limit integer)

unresolved · public.ac_web_sessions(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone, _limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_web_top_pages(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone, _limit integer)

unresolved · public.ac_web_top_pages(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone, _limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_wfm_adherence_live()

unresolved · public.ac_wfm_adherence_live()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.activate_break_glass(_target_user_id uuid, _role_id uuid, _reason text, _duration_minutes integer, _ticket_ref text)

unresolved · public.activate_break_glass(_target_user_id uuid, _role_id uuid, _reason text, _duration_minutes integer, _ticket_ref text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs2_fts_search(_query text, _limit integer)

unresolved · public.alixdocs2_fts_search(_query text, _limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs_can_manage_status()

unresolved · public.alixdocs_can_manage_status()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs_soft_delete(_doc_id uuid)

unresolved · public.alixdocs_soft_delete(_doc_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.apply_order_change_request(_id uuid, _note text)

unresolved · public.apply_order_change_request(_id uuid, _note text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.apply_role_change_request(_request_id uuid)

unresolved · public.apply_role_change_request(_request_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.apply_role_template(_user_id uuid, _template_id uuid)

unresolved · public.apply_role_template(_user_id uuid, _template_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.as_force_close_case(_case_id uuid, _reason text)

unresolved · public.as_force_close_case(_case_id uuid, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.assign_invoice_number(p_invoice_id uuid)

unresolved · public.assign_invoice_number(p_invoice_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.auto_merge_safe_customer_duplicates(_dry_run boolean)

unresolved · public.auto_merge_safe_customer_duplicates(_dry_run boolean)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_ai_service()

unresolved · public.can_access_ai_service()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_esc_module()

unresolved · public.can_access_esc_module()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_finance()

unresolved · public.can_access_finance()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_finance_module()

unresolved · public.can_access_finance_module()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_financing()

unresolved · public.can_access_financing()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_import_logs()

unresolved · public.can_access_import_logs()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_mail()

unresolved · public.can_access_mail()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_maintenance()

unresolved · public.can_access_maintenance()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_media_package_file(_path text, _write boolean)

unresolved · public.can_access_media_package_file(_path text, _write boolean)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_orders()

unresolved · public.can_access_orders()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_pdf_import(p_import_id uuid)

unresolved · public.can_access_pdf_import(p_import_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_planning()

unresolved · public.can_access_planning()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_qm()

unresolved · public.can_access_qm()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_repair()

unresolved · public.can_access_repair()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_tickets()

unresolved · public.can_access_tickets()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_access_warranty()

unresolved · public.can_access_warranty()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_admin_social()

unresolved · public.can_admin_social()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_approve_role_request(_request_id uuid, _step_no integer, _approver_role_name text)

unresolved · public.can_approve_role_request(_request_id uuid, _step_no integer, _approver_role_name text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_approve_warranty()

unresolved · public.can_approve_warranty()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_backups()

unresolved · public.can_manage_backups()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_copilot_config()

unresolved · public.can_manage_copilot_config()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_esc_master()

unresolved · public.can_manage_esc_master()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_license()

unresolved · public.can_manage_license()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_mail_campaigns()

unresolved · public.can_manage_mail_campaigns()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_mail_domains()

unresolved · public.can_manage_mail_domains()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_mail_templates()

unresolved · public.can_manage_mail_templates()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_maintenance()

unresolved · public.can_manage_maintenance()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_media_packages()

unresolved · public.can_manage_media_packages()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_orders()

unresolved · public.can_manage_orders()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_payroll()

unresolved · public.can_manage_payroll()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_planning()

unresolved · public.can_manage_planning()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_repair()

unresolved · public.can_manage_repair()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_social()

unresolved · public.can_manage_social()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_tickets()

unresolved · public.can_manage_tickets()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_warranty()

unresolved · public.can_manage_warranty()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_manage_whatsapp_automation()

unresolved · public.can_manage_whatsapp_automation()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_plan_delivery()

unresolved · public.can_plan_delivery()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_read_media_packages()

unresolved · public.can_read_media_packages()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_read_pdf_import(p_import_id uuid)

unresolved · public.can_read_pdf_import(p_import_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_read_ticket(_ticket_id uuid)

unresolved · public.can_read_ticket(_ticket_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_release_delivery_tour()

unresolved · public.can_release_delivery_tour()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_run_ai_service()

unresolved · public.can_run_ai_service()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_send_customer_sms()

unresolved · public.can_send_customer_sms()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_send_whatsapp()

unresolved · public.can_send_whatsapp()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_upload_factory_invoice()

unresolved · public.can_upload_factory_invoice()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_use_alix_sign()

unresolved · public.can_use_alix_sign()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_use_fibu_light()

unresolved · public.can_use_fibu_light()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_view_backups()

unresolved · public.can_view_backups()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_view_delivery()

unresolved · public.can_view_delivery()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_view_finance_module()

unresolved · public.can_view_finance_module()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_view_mail_audit()

unresolved · public.can_view_mail_audit()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.can_write_esc_operational()

unresolved · public.can_write_esc_operational()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.cashbook_reverse(_id uuid, _reason text)

unresolved · public.cashbook_reverse(_id uuid, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.catalog_can_edit()

unresolved · public.catalog_can_edit()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.catalog_can_manage_prices()

unresolved · public.catalog_can_manage_prices()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.catalog_can_read()

unresolved · public.catalog_can_read()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.check_delivery_readiness(_order_id uuid)

unresolved · public.check_delivery_readiness(_order_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.cmr_can_write()

unresolved · public.cmr_can_write()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.complete_password_setup()

unresolved · public.complete_password_setup()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.compliance_can_write(_project_id uuid)

unresolved · public.compliance_can_write(_project_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.compliance_has_access()

unresolved · public.compliance_has_access()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.compliance_is_admin()

unresolved · public.compliance_is_admin()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.compliance_is_member(_project_id uuid)

unresolved · public.compliance_is_member(_project_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.correct_invoice_number(p_invoice_id uuid, p_new_number text, p_reason text, p_old_pdf_url text, p_new_pdf_url text)

unresolved · public.correct_invoice_number(p_invoice_id uuid, p_new_number text, p_reason text, p_old_pdf_url text, p_new_pdf_url text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.create_credit_note(_original_invoice_id uuid, _amount_gross numeric, _vat_rate numeric, _reason text)

unresolved · public.create_credit_note(_original_invoice_id uuid, _amount_gross numeric, _vat_rate numeric, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.create_finance_stakeholder(p_name text, p_email text, p_role text, p_allowed_reports jsonb, p_expires_at timestamp with time zone)

unresolved · public.create_finance_stakeholder(p_name text, p_email text, p_role text, p_allowed_reports jsonb, p_expires_at timestamp with time zone)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.create_invoice_correction(_original_invoice_id uuid, _correction_type text, _reason text, _correction_invoice_id uuid)

unresolved · public.create_invoice_correction(_original_invoice_id uuid, _correction_type text, _reason text, _correction_invoice_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.create_sms_auth_token_secret(p_token text)

unresolved · public.create_sms_auth_token_secret(p_token text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.credit_can_access()

unresolved · public.credit_can_access()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.credit_check_order_block(_customer_id uuid, _amount numeric)

unresolved · public.credit_check_order_block(_customer_id uuid, _amount numeric)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.credit_is_super_admin()

unresolved · public.credit_is_super_admin()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.current_alix_identity_id()

unresolved · public.current_alix_identity_id()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.current_portal_customer_id()

unresolved · public.current_portal_customer_id()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.current_supplier_id()

unresolved · public.current_supplier_id()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.decide_recert_item(_item_id uuid, _decision text, _note text)

unresolved · public.decide_recert_item(_item_id uuid, _decision text, _note text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.delegate_recert_item(_item_id uuid, _reviewer_id uuid)

unresolved · public.delegate_recert_item(_item_id uuid, _reviewer_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.delete_recurring_profile_with_reason(p_id uuid, p_reason text)

unresolved · public.delete_recurring_profile_with_reason(p_id uuid, p_reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.delivery_release_tour(p_tour_id uuid)

unresolved · public.delivery_release_tour(p_tour_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_is_admin()

unresolved · public.esc_is_admin()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_is_staff()

unresolved · public.esc_is_staff()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_user_department_ids(_user_id uuid)

unresolved · public.esc_user_department_ids(_user_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.evaluate_role_context(_role_id uuid, _ip text, _at timestamp with time zone, _tz text)

unresolved · public.evaluate_role_context(_role_id uuid, _ip text, _at timestamp with time zone, _tz text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.fc_create_invoice_draft(p_case_id uuid)

unresolved · public.fc_create_invoice_draft(p_case_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.fc_order_financials(p_order_id uuid)

unresolved · public.fc_order_financials(p_order_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.fibu_light_bank_confirm(p_transaction_id uuid, p_allocations jsonb, p_overpay text, p_source text)

unresolved · public.fibu_light_bank_confirm(p_transaction_id uuid, p_allocations jsonb, p_overpay text, p_source text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.fibu_light_book_payment(p_invoice_id uuid, p_amount numeric, p_payment_date date, p_method text, p_reference text, p_note text, p_full boolean)

unresolved · public.fibu_light_book_payment(p_invoice_id uuid, p_amount numeric, p_payment_date date, p_method text, p_reference text, p_note text, p_full boolean)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_can_write()

unresolved · public.finance_can_write()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_deposit_book(p_deposit_id uuid, p_amount numeric, p_method text, p_reference text, p_booking_date date, p_proof_path text, p_note text)

unresolved · public.finance_deposit_book(p_deposit_id uuid, p_amount numeric, p_method text, p_reference text, p_booking_date date, p_proof_path text, p_note text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_deposit_manual_release(p_deposit_id uuid, p_note text)

unresolved · public.finance_deposit_manual_release(p_deposit_id uuid, p_note text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_deposit_recalc(_deposit_id uuid)

unresolved · public.finance_deposit_recalc(_deposit_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_deposit_set_lock(p_deposit_id uuid, p_lock boolean, p_note text)

unresolved · public.finance_deposit_set_lock(p_deposit_id uuid, p_lock boolean, p_note text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.get_current_user_role_names()

unresolved · public.get_current_user_role_names()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.get_customer_bank_details(_customer_id uuid)

unresolved · public.get_customer_bank_details(_customer_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.get_effective_roles(_user_id uuid)

unresolved · public.get_effective_roles(_user_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.get_mobile_command_center()

unresolved · public.get_mobile_command_center()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_generate_final_report()

unresolved · public.gobd_generate_final_report()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_invoice_number_check(_tenant_id uuid)

unresolved · public.gobd_invoice_number_check(_tenant_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_log_export(_export_type text, _period_from date, _period_to date, _record_count integer, _file_name text, _file_hash text, _status text, _accounting_region text, _tenant_id uuid, _metadata jsonb)

unresolved · public.gobd_log_export(_export_type text, _period_from date, _period_to date, _record_count integer, _file_name text, _file_hash text, _status text, _accounting_region text, _tenant_id uuid, _metadata jsonb)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_log_invoice_event(_invoice_id uuid, _action text, _reason text, _related_invoice_id uuid, _fields text[], _metadata jsonb)

unresolved · public.gobd_log_invoice_event(_invoice_id uuid, _action text, _reason text, _related_invoice_id uuid, _fields text[], _metadata jsonb)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_log_retention_event(_event_type text, _data_class_code text, _object_table text, _object_id uuid, _hold_id uuid, _detail text, _metadata jsonb)

unresolved · public.gobd_log_retention_event(_event_type text, _data_class_code text, _object_table text, _object_id uuid, _hold_id uuid, _detail text, _metadata jsonb)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_org_status()

unresolved · public.gobd_org_status()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_phase15_check()

unresolved · public.gobd_phase15_check()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_record_approval(p_subject text, p_decision text, p_approver_name text, p_approver_role text, p_reason text, p_doc_version text, p_evidence_ref text)

unresolved · public.gobd_record_approval(p_subject text, p_decision text, p_approver_name text, p_approver_role text, p_reason text, p_doc_version text, p_evidence_ref text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_retention_dry_run(_log boolean)

unresolved · public.gobd_retention_dry_run(_log boolean)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_retention_overview()

unresolved · public.gobd_retention_overview()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_set_responsibility(p_area text, p_duty text, p_role_name text, p_person_name text, p_person_email text, p_deputy_name text, p_notes text, p_confirm boolean, p_confirmed_by_name text)

unresolved · public.gobd_set_responsibility(p_area text, p_duty text, p_role_name text, p_person_name text, p_person_email text, p_deputy_name text, p_notes text, p_confirm boolean, p_confirmed_by_name text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.has_alix_id_permission(_permission text)

unresolved · public.has_alix_id_permission(_permission text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.has_tenant_access(_tenant_id uuid)

unresolved · public.has_tenant_access(_tenant_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.hoo_mandanten_stats()

unresolved · public.hoo_mandanten_stats()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_admin()

unresolved · public.is_admin()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_fibu_light()

unresolved · public.is_fibu_light()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_internal_or_supplier()

unresolved · public.is_internal_or_supplier()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_internal_staff()

unresolved · public.is_internal_staff()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_internal_user()

unresolved · public.is_internal_user()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_mobile_supervisor()

unresolved · public.is_mobile_supervisor()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_portal_customer()

unresolved · public.is_portal_customer()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_portal_customer(_customer_id uuid)

unresolved · public.is_portal_customer(_customer_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.is_supplier()

unresolved · public.is_supplier()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.list_staff_names(_ids uuid[])

unresolved · public.list_staff_names(_ids uuid[])

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_audit_event(_action text, _module text, _record_id text, _details jsonb, _ip_address text, _user_agent text)

unresolved · public.log_audit_event(_action text, _module text, _record_id text, _details jsonb, _ip_address text, _user_agent text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.med_can_write()

unresolved · public.med_can_write()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.merge_customers(_primary_id uuid, _duplicate_ids uuid[])

unresolved · public.merge_customers(_primary_id uuid, _duplicate_ids uuid[])

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ml_admin_archive_lead(_lead_id uuid, _archived boolean)

unresolved · public.ml_admin_archive_lead(_lead_id uuid, _archived boolean)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_access_state(p_environment text, p_app_version text)

unresolved · public.mobile_access_state(p_environment text, p_app_version text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_golive_snapshot()

unresolved · public.mobile_golive_snapshot()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_magic_search(q text)

unresolved · public.mobile_magic_search(q text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_my_devices()

unresolved · public.mobile_my_devices()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_pilot_overview()

unresolved · public.mobile_pilot_overview()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_report_incident(p_component text, p_error_code text, p_summary text, p_severity text, p_release_version text, p_metadata jsonb)

unresolved · public.mobile_report_incident(p_component text, p_error_code text, p_summary text, p_severity text, p_release_version text, p_metadata jsonb)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mobile_revoke_devices(_device_id text, _all_others boolean, _current_device_id text)

unresolved · public.mobile_revoke_devices(_device_id text, _all_others boolean, _current_device_id text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.next_backup_window()

unresolved · public.next_backup_window()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.offboard_user(_user_id uuid, _reason text)

unresolved · public.offboard_user(_user_id uuid, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.page_usage_top(_limit integer)

unresolved · public.page_usage_top(_limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.page_usage_track(_path text, _label text, _workspace_code text)

unresolved · public.page_usage_track(_path text, _label text, _workspace_code text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.perf_slow_queries(_limit integer)

unresolved · public.perf_slow_queries(_limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.perf_table_stats(_limit integer)

unresolved · public.perf_table_stats(_limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.perf_unused_indexes(_limit integer)

unresolved · public.perf_unused_indexes(_limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ph_can_edit() [PRODUCT HUB]

unresolved · public.ph_can_edit()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.plm_can_write()

unresolved · public.plm_can_write()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.plm_merge_manufacturers(p_target uuid, p_source uuid)

unresolved · public.plm_merge_manufacturers(p_target uuid, p_source uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.preview_invoice_renumbering(p_period text)

unresolved · public.preview_invoice_renumbering(p_period text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.process_scheduled_grants()

unresolved · public.process_scheduled_grants()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.reject_order_change_request(_id uuid, _note text)

unresolved · public.reject_order_change_request(_id uuid, _note text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.requires_reauth()

unresolved · public.requires_reauth()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.resolve_frei_bestellung_assignment(_order_id uuid)

unresolved · public.resolve_frei_bestellung_assignment(_order_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.revoke_break_glass(_session_id uuid)

unresolved · public.revoke_break_glass(_session_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.revoke_temporary_role_grant(_grant_id uuid, _reason text)

unresolved · public.revoke_temporary_role_grant(_grant_id uuid, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rotate_finance_stakeholder_token(p_id uuid)

unresolved · public.rotate_finance_stakeholder_token(p_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_approve_run(p_run_id uuid, p_confirmation text, p_idempotency_key text)

unresolved · public.rp_approve_run(p_run_id uuid, p_confirmation text, p_idempotency_key text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_can_manage()

unresolved · public.rp_can_manage()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_can_view()

unresolved · public.rp_can_view()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.run_invoice_renumbering(p_period text, p_limit integer)

unresolved · public.run_invoice_renumbering(p_period text, p_limit integer)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.schedule_role_grant(_user_id uuid, _role_id uuid, _valid_from timestamp with time zone, _valid_until timestamp with time zone, _reason text)

unresolved · public.schedule_role_grant(_user_id uuid, _role_id uuid, _valid_from timestamp with time zone, _valid_until timestamp with time zone, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.send_recert_reminders(_campaign_id uuid)

unresolved · public.send_recert_reminders(_campaign_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.session_requires_reauth()

unresolved · public.session_requires_reauth()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.set_factory_invoice_payment_ok(_production_order_id uuid, _ok boolean)

unresolved · public.set_factory_invoice_payment_ok(_production_order_id uuid, _ok boolean)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.set_order_lawyer(_order_id uuid, _reason text)

unresolved · public.set_order_lawyer(_order_id uuid, _reason text)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.sidebar_sales_counts()

unresolved · public.sidebar_sales_counts()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.sod_conflict_report()

unresolved · public.sod_conflict_report()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.start_recertification_campaign(_name text, _description text, _period_end date)

unresolved · public.start_recertification_campaign(_name text, _description text, _period_end date)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.sv_can_read()

unresolved · public.sv_can_read()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.sv_can_write()

unresolved · public.sv_can_write()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.tenant_scope_restricted()

unresolved · public.tenant_scope_restricted()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ticket_merge(_source_id uuid, _target_id uuid)

unresolved · public.ticket_merge(_source_id uuid, _target_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.user_accounting_regions()

unresolved · public.user_accounting_regions()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.user_has_tenant(_tenant_id uuid)

unresolved · public.user_has_tenant(_tenant_id uuid)

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.user_mailboxes()

unresolved · public.user_mailboxes()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.user_tenant_codes()

unresolved · public.user_tenant_codes()

Ursache: Prüfhinweis im Funktionskörper vorhanden; Reichweite, Aktivstatus und Mandantentrennung nicht vollständig belegt.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## lov_finding_00cdd0b3b328bc54

unresolved · supabase/functions/ac-ai-reply/index.ts

Ursache: Anyone can place their own instructions in the customer-service tone setting, so your AI replies may not follow the behavior you expect.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler constructs the system prompt using unsanitized caller input from req.json() (tone and locale), allowing arbitrary system prompt injection in the LLM call.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_01a8fbdc7c7589de

unresolved · supabase/functions/collect-engine/index.ts

Ursache: The endpoint checks that a caller has tenant access and scopes case queries, but retrieves and updates overdue promises globally with service-role credentials.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Overdue promises from all tenants are marked broken, and events and tasks are durably inserted.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_02bcca6e48414285

unresolved · supabase/functions/esc-calendar-sync/index.ts

Ursache: Any signed-in user can supply another user's ID to sync that user's events to external calendar providers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Invokes external calendar APIs (pushToGoogle) using third-party credentials belonging to any targeted user.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0337ac7d70faa2b2

unresolved · supabase/functions/delivery-notify/index.ts

Ursache: Any signed-in user can send delivery details by text to arbitrary phone numbers, so private order information may reach the wrong people.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler triggers external SMS delivery via the Twilio API with a recipient selected from body.sms_to.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_05cb9174c5b00b2b

unresolved · supabase/functions/finance-management-pack/index.ts

Ursache: Anyone can mark finance management packs as generated, so reporting pack status records can be modified arbitrarily.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The service-role client modifies durable records in public.finance_management_packs without verifying target authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0b420202e491e470

unresolved · supabase/functions/send-invoice-mail/index.ts

Ursache: Anyone can find invoice recipients’ email addresses in service logs when delivery fails, so their contact details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Cleartext recipient email address is logged to server diagnostic output (console.error) upon delivery failure.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0c5f1761b23eafc4

unresolved · supabase/functions/ac-translate-live/index.ts

Ursache: Anyone can create analysis records linked to another customer, so unrelated or unwanted information may appear in that person's history.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Allows callers to insert prediction records attached to arbitrary contact_id values into ac_predictions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0dab80f3d6a7ee45

unresolved · src/pages/Finance/CollectDossier.tsx

Ursache: Any workspace member can make a collections printout run actions as another finance user, putting their private records and account access at risk.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Client executes unsanitized HTML in a new window via document.write, running arbitrary script in the authenticated user's origin context with access to Supabase session and protected finance endpoints.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_11a2cb3629c10e17

unresolved · supabase/functions/zoho-invoices-auto-import/index.ts

Ursache: The unauthenticated import handler accepts caller-selected email recipients and sends them a report containing invoice data.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger outbound email sending via Resend with arbitrary recipient addresses specified in request body parameters to and cc.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_13d6e91ec712f40a_938ad76d

unresolved · supabase/functions/ac-router-simulate/index.ts

Ursache: Anyone can retrieve a customer's internal routing score, so private customer information can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged client reads ac_customer_scores and returns the score in the JSON response to the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1b423c4366778754_fe81bc8c

unresolved · supabase/migrations/20260720212030_9bf55c82-51cf-4ae2-b9f5-c0c3c167c120.sql

Ursache: Any signed-in user can see another website’s experiment results, so confidential visitor and conversion data can be exposed across accounts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Fetches experiment metadata and analytics event aggregates for caller-provided _experiment_id from durable store without authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1cc3025fab2995d5

unresolved · supabase/functions/alix-sign-resend/index.ts

Ursache: Anyone with a signing link can send signed-document confirmations to arbitrary addresses, so private signed paperwork may be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function sends an outbound email to an unauthenticated caller-specified email address containing document details and a private signing/PDF access link.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_20c2cb8fbb147660

unresolved · supabase/functions/return-note-send/index.ts

Ursache: After verifying only that the requester is signed in, the handler reads the service-role delivery_returns record named in return_id without checking the caller's authority over that return.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler queries delivery_returns using the service role client for any caller-specified return_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2332a1f29f9db74a

unresolved · supabase/functions/alixdocs-stats/index.ts

Ursache: The service-role query bypasses approval-state RLS after checking only sign-in, exposing pending approval rows without binding them to the caller's role or tenant.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Pending approval records containing document IDs and timestamps are read from alixdocs_approval_states via service-role and returned in the HTTP response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_25dad4320ccfe444

unresolved · supabase/functions/auth-email-hook/index.ts

Ursache: Anyone can find account email addresses in service logs, so users’ contact details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Cleartext recipient email address is written to edge function server logs on every processed auth hook event.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_265e0876fae815a7

unresolved · supabase/functions/ac-translate-live/index.ts

Ursache: The endpoint sends caller-supplied text to the metered translation API without verifying a caller credential and returns the translation.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Invokes the paid/metered Lovable AI gateway LLM API (google/gemini-3-flash-preview) using the backend LOVABLE_API_KEY.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_26ec1c8b0892a48e_4ae2f503

unresolved · supabase/functions/alixsmart-send-reminder/index.ts

Ursache: Staff with AlixSmart access can send arbitrary message text in customer reminder SMS, so recipients may receive unwanted or spoofed messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sends an external SMS to the customer containing caller-supplied message_text via send-customer-sms.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_26ec1c8b0892a48e_8c170482

unresolved · supabase/functions/alixsmart-send-reminder/index.ts

Ursache: Staff with AlixSmart access can send arbitrary custom text in customer reminder emails, so recipients may receive unwanted or spoofed messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sends an external transactional email to the customer with caller-controlled message text via send-transactional-email.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_28bb477650901ea0_03257293

unresolved · supabase/functions/delivery-approval-monthly-report/index.ts

Ursache: Anyone can trigger the monthly delivery approval report query and email dispatch without providing any credentials.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated handler reads operational delivery approval records from the delivery_approvals table using service-role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2982b15a37ac400e

unresolved · supabase/functions/ac-segment-auto-enroll/index.ts

Ursache: Anyone can enroll contacts in your saved customer journeys, so customers may receive unapproved communications and automation may be disrupted.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated requests trigger persistent inserts of journey runs into ac_journey_runs using privileged service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2989a7a085c7a5ca_43adb61f_43adb61f

unresolved · supabase/functions/dispatch-eta-sms/index.ts

Ursache: Any signed-in user can send an arrival-time text for another customer’s route, so customers may receive unauthorized delivery messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Twilio SMS message dispatch is executed based on contact data read from the unverified target route plan.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2a0a6ab683598d2c

unresolved · supabase/functions/twilio-send-whatsapp-message/index.ts

Ursache: Any signed-in user can send messages through other conversations, so customers can receive unauthorized or misleading messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Using an arbitrary conversation_id, any authenticated caller sends external WhatsApp messages and inserts messages into that conversation using privileged credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2c7eff56f6c247f6

unresolved · supabase/functions/ai-center-chat/index.ts

Ursache: Anyone can set the instructions and message roles for your AI chat, so its answers can be steered to ignore intended behavior.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint forwards caller-supplied messages directly to the Lovable AI gateway without enforcing server-owned instructions or roles.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_354aea63d3df7954

unresolved · Scannerposition nicht auflösbar

Ursache: Any signed-in user can see service-wide visitor chat and satisfaction trends, so customer activity is exposed beyond administrators.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads across all customer chat sessions in ac_portal_chat_sessions via SECURITY DEFINER, exposing service-wide deflection metrics to any authenticated user.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_35f07aac3006ae6a

unresolved · supabase/functions/ac-copilot/index.ts

Ursache: An authenticated user without repair or ticket permissions can query restricted knowledge-base entries through copilot suggestions, exposing internal technical guides.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Durable knowledge base content is retrieved bypassing RLS via service_role client and reflected in the AI prompt and returned copilot response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_37bccb3f32dd2746

unresolved · supabase/functions/delivery-reminder-engine/index.ts

Ursache: Anyone can trigger the reminder job to cancel overdue delivery appointments, disrupting planned deliveries.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can trigger cancellations that update delivery_appointments and delivery_confirmation_tokens and dispatch emails.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3869d263c93d44fa_6e92169a

unresolved · supabase/functions/ac-voice-agent-studio/index.ts

Ursache: The authenticated caller supplies body.system, which the handler places directly in the model's system-role message during test actions.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Authenticated callers supply the system prompt directly in body.system when calling Lovable AI Gateway chat completions, overriding model instructions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3869d263c93d44fa_cf88288a

unresolved · supabase/functions/ac-voice-agent-studio/index.ts

Ursache: Any signed-in user can replace the instructions for the voice test, so its replies may no longer follow the behavior your team expects.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Caller provides custom system instructions via body.system sent directly to the model as role system.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3945c4fc0435bfbd

unresolved · supabase/functions/alixdocs-share-create/index.ts

Ursache: Any signed-in user can create a share link for another user's documents, so private records can be distributed outside their intended audience.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The privileged client inserts caller-selected document IDs into alixdocs_share_links without ownership checks, durably registering public share access.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3cc542a190045cc9

unresolved · supabase/functions/ac-predict-cx/index.ts

Ursache: Anyone can replace risk assessments for your customers, so your team may act on inaccurate customer priorities and outreach recommendations.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The edge function ac-predict-cx deletes existing prediction records in ac_predictions and inserts newly computed prediction records using service-role authority.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3d80d0bf4e587b07

unresolved · supabase/functions/mediapaket-portal/index.ts

Ursache: Any signed-in user can put customers’ names and email addresses in service logs, so customers’ contact details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint reads customer personal details (email, company_name, contact_name) from the durable customers table using admin client and logs them to server console.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3dec4d354164ba27

unresolved · supabase/migrations/20260804184126_b8a11bb9-a2dc-44f9-9209-14a6cef0f710.sql

Ursache: Any signed-in user can see company-wide message, contact, and campaign totals, so private business activity is exposed across organizations.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Queries count of rows across ac_messages, ac_conversations, ac_contacts, ac_analytics_events, ac_campaigns without tenant/user scoping.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_407a2fad5d5da185

unresolved · supabase/functions/alixdocs-link-suggest/index.ts

Ursache: Anyone can create document links, so unauthorized document relationships can be forged in the system.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function writes suggested links to alixdocs_document_links using a service_role client when unauthenticated.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_469d7227e73bfe40

unresolved · supabase/functions/rp-prepare-run/index.ts

Ursache: Anyone can create billing runs from active customer payment plans, so unauthorized billing records can be generated.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Calls rp_prepare_run via privileged service role client, inserting billing run preview records into durable database storage.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_46f5161d4ac3e8ad

unresolved · supabase/functions/delivery-rating-report/index.ts

Ursache: Anyone can trigger the delivery report to email customer comments to the operations team, so staff can be flooded with unwanted messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint dispatches outbound emails via Resend API to fleet notify recipients when invoked without authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4809e17ddecfd250

unresolved · src/components/MediapaketExtrasPanel.tsx

Ursache: Anyone with a customer link can put a spreadsheet command in a reply that staff export, so opening the audit file could run unwanted actions on their computer.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Customer comment text is wrapped in double quotes without neutralising leading formula triggers (=, +, -, @) before generating CSV downloaded by staff.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4b4bcfe2cea75010

unresolved · supabase/functions/sig-reminders-run/index.ts

Ursache: Anyone can invoke the signing reminders edge function without authentication to expire overdue requests and send reminder emails.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated edge function performs durable updates to sig_requests and sig_documents and triggers external transactional emails.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4c0bbf2efd550541

unresolved · supabase/functions/ac-marketplace/index.ts

Ursache: Any signed-in user can supply an arbitrary HTTPS URL, which the handler posts to without restricting its host.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler triggers an outbound HTTP POST request to an arbitrary caller-supplied HTTPS URL with caller-specified event data.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4d6315961d05d287

unresolved · supabase/functions/alixdocs-smart-match/index.ts

Ursache: An unauthenticated request selects a private document whose OCR content is sent to the configured paid AI gateway, and the extracted result is returned to the caller.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated caller can trigger external metered AI completions using the server's Lovable API key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4ebe56dff6eddc47

unresolved · supabase/functions/sig-bulk-create/index.ts

Ursache: Any signed-in user can put signers’ email addresses in service logs when a row fails, so their contact details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Cleartext signer email address from batch processing is logged to server diagnostic output (console.error) on error.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_51533bb728cbdfe3

unresolved · Scannerposition nicht auflösbar

Ursache: Any signed-in user can see journey trends across all sites, so other customers' marketing performance is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads and aggregates events across all websites from ac_analytics_events, bypassing RLS via SECURITY DEFINER.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_516989238126e1bc

unresolved · supabase/functions/offers-ai-score/index.ts

Ursache: Any signed-in user can view details of arbitrary offers by supplying their IDs, bypassing sales role restrictions.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Fetches sensitive offer details from public.offers using service_role, bypassing RLS SELECT policy which restricts access to sales roles or creators.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5374119f29248b31

unresolved · supabase/functions/sales-wizard-submit/index.ts

Ursache: Anyone can trigger calls to the paid AI completion gateway, incurring metered costs on the project's key.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated request calls Lovable's metered AI gateway (https://ai.gateway.lovable.dev/v1/chat/completions) with the server's API key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_543c07a8ca35880a

unresolved · supabase/functions/ac-campaign-track/index.ts

Ursache: Anyone can change whether another person opened or clicked a campaign, so your campaign engagement records cannot be trusted.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers update opened_at/clicked_at timestamps in ac_campaign_recipients table using privileged service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_561c551c36bc7973

unresolved · supabase/functions/return-note-send/index.ts

Ursache: Any signed-in user can email another customer's return details, so private return information may be sent outside the company.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler fetches return data without ownership verification and transmits it via an outbound email through Resend.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_56d0c79c1318c3ea [PRODUCT HUB]

unresolved · supabase/functions/product-hub-com-canary/index.ts

Ursache: The render_check action uses the request-provided URL directly as a server-side fetch destination.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: An admin can make the edge function fetch arbitrary external URLs specified in payload.url and persist Canary check status to the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5ef16fc648f4d05d

unresolved · supabase/functions/fleet-maintenance-alerts/index.ts

Ursache: Anyone can trigger maintenance emails to the operations team, so staff can be flooded with unwanted messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Triggers external email dispatch via Resend API to internal fleet notification addresses.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_61db72fc9101d76e

unresolved · supabase/functions/portal-offer-action/index.ts

Ursache: Any signed-in user can put deceptive content in offer emails, so staff may mistake it for trusted information about an agreement.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unescaped user input fields (acceptedByName, declineReason, declineNote) are embedded into an HTML email sent via external API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_63fca018638248be_d445dec6

unresolved · supabase/functions/ac-chat/index.ts

Ursache: The public poll action reads messages for any conversation ID belonging to the website, with no visitor ownership or session-capability check.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged database query reads confidential conversation messages from ac_messages and returns them directly in the HTTP response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_69960c8d8502d094

unresolved · supabase/functions/finance-reminder-engine/index.ts

Ursache: Any signed-in user without a tenant assignment can create payment reminders across all tenants, so another tenant's financial records can be acted on.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts reminder records into finance_reminders and finance_reminder_items across tenants.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6bf1f59bfed31c4a

unresolved · supabase/functions/ticket-escalation-engine/index.ts

Ursache: Anyone can trigger the ticket escalation engine without authenticating, causing overdue tickets to escalate and appointments to expire.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint performs durable updates to tickets, esc_events, and ticket_history tables.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6ca6d30004fdbfc3

unresolved · src/pages/Feedback/Exports.tsx

Ursache: Anyone can put a spreadsheet command in a survey response that staff export, so opening the file could run unwanted actions on their computer.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Survey response text from public users is exported to CSV using csvEscape which only escapes quotes/newlines without neutralizing formula characters.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_71925ea4db5778fb

unresolved · supabase/functions/ticket-user-notify/index.ts

Ursache: Anyone can resend ticket notifications to staff, so inboxes can be flooded and private ticket details can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Triggered execution dispatches an external email through Resend API without invoker verification.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_73a591d5686cae09

unresolved · supabase/migrations/20260721082103_50fc9f30-638f-4a39-aa63-13c45b1b95b8.sql

Ursache: Any signed-in user can view channel conversion patterns from every tenant, so other customers' business performance is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The SECURITY DEFINER function queries ac_analytics_events without tenant filtering, returning cross-tenant channel attribution conversions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_74e43b7ec94e2367_a4e4a3ec

unresolved · supabase/functions/alixdocs-customer-export/index.ts

Ursache: The tenant check treats an authenticated user with no tenant assignments as unrestricted, allowing arbitrary customer IDs through the service-role export.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Downloads customer documents from private storage bucket across tenants.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_78b069b5018b9a04

unresolved · supabase/functions/alixdocs-delete/index.ts

Ursache: Any signed-in user can delete or restore another user's document, so important files can be removed or unexpectedly brought back.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The privileged database update modifies the target document record in public.alixdocs_documents based on the request-provided document_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7a1f235b2163cc92

unresolved · supabase/functions/github-repos/index.ts

Ursache: Anyone can see private repository names and update details from your connected account, exposing information about your code and organization.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint queries GitHub via the server token and returns private repository metadata and permissions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7c49fdc537737f7d_68117057 [PRODUCT HUB]

duplicate · supabase/functions/ph-com-registry-push/index.ts

Ursache: The endpoint reads mapping rows with the service-role client before validating the request, without authenticating the caller.

Erwartete Änderung: Bestehende Legacy-Sperre erhalten; zusätzlich exakte aktive Super-Admin-/Mandantenprüfung vor privilegierten Aufrufen, erlaubte Zielpfade/Methoden und vorhandene Release-Regeln erzwingen.

Auswirkung auf bestehende Funktionen: The handler uses a service-role client to query ph_lang_sync_map directly from durable storage and returns internal mappings without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Fehlende Aufruferauthentifizierung im Quellcode bestätigt; bestehende controlled_modes-Sperre beendet den Handler aktuell VOR der beanstandeten Operation. Daher keine aktuelle externe Ausführung behauptet. Risiko bei späterer Aufhebung ungeklärt und freigabeblockierend. Manuell gleicher Einstieg, dieselbe Datenoperation und dieselbe Komponente wie lov_finding_7c49fdc537737f7d_50ac0c04.

## lov_finding_7e3a3c1a9ceb0554

unresolved · supabase/functions/delivery-approval-monthly-report/index.ts

Ursache: The endpoint uses service-role credentials to aggregate delivery-approval records without authenticating an invoker; the table’s SELECT policy restricts reads to internal staff.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated handler uses the service-role client to query operational delivery approval rows from the durable delivery_approvals table.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7f3cf914eb1ff11a

unresolved · supabase/functions/portal-maintenance-request/index.ts

Ursache: Any signed-in user can put deceptive content in support emails, so staff may mistake it for a trusted service message.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Caller-controlled deviceId, preferredDate, and unescaped HTML characters in description (e.g. > or attributes) reach outbound email without sanitization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7f820cbb5af4b031

unresolved · supabase/functions/ac-alerts-check/index.ts

Ursache: Anyone can invoke this handler to query private website alert configurations and analytics using service-role credentials and trigger email deliveries without caller authentication.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function sends outbound emails via sendLovableEmail and performs durable database updates on ac_web_alerts.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_813f30cdfce0d3a0

unresolved · supabase/functions/ac-draft-reply/index.ts

Ursache: Any signed-in user can place their own instructions in the reply tone setting, so the AI may draft replies that ignore your intended safeguards.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Directly interpolates caller-supplied tone and locale into the system prompt for LLM completions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_82fa0f2066ce7b4b

unresolved · supabase/functions/send-mobile-notification/index.ts

Ursache: Any signed-in user can request a SYSTEM notification for an arbitrary conversation; the service-role lookup has no caller binding and copies its private preview into that user's notification.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged service-role query reads private last_message_preview and customer data from ac_conversations for arbitrary conversation_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86935cc2f28b7241_1060bcd4

unresolved · supabase/functions/send-transactional-email/index.ts

Ursache: A workspace member can view recipient email addresses in service logs after messages are sent, exposing personal contact information to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs record effectiveRecipient and copyRecipients in cleartext, visible to log readers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86935cc2f28b7241_1d5466a1

unresolved · supabase/functions/send-transactional-email/index.ts

Ursache: A workspace member can view recipient email addresses in service logs when message sending fails, exposing personal contact information to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs record failed recipient email addresses in cleartext, visible to log readers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86935cc2f28b7241_f9adbb50

unresolved · supabase/functions/send-transactional-email/index.ts

Ursache: A workspace member can view recipient email addresses in service logs when email sending fails, exposing personal contact information to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs in Supabase are visible to project developers and service log readers, revealing cleartext recipient email addresses.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86c2e27b97555ad5

unresolved · Scannerposition nicht auflösbar

Ursache: Any signed-in user can see service-wide visitor chat and satisfaction trends, so customer activity is exposed beyond administrators.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads across ac_portal_chat_sessions via SECURITY DEFINER, exposing deflection metrics and CSAT ratings across channels to any authenticated user.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_88c82a38d6bfce36

unresolved · supabase/functions/alix-copilot/index.ts

Ursache: Any workspace member can broaden the copilot's repair searches, so records outside the intended search can be shown.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unsanitized query injected into PostgREST or() filter selects arbitrary repair_orders records from the database and returns them in the copilot response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_89378af05f306e7c

unresolved · supabase/functions/ticket-customer-reminder/index.ts

Ursache: Anyone can send reminders to customers with pending tickets, so your customers can receive unsolicited messages from your service.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function queries due tickets and issues outbound HTTP requests via Resend API to customer email addresses and updates tickets table in Supabase.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8c93d10e96fc9f48

unresolved · supabase/functions/ticket-customer-notify/index.ts

Ursache: Anyone can send service emails from your app, so customers can receive unwanted messages that appear to come from your team.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Dispatches external emails to arbitrary recipients via Resend API from a trigger/internal-intended endpoint without credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8cc1d68c6971f68f

unresolved · supabase/functions/ac-kb-embed/index.ts

Ursache: The endpoint verifies no caller credential before service-role access fetches any KB article by caller-supplied ID, including nonpublic drafts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated endpoint fetches unpublished KB draft content and transmits it to Lovable AI embeddings gateway, then updates the embedding column in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8deae0c69b850acd

unresolved · supabase/functions/copilot-fetch-url/index.ts

Ursache: Any signed-in user can use the web research feature to request arbitrary public sites, so outside sites can receive unwanted traffic from your service.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The authenticated user specifies an arbitrary public URL which the server directly fetches via HTTP GET with SSRF filtering only against private/internal IPs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8f7400d5e5114123

unresolved · supabase/functions/ticket-sla-check/index.ts

Ursache: Anyone can run the ticket check to mark tickets as breached and escalate them, so support teams may act on false or repeated alerts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Calling ticket_sla_check_and_escalate executes durable UPDATE queries on public.tickets and INSERT queries into public.ticket_history.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_90c7c48343d4bde8

unresolved · supabase/functions/catalog-ai-translate/index.ts

Ursache: The endpoint accepts unauthenticated translation requests, calls the configured AI gateway, and returns its result, while the app’s CAPA AI endpoint verifies sign-in.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated visitors can invoke the Lovable AI gateway (a paid/metered service) with arbitrary text and receive the translation results, while other AI functions require authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_92d6177d8f94b16b

unresolved · supabase/functions/collect-engine/index.ts

Ursache: Anyone can run the collections engine, so private customer debt and contact details can be exposed and collection records changed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler executes collect_sync_cases, updates collect_cases with customer contact info, and inserts generated collection tasks into collect_tasks.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9491595e238a1f1b

unresolved · supabase/functions/finance-anomaly-detect/index.ts

Ursache: Anyone can run finance anomaly detection and write anomaly records to the finance database.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts detected anomaly records into the database table finance_anomalies via service_role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_94cdd9971915518b

unresolved · supabase/functions/as-ai-suggest/index.ts

Ursache: A signed-in caller can choose any case_id; the service-role query reads the case and related customer, device, callback, and timeline data without checking the caller’s case access.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Function queries as_cases_list_v, as_checklist_items, and related tables with service role and returns AI analysis derived from that durable store context.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_950f643578026644

unresolved · supabase/migrations/20260721080634_37469539-701c-48d1-9036-078f76f78e43.sql

Ursache: Any signed-in user can see visitor retention patterns from every tenant, so other customers' audience behavior is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The SECURITY DEFINER function queries ac_analytics_events without tenant filtering, returning cross-tenant visitor cohort retention figures.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_96a4ae412ce2a520

unresolved · supabase/functions/alixdocs-approval-start/index.ts

Ursache: Any signed-in user can start an approval for another user's document, so they can trigger workflows and notifications for documents they do not control.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Creates approval states in alixdocs_approval_states and inserts app notifications for document approvers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9723b851834fbf8a

unresolved · supabase/functions/esc-calendar-sync/index.ts

Ursache: Any signed-in user can add scheduled events to another user's calendar, so their calendar control and privacy are lost.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Calls external Google Calendar API using stored third-party OAuth tokens, creating events on the targeted user's external calendar.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9a1236c1ec5aad94

unresolved · supabase/functions/ticket-ai-assist/index.ts

Ursache: Any signed-in user with ticket access can put their own instructions in the reply tone setting, so drafts may not follow your safeguards.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unsanitized request body parameter tone is interpolated directly into the system prompt message sent to the LLM completion API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9d62dae616921ddc

unresolved · supabase/functions/bank-auto-reconcile/index.ts

Ursache: Anyone can run bank matching that changes invoice balances and payment allocations, so accounting records may become inaccurate.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated invocation triggers invoice payment allocation and marks invoices as paid in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9dba44d0fdbab251

unresolved · supabase/functions/op-light-send-sms/index.ts

Ursache: Any signed-in finance user can send custom texts to arbitrary numbers, so recipients can receive unwanted messages from your business.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends external SMS messages via Twilio to arbitrary caller-specified recipient phone numbers with caller-supplied text.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a1b561efb919465b

unresolved · supabase/functions/security-alert-notify/index.ts

Ursache: Anyone can trigger security alert emails, so super administrators may receive unexpected alerts and audit log entries are generated.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint triggers outbound email notifications via Resend API and inserts audit log entries into audit_logs via service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a44886ab5090c7ff_08e60798

unresolved · supabase/functions/calculate-driving-time/index.ts

Ursache: Any signed-in user can put customers’ addresses in service logs, so private location details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Logging customer postal addresses in server error logs writes cleartext personal location data to durable cloud service logs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a44886ab5090c7ff_1b5d1b11

unresolved · supabase/functions/calculate-driving-time/index.ts

Ursache: Any signed-in user can put customers’ addresses in service logs, so private location details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Logging customer postal addresses in server warning logs writes cleartext personal location data to durable cloud service logs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a6281bc7289f8bd8

unresolved · supabase/functions/ac-autonomous-resolve/index.ts

Ursache: Anyone can submit an arbitrary ticket ID to trigger autonomous resolution on private ticket messages and details without caller authentication.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function queries the durable ticket_messages and tickets tables via service role and feeds ticket subject, description, and message history to the AI model.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a86d415b1fbe8c55

unresolved · supabase/functions/collect-copilot/index.ts

Ursache: Any signed-in user can submit messages with arbitrary roles, so the assistant may act on attacker-specified system or assistant instructions.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Caller-supplied message objects with arbitrary roles are forwarded to the AI gateway completion call.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ac938286aeb6273a_4991287b

unresolved · supabase/functions/catalog-import-firecrawl/index.ts

Ursache: Anyone can trigger paid Firecrawl scrapes of arbitrary URLs and import them, consuming your Firecrawl budget.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint issues paid Firecrawl scrape API calls for up to 50 caller-supplied URLs and modifies database rows.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ac938286aeb6273a_906d5e1c

unresolved · supabase/functions/catalog-import-firecrawl/index.ts

Ursache: Anyone can use your app’s paid website lookup on arbitrary sites and receive the results, so outsiders can consume your provider budget.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint triggers paid Firecrawl map requests for arbitrary URLs and returns the resulting link crawl to the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ade0a1b2acaf1de5

unresolved · supabase/functions/delivery-escalation-engine/index.ts

Ursache: Anyone can trigger internal alerts about active orders, disrupting dispatch staff and exposing private delivery status.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler durably inserts internal notifications into app_notifications for staff members without requiring caller credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_afcf8b12fd476a3a

unresolved · supabase/functions/collect-copilot/index.ts

Ursache: Any signed-in user can ask the copilot to retrieve finance records through a service-role client, without checking the user’s finance role or binding the data to their authority.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: collect_cases data is protected by can_access_finance() RLS policy, which is bypassed using a service-role client and summarized to callers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b18d1e282b240165

unresolved · supabase/functions/calculate-driving-time/index.ts

Ursache: Any signed-in user can put customers’ addresses in service logs, so private location details are visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Logging customer postal addresses in server error logs writes cleartext personal location data to durable cloud service logs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b4deaaa277c70ff4

unresolved · supabase/functions/social-onboarding-invite/index.ts

Ursache: Anyone with social media management permissions can specify an arbitrary recipient email address when sending client onboarding invitations.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function invokes the external send-mail function with caller-provided recipient_email to send an onboarding link.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bd8aa8e8464a8bf8_ac8609e0

unresolved · supabase/functions/github-status/index.ts

Ursache: The endpoint verifies no caller credential and uses the server GitHub token to return repository metadata and recent commits.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Direct response returns commits and repo metadata fetched via configured server GITHUB_TOKEN.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bd8aa8e8464a8bf8_b1e2f1bb

unresolved · supabase/functions/github-status/index.ts

Ursache: The public handler uses a server-held GitHub token to fetch the configured repository and its commits, then returns commit metadata without verifying the caller.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Handler uses server GITHUB_TOKEN to query external GitHub repository API and returns private commit author, date, and messages.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_be6f2518fbb0d944

unresolved · supabase/functions/send-order-confirmation/index.ts

Ursache: Any signed-in user can trigger failed delivery logging customer email addresses, exposing them in service logs.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint reads customer email addresses from the durable database and logs rec.email to server logs when delivery fails.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_be9a4c2c42805a46_0898df3f

unresolved · supabase/functions/handle-email-unsubscribe/index.ts

Ursache: Anyone can trigger failed email suppression logging in service logs, so recipient email addresses are exposed to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs recipient cleartext email address to server logs upon suppression error.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_be9a4c2c42805a46_1f35776c

unresolved · supabase/functions/handle-email-unsubscribe/index.ts

Ursache: Anyone can expose unsubscribe links in service logs, so recipients’ unsubscribe controls may be used by log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs cleartext unsubscribe token to server logs on database update failure.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_be9a4c2c42805a46_7d5d29e4

unresolved · supabase/functions/handle-email-unsubscribe/index.ts

Ursache: Anyone can trigger successful unsubscribe logging in service logs, so recipient email addresses are exposed to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs recipient cleartext email address to server logs on successful unsubscribe.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bf5af3dc266fa701

unresolved · supabase/functions/ac-missed-call-sms/index.ts

Ursache: Anyone can trigger a text to a missed caller, so recipients can be harassed and messaging costs can rise.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends outbound SMS via Twilio using server Twilio credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c15972a9249262e3

unresolved · supabase/functions/catalog-share-send/index.ts

Ursache: Any signed-in user can message another user's product-share contacts, so customers may receive unsolicited texts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends Twilio SMS or WhatsApp messages to recipient phone numbers loaded from unvalidated caller-selected link IDs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c347b846e6b2b5a1

unresolved · supabase/functions/follow-up-reminder-engine/index.ts

Ursache: Anyone can trigger private staff reminders and change their status, so internal follow-up notifications can be prematurely triggered without authorization.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends mobile notifications with the service role key and updates reminder statuses in the database to TRIGGERED.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c763006c2aa20517

unresolved · supabase/functions/ac-segment-preview/index.ts

Ursache: Anyone can retrieve a segment's contact sample and change its preview details, so customer information and segmentation data are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: When segment_id is supplied, the service-role client updates ac_segments with contact_count and last_computed_at without authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cd056d21e44e9a75_1649b39e

unresolved · supabase/functions/alixdocs2-workflow-scan/index.ts

Ursache: Anyone can trigger a scan of private documents that creates notifications for administrators, causing unexpected alerts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated handler performs document scans and inserts notifications into app_notifications for administrators.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d1d0e8fe336ec6f2

unresolved · supabase/functions/whatsapp-cloud-send/index.ts

Ursache: Any workspace member can message arbitrary phone numbers with custom content, so attackers or unauthorized staff can send messages to external recipients using the company's WhatsApp business account.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function sends an outbound WhatsApp message via Meta Graph API with request-supplied recipient and payload on behalf of the company.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d2ea69a286d7ab4a

unresolved · supabase/migrations/20260721080634_37469539-701c-48d1-9036-078f76f78e43.sql

Ursache: Any signed-in user can view traffic and conversion patterns from every tenant, so other customers' business performance is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The SECURITY DEFINER function queries ac_analytics_events without tenant filtering, returning cross-tenant attribution totals.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d4a58b04a8d1f338

unresolved · supabase/functions/social-publish/index.ts

Ursache: The process_due branch performs service-role reads and state changes before the handler's authentication check, which only runs for other actions.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger updates to social_publish_jobs, social_posts, and social_post_metrics via the process_due action.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dab77a56a80c8279

unresolved · supabase/functions/bank-api-fetch/index.ts

Ursache: Anyone can call this endpoint without authentication, causing the server to send HTTP requests to bank API endpoints configured in system settings with the stored bearer token.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint issues outbound HTTP requests with the secret BANK_API_TOKEN to target bank APIs and saves the responses into storage and database records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dabc0b5b45ba66b9

unresolved · supabase/functions/plm-purchase-order-send/index.ts

Ursache: Any signed-in user can send purchase orders to suppliers, so unauthorized orders could create financial obligations for your business.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends binding purchase order emails to third-party suppliers using the company's official procurement identity without verifying PLM write roles.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_daf205644a4ce8da

unresolved · supabase/functions/collect-morning-report/index.ts

Ursache: Anyone can generate and read the collections report, so sensitive debt totals and customer names can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Generates, persists, and returns collections financial report data from collect_cases and collect_promises.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_db624cf60141fdbd

unresolved · supabase/functions/github-action/index.ts

Ursache: Anyone can create release tags in your connected code repository, so release history can be changed without your team's approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Creates git release tags on GitHub using a privileged GitHub token without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dc9dfcdd7cb4ab4f

unresolved · supabase/functions/collect-payment-link/index.ts

Ursache: Any signed-in finance user can send a customer’s payment link to an arbitrary address, so private payment details may reach the wrong person.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sends an outbound email via the external Resend API to an arbitrary recipient specified in the request body.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_deaeb897a2c94b91

unresolved · supabase/functions/fleet-maintenance-alerts/index.ts

Ursache: Anyone can trigger the fleet maintenance check, which queries vehicle records using the service role and sends alerts, learning aggregated fleet maintenance counts in the response.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint queries vehicles with service_role and triggers outbound emails via Resend API to internal fleet contacts.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_df6fdc9c6acda235

unresolved · supabase/functions/portal-contract-sign-confirm/index.ts

Ursache: Any signed-in user can put deceptive content in contract-signing emails, so staff may mistake it for trusted information about a signed agreement.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Caller-controlled signed_by_name and signed_by_role are concatenated unescaped into HTML email sent to support staff via external email service.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dfc8524202f9f39e_139ee84c

unresolved · supabase/functions/delivery-approval-escalation/index.ts

Ursache: Anyone can trigger internal reminders containing order details, so staff can be spammed and customer order information exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can trigger durable app_notifications inserts and external email notifications.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dfc8524202f9f39e_e47e4661

unresolved · supabase/functions/delivery-approval-escalation/index.ts

Ursache: Anyone can trigger approval reminders to staff, so inboxes can be flooded with unwanted messages and links.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can trigger external email dispatches via Resend API to staff.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e01e085ef63936d2

unresolved · supabase/functions/alixdocs-sign-return/index.ts

Ursache: Anyone can trigger a document version to be uploaded and released, so files may be treated as approved without a trusted signing event.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Mutates durable database records in alixdocs_versions and alixdocs_documents, and uploads files to storage.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e0d1b10592e160ea

unresolved · supabase/functions/mediapaket-portal/index.ts

Ursache: Any signed-in user can attach a copied package to another order, so one customer's package information can be linked to someone else's purchase.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts a new media package row referencing targetOrderId into media_packages durable table using privileged service role admin client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e0ffb2301eb1c785

unresolved · supabase/functions/audit-alert-digest/index.ts

Ursache: Anyone can trigger the security digest to email administrators, so they can be flooded with unwanted alerts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint triggers outbound emails via Resend to administrative recipients.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e2c4ff5d7611f02d

unresolved · supabase/functions/alixdocs-link-suggest/index.ts

Ursache: A missing Authorization header leaves jwt empty, skips verification, and allows service-role queries over private document metadata.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads private documents and their metadata from public.alixdocs_documents using a service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e388dab58fefe4e2

unresolved · supabase/functions/ac-voice-twilio-webhook/index.ts

Ursache: The service-role update selects a stored call by external_id from the unverified request's CallSid without binding that row to an authorized caller or verifying the provider request.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The service-role client updates metadata on ac_calls matching external_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e4abb45afc5b91eb

unresolved · supabase/functions/ticket-customer-notify/index.ts

Ursache: Anyone can send deceptive markup to customers and internal staff using your branded mail, so recipients may be misled into disclosing information or following harmful links.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Untrusted customer_name, message, ticket_number, and repair_number parameters are interpolated unescaped into HTML emails and sent via the Resend API to external recipients.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e75b8684adf72817

unresolved · supabase/migrations/20260809183724_dc4c40cb-2c27-4e43-a2b9-9aba57a7f6c5.sql

Ursache: Any signed-in user can view other tenants' dashboard activity, so customer and business information is exposed across organizations.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Aggregates activity metrics from underlying tables filtered by caller-supplied p_tenant_id without verifying access to that tenant.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e95de054b03f8db0

unresolved · supabase/functions/portal-ticket-notify/index.ts

Ursache: Any signed-in customer can put deceptive content in support emails, so staff may mistake it for a legitimate customer request.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Ticket subject provided by customer is embedded directly into HTML email sent to internal support via external Resend API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e97ee86dc03bce4c

unresolved · supabase/functions/start-zoho-import/index.ts

Ursache: Admins can trigger Zoho import, causing customer billing addresses to be logged in server logs visible to log readers.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Edge function logs customer billing address JSON to server-side stdout/stderr logs via console.log.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_eaf1151adeb41107

unresolved · supabase/functions/ac-router/index.ts

Ursache: Anyone can retrieve customer-based routing results, so private customer and staffing information is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Queries ac_customer_scores using service_role and exposes scores via routing calculation and metadata in response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ec3de0a630ccb72f_284b8152

unresolved · supabase/functions/ticket-ai-assist/index.ts

Ursache: Any authenticated user can query similar resolved tickets and read customer details without authorization.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler queries tickets via service-role without authorization and returns durable store records in the direct JSON response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ee272cd70c04cc65

unresolved · supabase/functions/esc-token-issue/index.ts

Ursache: Any signed-in user can create a sharing link for another person's event, so private event details can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The issued token enables downstream bypass of RLS access gates on esc_events via esc-token-verify.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f1b6c7c7e267f14f

unresolved · supabase/functions/sig-tsa-timestamp/index.ts

Ursache: Anyone can create timestamp records for private agreements, so the signing history can be made misleading without the owner's permission.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers cause durable writes into the sig_audit_log table.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f26da156240a2f62

unresolved · supabase/functions/dispatch-ai-assistant/index.ts

Ursache: Any signed-in user can see delivery schedules, customer names, and fleet details, so operational and customer information is not private.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Delivery tours and customer appointment data read from durable store via service role are processed and returned to the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f5165bc5e00c233a

unresolved · supabase/functions/catalog-share-send/index.ts

Ursache: The authenticated caller controls message text sent through the application's Twilio account to the recipient stored on a share link.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Twilio API call delivers arbitrary caller-controlled message text to external phone numbers via SMS or WhatsApp.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f6581aeacde376d8

unresolved · supabase/functions/ac-campaign-track/index.ts

Ursache: Anyone can call the click path and supply an arbitrary `u` query parameter; the handler copies it directly into the 302 Location header without restricting the destination.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sets an unvalidated 302 Location header from caller-supplied query param 'u', permitting arbitrary open redirects.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f96755eb5792fedc

unresolved · supabase/functions/alix-copilot/index.ts

Ursache: Any signed-in user can set instructions and roles for the company copilot, so its answers may disregard the safeguards around company information.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Request messages array is pushed directly into LLM chatMessages without server enforcement of role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_fc4755355dbc5321

unresolved · supabase/functions/escalation-engine/index.ts

Ursache: Anyone can change your conversation escalations, so customer issues may go unanswered or reach the wrong staff.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint updates conversation escalations in durable storage without authenticating the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_fceaf8f0efb47bf5

unresolved · supabase/functions/ac-sla-check/index.ts

Ursache: Anyone can run the SLA check to create breach alerts and staff notifications, so teams may act on false or repeated escalations.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated cron endpoint inserts breach records into ac_sla_breaches and notifications into app_notifications upon invocation.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_fd102077de4d227b

unresolved · supabase/functions/ac-autonomous-resolve/index.ts

Ursache: Anyone can provide an arbitrary ticket ID to read and mutate another customer's ticket data using privileged service-role database access.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The privileged client reads private ticket details and ticket messages from the durable database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_fd454959ff613897

unresolved · supabase/functions/ac-compliance-governance/index.ts

Ursache: The audit action reads call, conversation, and compliance-prediction data with the service-role key and returns aggregate counts without authenticating the caller.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Audit response exposes aggregate counts of calls, recordings, and conversations without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

