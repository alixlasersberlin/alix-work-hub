# Paket B – Hohe Risiken

Nur vorbereitet, nicht ausgeführt. Keine gemeinsame automatische Freigabe; ursprüngliche revisionsgebundene Einzel-/Komponentenfreigabe bleibt bestehen. Ungeklärte Risiken sind Prüfaufträge, keine bestätigten Schwachstellen.

## lov_finding_01689a0ccfff4e89

unresolved · supabase/functions/rz-reminder-send/index.ts

Ursache: Any authenticated caller supplies reminder_ids; no role or resource check is performed before the service-role query.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: The handler queries rz_reminders using the service key for caller-supplied IDs and returns reminder details in the direct response when preview=true or in results.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_016dbf8483032e9a

unresolved · supabase/functions/alix-sign-resend/index.ts

Ursache: An unauthenticated request supplies a signature_id; the function looks up that signature and its associated signing request without authenticating the requester or checking ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler executes audit log writes, storage uploads, and external email dispatches for arbitrary caller-specified signature IDs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_04b7323c4231ec65

unresolved · supabase/functions/import-all-orders-ch/index.ts

Ursache: supabase/functions/import-all-orders-ch/index.ts

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Handler updates and inserts Swiss customer orders and line items using the service-role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_08c1beda03a5ef65

unresolved · supabase/functions/ac-router-simulate/index.ts

Ursache: The public function parses a request body without requiring a signed-in user; customer_id can be supplied there.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint queries ac_customer_scores with service role for any caller-supplied customer_id and returns the score in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_09ffea0c64262705

unresolved · supabase/functions/tmp-create-sobitsch/index.ts

Ursache: The handler accepts a request and immediately creates a service-role client without authenticating or checking the caller’s role. It then uses the admin Auth API to create the account and writes commission records.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler creates an authentication account and durable commission assignments using privileged service-role credentials without checking caller role or authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_12f184f4fe482d12

unresolved · supabase/functions/mediapaket-portal/index.ts

Ursache: Anyone on the internet can select the notify_customer_status action and supply a package ID; this branch reads the ID from the request without authenticating the requester.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Sends external notification emails to arbitrary customer addresses and inserts records into media_package_history and reviews.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1774b4ac1795267a

unresolved · supabase/functions/pdf-order-commit/index.ts

Ursache: The handler accepts an authenticated request and imports customer_choice.id as the existing customer target without checking caller access to that customer.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged admin client creates order row associated with caller-chosen customerId without authorizing access to that customer.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_183ae0ad4cf721dc

unresolved · supabase/functions/compliance-ai-assist/index.ts

Ursache: An authenticated request supplies body.task_id at line 50. The service-role client is initialized at line 17 and uses that ID to read the task and associated project and steps. The database policy permits task/step reads only for assignees, reviewers, co-assignees, or project members.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Bypasses RLS policies on compliance_tasks and compliance_task_steps by querying with the service role client and returning AI-processed task/step content.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_193e452aa8130a17

unresolved · announce-capa-cockpit fixed trigger token

Ursache: An internet request supplies the fixed trigger token in the checked header; this function has JWT verification disabled and accepts that token.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Anyone reading the hardcoded token can trigger outbound transactional emails to all active employees.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1b423c4366778754

unresolved · public.ac_web_segment_stats(uuid,jsonb,timestamptz,timestamptz)

Ursache: The authenticated database role can execute this SECURITY DEFINER function and provide any website identifier, date range, and filters without an access check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads and aggregates protected analytics events for any caller-supplied website_id directly from public.ac_analytics_events under SECURITY DEFINER.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1c6e8cfec49210c7

unresolved · supabase/functions/ac-revenue-intel-v2/index.ts

Ursache: An unauthenticated request supplies contact_id in its body.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service-role query returns private customer messages and call history from the database store.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1cfc25c1a72b5091

unresolved · supabase/functions/ticket-user-notify/index.ts

Ursache: An internet visitor can submit a notification identifier to the registered action; the service client reads the private notification, employee profile, and related ticket without checking a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint reads user email from user_profiles via service role and returns it directly in the JSON response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1faf96e95ce2b494

unresolved · supabase/functions/cmr-portal-invite/index.ts

Ursache: A signed-in user with one of the listed roles supplies an arbitrary portal token identifier; the function does not bind that token's tenant to the user's authority.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Token lookup using service-role key does not check tenant or customer ownership against caller permissions, triggering an invite for arbitrary tokens.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_217a6dfc717596f3_bfdcff55

unresolved · supabase/functions/ac-conv-intel-analyze/index.ts

Ursache: The public handler accepts call_id from the request body and creates a service-role client without authenticating a user, machine, or operation-specific capability.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler performs an AI API call, persists insights into the ac_voice_insights database table, and returns the inserted row.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_217a6dfc717596f3_f43be5ff

unresolved · supabase/functions/ac-conv-intel-analyze/index.ts

Ursache: Anyone can invoke this function and provide a call identifier in the request body; no credential is checked.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint writes derived analysis to ac_voice_insights and returns the row.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_21a637de07028856

unresolved · supabase/functions/announce-capa-cockpit/index.ts

Ursache: The public POST handler accepts a fixed token embedded in the deployed source instead of verifying an invoker credential, so anyone can supply the token and reach the service-role query.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads employee emails and names from user_profiles using admin service role without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_232765c9fa069fde

unresolved · supabase/functions/as-send-email-reminder/index.ts

Ursache: A signed-in user chooses case_id and recipient_email in the request; identity is checked, but authority over the selected case is not.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Case details fetched via privileged service role client for any caller-supplied case_id are transmitted in outbound email.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_23a279b4a5efc05a

unresolved · supabase/functions/collect-analytics/index.ts

Ursache: Anyone can invoke the public analytics function, which immediately creates a service-role client and reads private customer, invoice, collection, and credit-limit records without checking caller credentials.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Unauthenticated invocations perform privileged database writes to collect_credit_limits via service role client.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_27d2250b5b8790ba

unresolved · supabase/functions/portal-delivery-actions/index.ts

Ursache: The public POST handler accepts request data and creates a Supabase client with the service-role key, without authenticating a caller credential.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: The handler modifies order_delivery_status, creates delivery events, and triggers outbound notification emails without verifying caller identity.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_28ad318b9fbc4915

unresolved · public.finance_approvals

Ursache: A signed-in user supplies an approval identifier and an approve action to the finance approval action; the function verifies sign-in but does not check an approver role or permission before processing the request.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Updates invoice status to freigegeben using the service role client without validating approval authority.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_28cb10380cb01816

unresolved · supabase/functions/social-competitors-sync/index.ts

Ursache: A visitor can invoke the function and omit client_id and competitor_id, causing the privileged query to select all competitors.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged update mutates social_competitors records in the database via the service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_29b6057cf3486198

unresolved · supabase/functions/bank-return-dunning-escalate/index.ts

Ursache: An unauthenticated caller supplies force=true, which enables processing despite the stored setting; execution then selects private return-debit records.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Invokes send-transactional-email to dispatch formal collection notices and updates bank_return_debits and bank_audit_log.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2c6eeae643a145a5

unresolved · supabase/functions/pruefung-release/index.ts

Ursache: The handler verifies only that the bearer token identifies a user, then trusts the request's profile_id and uses the service key for REST queries.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler triggers external email delivery to customers via send-invoice-mail and performs durable database PATCH updates on ratenplan_generated_invoices using the service role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_32ab3ba23bc4c3c6

unresolved · supabase/functions/as-workflows-run/index.ts

Ursache: Anyone on the internet can invoke the workflow; the request path has no sign-in, role, or privileged-capability check before querying and processing all matching cases.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Directly updates case priority and status in as_cases using service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_374621ce0171a129

unresolved · supabase/functions/ac-qm-coaching-recommend/index.ts

Ursache: The handler accepts agent_user_id from the request and creates a service-role client without authenticating the caller or checking resource ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads private quality management evaluation scores and notes for the specified agent from the durable ac_qm_evaluations table using service_role privileges.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3b26108661a79fab

unresolved · supabase/functions/convert-signed-offer-to-order/index.ts

Ursache: A visitor supplies an offer_number in the request body; the action queries the signed request using a privileged database client without verifying the visitor's identity.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts new orders and order_items records using privileged service credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3b50bf868a4ca4dc

unresolved · supabase/functions/ticket-user-notify/index.ts

Ursache: Anyone can provide a notification identifier to the public request handler; it reads that notification and the related user's profile with privileged credentials without checking the requester's authority.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service-role query retrieves arbitrary notification and triggers external email via Resend.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3b55d34b73b21e9d

unresolved · supabase/functions/ac-chat/index.ts

Ursache: The public Deno.serve handler reads the caller's action and request body; the poll branch accepts the caller-supplied conversation_id without validating a user, machine, or operation-specific bearer credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Queries and returns chat message history from the durable ac_messages table using service_role without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3e001c78892db51d

unresolved · supabase/functions/send-order-confirmation/index.ts

Ursache: The handler verifies only that the bearer token identifies a user; request-provided signature_id/order_id then select service-role records without checking the caller's ownership or authority.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function reads protected signature and order data from durable database tables using service-role privileges and returns a generated document download URL in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3e98351e84204cdc

unresolved · supabase/functions/esc-appointment-confirmation-mail/index.ts

Ursache: The handler accepts request-provided recipient and message fields after checking only that a user is signed in.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sends outbound emails to arbitrary recipients with arbitrary content via Resend.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_43bb2ddd0aab0e94

unresolved · ac-knowledge-rag: alixdocs_documents search

Ursache: Anyone can submit a search term to the public knowledge search; the term is inserted into the document filter without escaping.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Query parameter interpolation into PostgREST filter string executes a raw query filter against private documents.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_47008b040e014166_817a2c19

unresolved · supabase/functions/catalog-share-send/index.ts

Ursache: A signed-in user supplies any share-link identifier; the function checks only that a user is signed in, not that they own the link.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Invokes send-mail / twilio outbound message delivery and logs communication to customer_communication_log.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_48c15e5c018def20

unresolved · supabase/functions/finance-reminder-engine/index.ts

Ursache: An authenticated request reaches getTenantScope; the helper sets restricted to false when the user has no tenant-access rows, which the handler interprets as no tenant filter.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Creates reminder records in finance_reminders and finance_reminder_items across accounts of all tenants.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4bd5ac08511c8e04

unresolved · supabase/functions/as-send-sms-reminder/index.ts

Ursache: Any authenticated caller can submit a case ID, phone number, and message text; the handler sends the request-selected text to the request-selected number through the configured Twilio account.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function sends an outbound SMS via Twilio using the service's paid Twilio account to a caller-supplied phone number with caller-supplied custom_text.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4c7152ec5de2c1bc

unresolved · supabase/functions/cmr-bank-automatch/index.ts

Ursache: Anyone on the internet can invoke the function and submit a request that reaches the bank-matching routine; the request body is parsed without a role or secret gate.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Directly inserts payment rows into cmr_payments, creating durable financial payment records and altering document paid totals.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4ea4f21737ef5149

unresolved · supabase/functions/ac-qm-auto-score/index.ts

Ursache: The handler accepts the request and creates a service-role client without checking that the caller has the QM/admin role required for evaluation creation.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts completed quality management evaluations and schedules coaching sessions via service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5289cf703f8ac14d

unresolved · supabase/functions/ticket-sync-alert/index.ts

Ursache: The handler accepts requests without checking a user, machine, or provider credential, then reads ticket_sync_logs and ticket_outbound_sync_logs with the service-role client. These logs include error messages and payloads; their ordinary authenticated SELECT policies are named "ticket_sync_logs_select_admin" and "Ticket users can view outbound sync logs".

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Anyone can invoke the function without authentication, triggering privileged reads and outbound alert emails via Resend as well as inserts to ticket_sync_alerts.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5353120018933fbe

unresolved · supabase/functions/offers-ai-score/index.ts

Ursache: The handler verifies only that the bearer token identifies a user, then accepts caller-supplied offer IDs without checking the caller’s role or ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Updates the ai_probability, ai_reason, ai_actions, and ai_scored_at columns on target offers via service-role client, bypassing RLS.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_59b7e25453966dd1

unresolved · supabase/functions/esc-calendar-oauth/index.ts

Ursache: The callback accepts state directly from the request query string and does not verify its relationship to the user who authorized the OAuth request.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Upserts calendar connection tokens under arbitrary user_id in esc_calendar_connections.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5b76d6089c92797d

unresolved · supabase/functions/ac-recording-retention/index.ts

Ursache: Anyone can send a request to the public retention function; it performs no credential check before modifying records.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger database updates nullifying recording_url on expired ac_calls records using service_role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5c7be8cb8b467dc0

unresolved · supabase/functions/collect-document-generate/index.ts

Ursache: supabase/functions/collect-document-generate/index.ts

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Sends emails via Resend with arbitrary caller-specified recipient addresses and collection notices with customer data.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5e150bdaabc5e021

unresolved · supabase/functions/mediapaket-reminders/index.ts

Ursache: Every request proceeds after the OPTIONS branch without authenticating the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler performs service-role updates and inserts into media_packages and media_package_history, modifying and anonymizing stored records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5e9ccda6a9cfe1b0

unresolved · supabase/functions/cmr-portal-invite/index.ts

Ursache: The handler verifies a CMR-capable role, then accepts caller-controlled portalUrl and to values. It only checks that the address contains an at-sign.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Emails are sent via Resend to any caller-supplied recipient address with caller-supplied portalUrl.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_607c1e0633e683f5

unresolved · supabase/functions/finance-ch-dd-export/index.ts

Ursache: A visitor supplies any direct-debit run identifier with a Bearer-prefixed header; the action checks only that the header has that prefix and then reads the selected run and its customer mandates with privileged credentials.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Privileged query retrieves bank mandates and run item records from the database for any caller-supplied run_id without scoping to caller.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6cdb90a4e4b3d4f9

unresolved · aic-send-report

Ursache: The request supplies recipient addresses, and the function allows the report send only after a super-admin role check or a cron-secret check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function dispatches outbound emails via Resend to caller-specified email addresses containing internal business reports.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6eb5a3fe59d356e3

unresolved · supabase/functions/alixdocs-attach-from-storage/index.ts

Ursache: A signed-in user supplies any storage bucket and object path in the request; the function verifies only that the user is signed in, then uses privileged credentials to download that object without checking ownership.

Erwartete Änderung: Quellobjekte und Dokumentbeziehungen mit den Rechten des Aufrufers prüfen, bevor privilegierte Kopien oder Signaturen entstehen.

Auswirkung auf bestehende Funktionen: Arbitrary storage objects are downloaded using service role credentials and written as new documents into the private AlixDocs bucket.

Abhängigkeiten: Private Buckets und Mandanten-/Dokumentbeziehungen; Maschinenaufrufer und legitime Kopierverträge

Tests: Andere Benutzer, Buckets und Pfade sperren; Gefälschte Dokumentversionen und Elternbeziehungen; Größe, Dateityp und signierte Ablaufzeiten mit Fixtures

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6feae31e06a64cf3

unresolved · supabase/functions/ac-automation-run/index.ts

Ursache: Anyone can POST an event and conversation_id; the handler parses them and creates a service-role client without authenticating a user, machine, or provider credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint inserts new messages and runs automation rules directly against caller-provided conversation_id using service_role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_72ade965d435cb87

unresolved · supabase/functions/credit-score-calculate/index.ts

Ursache: The public Deno handler parses assessment_id from req.json() and does not authenticate the request before using it.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Direct response exposes calculated credit assessment fields read from private customer records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_74e13969233e5319

unresolved · supabase/functions/recurring-prenotification/index.ts

Ursache: A visitor with any valid signed-in bearer token reaches the action; the code verifies identity but does not check an admin role or privileged capability.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sends payment reminder emails to external customers and logs notifications in recurring_prenotifications.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7663c8dfc8cfd611_1e2b5c22

unresolved · supabase/functions/cmr-recurring-run/index.ts

Ursache: Anyone can invoke the public function and optionally choose a plan or tenant; it uses a service-role client to read protected recurring billing plans without checking caller credentials.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Inserts recurring invoice records into cmr_documents and cmr_document_items using the service role key.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7663c8dfc8cfd611_f8f951cf

unresolved · supabase/functions/cmr-recurring-run/index.ts

Ursache: The Deno handler accepts optional planId and tenantId values but performs no user, machine, or provider credential verification; omitting tenantId leaves the service-role plan query unscoped.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Inserts generated invoice documents into cmr_documents and cmr_document_items and mutates plan schedules with service role credentials.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_773ec74739954988

unresolved · supabase/functions/alixdocs-mail-import/index.ts

Ursache: A signed-in user supplies any mail_attachment_id; the function looks up the existing attachment and downloads its stored file using privileged credentials without checking attachment ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The service client downloads any mail attachment record specified by ID and copies it into the private AlixDocs bucket under caller ownership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7845d0d7721ae86a

unresolved · supabase/functions/mobile-push-send/index.ts

Ursache: The request body controls recipient selection and notification title, body, and URL.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint dispatches push notification messages directly to external web push endpoints via webpush.sendNotification.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_80702a087db69b7e

unresolved · supabase/functions/ac-omnichannel-orchestrate/index.ts

Ursache: The caller supplies contact_id, and the handler uses it directly in service-role queries without a resource authorization check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service-role query reads stored contact details, messages, and calls without verifying ownership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86a979bd8688c2a0

unresolved · supabase/functions/cmr-send-document/index.ts

Ursache: After verifying sign-in and a CMR-capable role, the handler accepts request-controlled recipient, subject, message, and attachment fields.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Emails can be sent to arbitrary recipient addresses with caller-controlled message text, subject, and PDF attachments via external mail services.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_87a129784e09ef5c

unresolved · supabase/functions/zoho-invoice-pdf/index.ts

Ursache: A remote caller supplies source_system and document ID to this endpoint; the caller can be authenticated but have no tenant assignment.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Fetches external confidential invoice PDFs from Zoho Books across any requested source_system organization.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8973eaa4d23c2465

unresolved · supabase/functions/cmr-collective-run/index.ts

Ursache: Anyone can invoke the function and choose a plan or tenant, or omit both to process all due plans; there is no authentication or tenant binding.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Modifies cmr_documents and cmr_time_entries for arbitrary tenant_ids provided in the request body.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_89bba568925256f2_166f7873

unresolved · supabase/functions/ac-playbook-run/index.ts

Ursache: The handler creates a service-role client and accepts requests without checking a user, machine, or provider credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Invocation writes lifecycle execution run logs to ac_lifecycle_runs and triggers external outbound actions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_89bba568925256f2_d4756c15

unresolved · supabase/functions/ac-playbook-run/index.ts

Ursache: Any public request starts the playbook process; no credential is checked before work begins.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated caller triggers customer lifecycle actions including emails, SMS, and ticket creations.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_89e0261f504376eb

unresolved · supabase/functions/finance-qr-generate/index.ts

Ursache: A request supplies body.id; the Bearer check only tests the header’s prefix and does not verify its credential.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Reads private invoice details from finance_qr_invoices into the response and mutates invoice status.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8a473438782bef1a

unresolved · supabase/functions/sig-render-final/index.ts

Ursache: A visitor supplies document_id and request_id in the request body; no identity or document-ownership check runs before the privileged lookups.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged service role client executes an update modifying storage_path, version, sha256, and locked_at in sig_documents.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8b7a66d6300430d8

unresolved · supabase/functions/as-send-sms-reminder/index.ts

Ursache: A signed-in user chooses case_id and recipient_phone in the request; identity is checked, but authority over the selected case is not.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The privileged client reads case information for any case_id and dispatches an SMS reminder and writes timeline events and reminders for that case.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9260563e406937fe

unresolved · supabase/functions/finance-camt054-import/index.ts

Ursache: supabase/functions/finance-camt054-import/index.ts handles the request and only checks that Authorization begins with “Bearer ”.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Arbitrary callers supply a dummy Bearer header and write bank notification records via the service-role client.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9328ed89c215056e

unresolved · supabase/functions/offer-followup-engine/index.ts

Ursache: supabase/functions/offer-followup-engine/index.ts

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Queries and processes draft offers from public.offers across all tenants using service-role admin client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_98051a4a477129d7

unresolved · supabase/functions/alixdocs-sign-request/index.ts

Ursache: A signed-in user supplies any document_id; a privileged client reads that existing document and its current file without checking the user's access.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler downloads private files with service role and writes copies to sig-documents storage and inserts rows into sig_documents and sig_requests without verifying authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_98d1a9730f1bf438_c0935e03

unresolved · supabase/functions/cmr-dunning-run/index.ts

Ursache: The Deno handler parses an optional tenantId but never verifies a user, machine, or provider credential; when tenantId is absent, its service-role invoice query is unscoped.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: The unauthenticated function performs durable inserts and updates into cmr_documents and cmr_document_items, altering billing and reminder state.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_98d1a9730f1bf438_c6ddf1e8

unresolved · supabase/functions/cmr-dunning-run/index.ts

Ursache: Anyone can invoke the public function and optionally choose a tenant; it uses a service-role client to read overdue invoices and dunning settings without checking caller credentials.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Creates dunning notices in cmr_documents and cmr_document_items and updates reminder levels on invoices using the service role key.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9b6babee6e0739e2

unresolved · supabase/functions/rz-reminder-send/index.ts

Ursache: Any signed-in user passes the identity check and can provide reminder IDs; the function does not require a finance role or ownership of those reminders.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Sends outbound payment reminder emails via send-invoice-mail and updates reminder records in rz_reminders using service-role permissions.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9d9c7365b4cce7e8

unresolved · supabase/functions/ac-revenue-intel-v2/index.ts

Ursache: The handler accepts requests without verifying a signed-in user before querying caller-selected records and invoking the paid AI service.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger paid Lovable AI gateway completions and receive the analysis results, while other application endpoints enforce authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a42c392d5c8dd1fd

unresolved · supabase/functions/finance-ch-reconcile/index.ts

Ursache: A caller only needs to supply an Authorization header beginning with Bearer; the handler never validates a user, machine, or provider credential.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Privileged service client mutates durable invoice and bank line records upon receipt of an arbitrary Bearer string.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a4d6dd0a251b82c0

unresolved · supabase/functions/security-auto-scan/index.ts

Ursache: The public action begins scanning without checking a role, signed-in identity, or private automation credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler performs service_role updates directly modifying security audit findings in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a63e6a6f8b835b5d

unresolved · supabase/functions/lager-bestand-notify/index.ts

Ursache: An internet visitor controls the serial list in the request, and the callback accepts it without checking a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler invokes send-transactional-email using the service role key to send shipping notice emails to customers and internal staff.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a7401cb3c80f2da9

unresolved · supabase/functions/mobile-voice-transcribe/index.ts

Ursache: An untrusted signed-in caller supplies ticket_id; the handler authenticates the user but performs no role/capability check before using the service-role client.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Inserts internal ticket messages with service role privileges into the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a959243f59d4a590

unresolved · supabase/functions/ticket-customer-notify/index.ts

Ursache: Anyone can call this handler; it parses recipient_email and message directly from the request without verifying a caller credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sends outbound emails via Resend API and inserts records into service_communication_log without authentication or bounded recipient/content checks.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_aaa4d2aa58de11e4_56f4ee5a

unresolved · supabase/functions/delivery-route-calc/index.ts

Ursache: A signed-in user supplies any tour identifier in the request; the action validates only that a user session exists, then uses privileged credentials to load that tour and its stops.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Updates delivery_tour_stops records (and delivery_tours) in the database with recalculated positions, distances, and planned arrival/departure times using service_role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_aaa4d2aa58de11e4_c6e24d62

unresolved · supabase/functions/delivery-route-calc/index.ts

Ursache: The handler reads tour_id directly from the request body after verifying only that the caller is signed in.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Modifies delivery_tour_stops and delivery_tours records via service-role privileged client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_aab25c4aac0c36d0_10807eba

unresolved · supabase/functions/ac-qm-auto-score/index.ts

Ursache: An unauthenticated request supplies call_id and scorecard_id in its body.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function fetches call transcript and metadata from ac_calls via service role based on caller-supplied call_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_aab25c4aac0c36d0_c2bf6c3e

unresolved · supabase/functions/ac-qm-auto-score/index.ts

Ursache: The handler accepts call_id from the request and creates a service-role client without authenticating the caller or checking call ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads privileged call data (transcript) using service role and sends it to external AI endpoint, creating evaluations.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ac9f74df4aa376ea

unresolved · supabase/functions/sig-apply-facsimile/index.ts

Ursache: A caller supplies pdf_base64 and doc_type at this endpoint. The handler constructs a service-role client and uses it to access settings whose sig_facsimile_settings read policy is restricted to Admin or Super Admin.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Applying the stored organizational facsimile signature signs documents and logs the event without any role check.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_aca0bf1eb36bddcc

unresolved · supabase/functions/send-review-invitation/index.ts

Ursache: After verifying only that the bearer token is a valid user session, the handler accepts an arbitrary order_id and uses the service-role client without an ownership or authorization binding.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint queries protected order records from the orders table using privileged credentials and returns the review URL and review ID directly in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ae041d22cd49aa24

unresolved · supabase/functions/survey-send-invites/index.ts

Ursache: Any authenticated user passes the handler’s only caller check. The current survey module `sv_can_write()` policy allows only Super Admin, Admin, Marketing, or Feedback; the handler bypasses it with service-role access and performs no equivalent role check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Sends outbound emails to survey recipients via Resend and writes to survey_email_logs, survey_invitations, and survey_audit_logs using service-role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ae5f39e7f20249fc

unresolved · supabase/functions/mobile-push-send/index.ts

Ursache: The handler parses a request and proceeds to create a service-role client without authenticating the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads endpoint and auth keys from mobile_push_subscriptions via service-role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b0bea2646e06d7cc

unresolved · supabase/functions/sig-render-final/index.ts

Ursache: A visitor with a valid signing link can obtain the document and request identifiers from the public signing page, then submit those identifiers to this function without a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Uploads rendered PDF to storage and updates sig_documents record locking the document with new storage path.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b25fdd69f8b74481

unresolved · supabase/functions/finance-approval-action/index.ts

Ursache: A signed-in user supplies any approval identifier and action; the action verifies only that the session is valid and does not check the user's assignment or approval authority.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Durable update to finance_approvals and finance_incoming_invoices under service_role.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b271e3c74d949264

unresolved · supabase/functions/ticket-auto-close/index.ts

Ursache: An internet visitor can invoke the registered action without a credential; it creates a service client and immediately runs the ticket-closing procedure.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Updates status in public.tickets and inserts audit rows in public.ticket_history via service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b6ddd0c4b7e8a609

unresolved · supabase/functions/delivery-approval-monthly-report/index.ts

Ursache: The public request controls force and can override the configured recipients list with body.recipients.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler sends outbound emails via Resend to recipient addresses specified directly in the unauthenticated request body.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b84cf71745089f7f

unresolved · supabase/functions/ac-agent-assist-live/index.ts

Ursache: Anyone can POST a conversation_id to this handler; it parses the request and immediately uses a service-role Supabase client without verifying a user or provider credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function reads private conversation messages directly from public.ac_messages using service-role privileges and returns derived context in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b86c0cca0683482a

unresolved · supabase/functions/ticket-create-appointment/index.ts

Ursache: An internet visitor can send a ticket identifier and appointment details to the registered action; the code reads the ticket using a service credential without verifying a user or machine credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: An unauthenticated caller can invoke ticket-create-appointment using service-role credentials to insert appointment records into esc_events and mutate tickets.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ba7c311bb074fdc2_4edc88a2

unresolved · supabase/functions/ac-predictive-engagement/index.ts

Ursache: An unauthenticated request supplies contact_id in its body.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads contact details from durable store ac_contacts table using privileged service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ba7c311bb074fdc2_bd0ae6c3

unresolved · supabase/functions/ac-predictive-engagement/index.ts

Ursache: The handler accepts a request and creates a service-role Supabase client without verifying the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Reads interaction history including messages and call duration from ac_messages and ac_calls.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_be09aadb01290773

unresolved · supabase/functions/finance-sepa-export/index.ts

Ursache: Any signed-in user can submit an arbitrary run_id in the request body after the function checks only that a user is signed in.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: The exported direct-debit XML returns bank details, IBANs, and payment mandate references read directly from the database using privileged credentials.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c1b20729293ac269

unresolved · supabase/functions/ticket-auto-close/index.ts

Ursache: The endpoint accepts requests without checking a user or privileged role and invokes ticket_auto_close_stale() using a service-role client. The SECURITY DEFINER routine updates all qualifying public.tickets rows.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Executing supabase.rpc('ticket_auto_close_stale') updates status and writes ticket_history records for stale tickets across all users without authentication or role check.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c1f51fb90f414c65

unresolved · supabase/functions/ac-3cx-call/index.ts

Ursache: A caller with a valid user token submits a request to this handler; the handler only verifies sign-in before accepting the caller's `to` value.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Authenticated callers can trigger outbound phone calls via 3CX PBX API to arbitrary destination numbers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c3733d2c215fc774

unresolved · supabase/functions/alixdocs-smart-match/index.ts

Ursache: The handler accepts caller-supplied document_id and performs no authorization check before updating the selected document.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged client performs a database update on alixdocs_documents, modifying order_id, customer_id, device_id, match_score, match_method, and candidates.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c4bcebcef88683c2

unresolved · supabase/functions/as-send-email-reminder/index.ts

Ursache: Any authenticated caller can select the case ID, recipient email, message text, and CTA URL in the request; the handler forwards those values to its email-sending function without binding the recipient or content to a server-defined bound.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint sends an external transactional email to a caller-specified recipient with caller-controlled message body and CTA URL.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c6e230fc92a296e5

unresolved · supabase/functions/ac-3cx-webhook/index.ts

Ursache: An internet caller can POST a webhook payload; the handler rejects a mismatched secret only when PBX_3CX_WEBHOOK_SECRET is truthy, so an unset secret permits requests without a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint performs service-role upserts into ac_calls and triggers external voicemail transcription without verifying a caller credential when secret is unset.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c77c59c8e36d2de5

unresolved · supabase/functions/esc-conflict-check/index.ts

Ursache: An unauthenticated visitor submits a time window and chosen employee or resource identifiers; the action uses privileged credentials to select overlapping events across users.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler queries esc_events with the privileged service role key and returns event records including title and time slots in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d0449b3fd945f992

unresolved · supabase/functions/maintenance-reminder-daily/index.ts

Ursache: supabase/functions/maintenance-reminder-daily/index.ts

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler triggers outbound customer notification emails and mutates maintenance records via service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d30e657eadd449e2

unresolved · supabase/functions/ac-conv-intel-analyze/index.ts

Ursache: Anyone on the internet can submit a call_id; the function reads it without checking identity or call ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler transmits customer call transcript data to the external Lovable AI gateway service and inserts records into ac_voice_insights.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d50cef29292119e8

unresolved · supabase/functions/ac-churn-predict/index.ts

Ursache: Anyone on the internet can submit a contact_id; the function parses it without checking identity or contact ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Durable write to ac_predictions via service_role and response containing calculated scores.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d516be27dfccb6c8

unresolved · supabase/functions/ticket-router/index.ts

Ursache: An internet visitor can submit a ticket identifier to the registered action; the service client reads the selected ticket and routing data without verifying a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The handler executes ticket updates and inserts ticket history records using service role credentials without verifying caller identity.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d9ed56cd61cd46cd

unresolved · supabase/functions/ac-webhook-meta/index.ts

Ursache: The POST path parses request JSON and processes its entries without verifying the Meta webhook signature; the configured service-role client is used for database writes.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: POST requests execute service-role inserts into the database without Meta webhook signature verification.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e2c148fb68294c0b_0e12c928

unresolved · supabase/functions/alixdocs-upload/index.ts

Ursache: The request's existing_document_id is used as documentId, and the handler does not verify the caller's right to update that document before issuing the privileged update.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Updates current_version, mime_type, file_size, and original_filename in alixdocs_documents using admin service-role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e2c148fb68294c0b_ef5f34ce

unresolved · supabase/functions/alixdocs-upload/index.ts

Ursache: A signed-in user supplies any existing_document_id; the function retrieves the document using a privileged client without checking that the user may update it.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: A privileged storage upload writes a new file version under the caller-selected existing document ID.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e488e3d01eba5830

unresolved · supabase/functions/license-royalty-run/index.ts

Ursache: supabase/functions/license-royalty-run/index.ts

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint creates durable records in license_invoices, license_invoice_items, intercompany_invoices, and updates royalty_transactions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e9436bf2ec03c48f_2176d0bb

unresolved · supabase/functions/send-repair-quote/index.ts

Ursache: Anyone on the public internet can submit a quote_id to this request handler; it reads and writes repair quote and order records without verifying a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function uses a service role client to update the repair quote status and record sent history in durable storage.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e9436bf2ec03c48f_41eebedc

unresolved · supabase/functions/send-repair-quote/index.ts

Ursache: The handler parses quote_id and immediately creates a service-role client without authenticating the caller.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The endpoint reads private quote records from repair_quotes using service-role authority and returns the approval link containing the quote's approval token in the JSON response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e9b23515a9652ef7

unresolved · supabase/functions/collect-ai-score/index.ts

Ursache: The Deno handler accepts the request and parses optional case_id and limit values without verifying a user, machine, or provider credential.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: The unauthenticated handler performs durable updates on collect_cases risk scoring and recommendations via service_role.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e9bbf4a68ab93184

unresolved · supabase/functions/finance-tax-export/index.ts

Ursache: The handler verifies only membership in a global finance/admin role set, then accepts tenant_id from the request and applies it directly to service-role database operations without checking caller-to-tenant access.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Inserts and deletes tax filings and lines in finance_tax_filings durable store based on arbitrary caller-selected tenant_id.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_eb3640852bce3732

unresolved · supabase/functions/anzahlung-mahn-engine/index.ts

Ursache: Anyone on the internet can invoke the function; it parses the request without checking sign-in, role, or a privileged capability, then processes configured overdue deposits.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Triggers outbound transactional emails via service role to customers and durable communication logs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ed1443693bceea66

unresolved · supabase/functions/notify-order-change-request/index.ts

Ursache: An internet visitor supplies an order-change request ID in the request body, and the callback accepts it without checking a credential.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated handler triggers external outbound emails to recipients via Resend containing order change request data.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f4bd1fd6bf1a9511

unresolved · supabase/functions/catalog-import-airtable/index.ts

Ursache: A public request controls the import action, source, table, and field mapping; the action has no user or integration authorization check before using privileged credentials.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Directly updates existing records in public.catalog_items in the database using service_role privileges.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f54ab7127848f856

unresolved · supabase/functions/lager-bestand-notify/index.ts

Ursache: Anyone on the internet can provide device serial numbers in the request body; the function has no caller authentication before querying.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Privileged query reads customer personal details (company_name, contact_name, email) directly from the durable customers table.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ff271ba19700e47f

unresolved · supabase/functions/delivery-approval-mail/index.ts

Ursache: Any authenticated user passes getUser(); the handler then accepts request-controlled recipient addresses and PDF bytes without a role or content authorization check.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: The function makes an outbound call to Resend to deliver branded emails with caller-supplied attachments and note content to arbitrary caller-specified recipient addresses.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## db:anon:public.delivery_rating_token_valid(_token text, _appointment_id uuid)

unresolved · public.delivery_rating_token_valid(_token text, _appointment_id uuid)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:anon:public.esc_public_appointment_kinds()

unresolved · public.esc_public_appointment_kinds()

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:anon:public.esc_public_departments()

unresolved · public.esc_public_departments()

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:anon:public.is_portal_customer(_customer_id uuid)

unresolved · public.is_portal_customer(_customer_id uuid)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:anon:public.order_tenant_scope_ok(_order_id uuid)

unresolved · public.order_tenant_scope_ok(_order_id uuid)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:anon:public.source_to_tenant_code(_source text)

unresolved · public.source_to_tenant_code(_source text)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:anon:public.tenant_scope_id_ok(_tenant_id uuid)

unresolved · public.tenant_scope_id_ok(_tenant_id uuid)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:anon:public.tenant_scope_ok(_source text)

unresolved · public.tenant_scope_ok(_source text)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:anon:public.tenant_scope_ok_id(_tenant_id uuid)

unresolved · public.tenant_scope_ok_id(_tenant_id uuid)

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:anon:public.tenant_scope_restricted()

unresolved · public.tenant_scope_restricted()

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:anon:public.user_tenant_codes()

unresolved · public.user_tenant_codes()

Ursache: Potenzielles Risiko: anonym erreichbare Definer-Funktion; keine bestätigte Ausnutzbarkeit aus dem Linter allein.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_is_channel_member(_channel uuid, _user uuid)

unresolved · public.ac_is_channel_member(_channel uuid, _user uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_journey_attribution(days_back integer)

unresolved · public.ac_journey_attribution(days_back integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_journey_attribution_ext(_from timestamp with time zone, _to timestamp with time zone, _model text)

unresolved · public.ac_journey_attribution_ext(_from timestamp with time zone, _to timestamp with time zone, _model text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_journey_cohorts(weeks integer)

unresolved · public.ac_journey_cohorts(weeks integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_journey_funnel(days_back integer)

unresolved · public.ac_journey_funnel(days_back integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_portal_deflection(days_back integer)

unresolved · public.ac_portal_deflection(days_back integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_portal_deflection_breakdown(_from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_portal_deflection_breakdown(_from timestamp with time zone, _to timestamp with time zone)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_web_experiment_stats(_experiment_id uuid, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_experiment_stats(_experiment_id uuid, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_web_funnel_stats(_funnel_id uuid, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_funnel_stats(_funnel_id uuid, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_web_goals_summary(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_goals_summary(_website_id uuid, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_web_live_map(_website_id uuid)

unresolved · public.ac_web_live_map(_website_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_web_segment_stats(_website_id uuid, _filters jsonb, _from timestamp with time zone, _to timestamp with time zone)

unresolved · public.ac_web_segment_stats(_website_id uuid, _filters jsonb, _from timestamp with time zone, _to timestamp with time zone)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_wfm_auto_forecast(horizon_hours integer)

unresolved · public.ac_wfm_auto_forecast(horizon_hours integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.alixdocs2_doc_tenant_ok(_doc_id uuid)

unresolved · public.alixdocs2_doc_tenant_ok(_doc_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs2_purge_deleted()

unresolved · public.alixdocs2_purge_deleted()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.alixdocs_doc_tenant_ok(_doc_id uuid)

unresolved · public.alixdocs_doc_tenant_ok(_doc_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs_is_protected_category(_cat_id uuid)

unresolved · public.alixdocs_is_protected_category(_cat_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.alixsmart_emit(_event text, _data jsonb)

unresolved · public.alixsmart_emit(_event text, _data jsonb)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.as_seed_default_checklists(p_case uuid)

unresolved · public.as_seed_default_checklists(p_case uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.audit_retention_purge()

unresolved · public.audit_retention_purge()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.backup_watchdog_mark_stuck()

unresolved · public.backup_watchdog_mark_stuck()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.calc_media_package_progress(_mp_id uuid)

unresolved · public.calc_media_package_progress(_mp_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.can_access_media_package(_mp_id uuid)

unresolved · public.can_access_media_package(_mp_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.can_write_media_package(_mp_id uuid)

unresolved · public.can_write_media_package(_mp_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.check_rate_limit(_bucket text, _max integer, _window_seconds integer)

unresolved · public.check_rate_limit(_bucket text, _max integer, _window_seconds integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.clear_factory_invoice_pdf(_production_order_id uuid)

unresolved · public.clear_factory_invoice_pdf(_production_order_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.cmr_dashboard_kpis(_tenant_id uuid)

unresolved · public.cmr_dashboard_kpis(_tenant_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.cmr_next_document_number(_tenant_id uuid, _doc_type text)

unresolved · public.cmr_next_document_number(_tenant_id uuid, _doc_type text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.cmr_tenant_id()

unresolved · public.cmr_tenant_id()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_bi()

unresolved · public.collect_bi()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_bi(p_tenant_id uuid)

unresolved · public.collect_bi(p_tenant_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_case_tenant_ok(_case_id uuid)

unresolved · public.collect_case_tenant_ok(_case_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.collect_dashboard()

unresolved · public.collect_dashboard()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_dashboard_kpis()

unresolved · public.collect_dashboard_kpis()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_sync_cases()

unresolved · public.collect_sync_cases()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_sync_customer(p_key text)

unresolved · public.collect_sync_customer(p_key text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.customer_tenant_ok(_customer_id uuid)

unresolved · public.customer_tenant_ok(_customer_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.delivery_generate_loading_list(p_tour_id uuid)

unresolved · public.delivery_generate_loading_list(p_tour_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.delivery_rating_token_valid(_token text, _appointment_id uuid)

unresolved · public.delivery_rating_token_valid(_token text, _appointment_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.delivery_seed_release_checklist(p_tour_id uuid)

unresolved · public.delivery_seed_release_checklist(p_tour_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.dispatch_sync_all_appointments_to_calendar()

unresolved · public.dispatch_sync_all_appointments_to_calendar()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.dispatch_sync_appointment_to_calendar(p_appointment_id uuid)

unresolved · public.dispatch_sync_appointment_to_calendar(p_appointment_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.dl_upsert(_serial text, _device text, _customer_id uuid, _customer_name text, _event_type text, _event_date timestamp with time zone, _event_source text, _reference_id text, _description text, _meta jsonb)

unresolved · public.dl_upsert(_serial text, _device text, _customer_id uuid, _customer_name text, _event_type text, _event_date timestamp with time zone, _event_source text, _reference_id text, _description text, _meta jsonb)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.esc_event_tenant_ok(_event_id uuid)

unresolved · public.esc_event_tenant_ok(_event_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_is_department_lead(_user_id uuid, _department_id uuid)

unresolved · public.esc_is_department_lead(_user_id uuid, _department_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.esc_public_appointment_kinds()

unresolved · public.esc_public_appointment_kinds()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.esc_public_departments()

unresolved · public.esc_public_departments()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.expire_break_glass_sessions()

unresolved · public.expire_break_glass_sessions()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.expire_temporary_role_grants()

unresolved · public.expire_temporary_role_grants()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_month_close(p_from date, p_to date)

unresolved · public.fc_month_close(p_from date, p_to date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_order_invoice_gap(p_order_id uuid)

unresolved · public.fc_order_invoice_gap(p_order_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_refresh_order(p_order_id uuid)

unresolved · public.fc_refresh_order(p_order_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_upsert_case(p_case_type text, p_event text, p_table text, p_source_id uuid, p_order_id uuid, p_customer_id uuid, p_customer_name text, p_reference text, p_amount numeric, p_billing_flag text, p_critical boolean)

unresolved · public.fc_upsert_case(p_case_type text, p_event text, p_table text, p_source_id uuid, p_order_id uuid, p_customer_id uuid, p_customer_name text, p_reference text, p_amount numeric, p_billing_flag text, p_critical boolean)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_add_note(p_invoice_id uuid, p_note text)

unresolved · public.fibu_light_add_note(p_invoice_id uuid, p_note text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_bank_dashboard()

unresolved · public.fibu_light_bank_dashboard()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_bank_group_suggestion(p_transaction_id uuid)

unresolved · public.fibu_light_bank_group_suggestion(p_transaction_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_bank_list(p_filter text, p_search text, p_limit integer)

unresolved · public.fibu_light_bank_list(p_filter text, p_search text, p_limit integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_bank_match_suggestions(p_limit integer)

unresolved · public.fibu_light_bank_match_suggestions(p_limit integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_bank_set_case(p_transaction_id uuid, p_reason text, p_note text, p_action text)

unresolved · public.fibu_light_bank_set_case(p_transaction_id uuid, p_reason text, p_note text, p_action text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_bank_suggestions(p_transaction_id uuid, p_limit integer)

unresolved · public.fibu_light_bank_suggestions(p_transaction_id uuid, p_limit integer)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_clear_clarification(p_invoice_id uuid, p_note text)

unresolved · public.fibu_light_clear_clarification(p_invoice_id uuid, p_note text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_clear_escalation(p_invoice_id uuid, p_note text)

unresolved · public.fibu_light_clear_escalation(p_invoice_id uuid, p_note text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_create_installment_plan(p_invoice_id uuid, p_count smallint, p_amount numeric, p_first_due date, p_interval_months smallint, p_note text)

unresolved · public.fibu_light_create_installment_plan(p_invoice_id uuid, p_count smallint, p_amount numeric, p_first_due date, p_interval_months smallint, p_note text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_invoice_history(p_invoice_id uuid)

unresolved · public.fibu_light_invoice_history(p_invoice_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_last_emails(p_invoice_ids uuid[])

unresolved · public.fibu_light_last_emails(p_invoice_ids uuid[])

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_log_dunning(p_invoice_id uuid, p_level smallint, p_recipient text, p_subject text, p_message text, p_open_amount numeric, p_send_status text, p_error text)

unresolved · public.fibu_light_log_dunning(p_invoice_id uuid, p_level smallint, p_recipient text, p_subject text, p_message text, p_open_amount numeric, p_send_status text, p_error text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_log_dunning(p_invoice_id uuid, p_level smallint, p_recipient text, p_subject text, p_message text, p_open_amount numeric, p_send_status text, p_error text, p_track_token uuid)

unresolved · public.fibu_light_log_dunning(p_invoice_id uuid, p_level smallint, p_recipient text, p_subject text, p_message text, p_open_amount numeric, p_send_status text, p_error text, p_track_token uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_open_items()

unresolved · public.fibu_light_open_items()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_report_booking_issue(p_invoice_id uuid, p_description text, p_transaction_id uuid)

unresolved · public.fibu_light_report_booking_issue(p_invoice_id uuid, p_description text, p_transaction_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_set_clarification(p_invoice_id uuid, p_reason text, p_note text, p_pause_until date)

unresolved · public.fibu_light_set_clarification(p_invoice_id uuid, p_reason text, p_note text, p_pause_until date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fibu_light_set_escalation(p_invoice_ids uuid[], p_stage text, p_note text)

unresolved · public.fibu_light_set_escalation(p_invoice_ids uuid[], p_stage text, p_note text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_cost_center_report(p_region public.accounting_region, p_from date, p_to date)

unresolved · public.finance_cost_center_report(p_region public.accounting_region, p_from date, p_to date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_dashboard_kpis(_region public.accounting_region)

unresolved · public.finance_dashboard_kpis(_region public.accounting_region)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_db_summary(p_region public.accounting_region, p_from date, p_to date)

unresolved · public.finance_db_summary(p_region public.accounting_region, p_from date, p_to date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_move_region(p_target public.accounting_region, p_customer_names text[], p_invoice_ids uuid[], p_recurring_ids uuid[])

unresolved · public.finance_move_region(p_target public.accounting_region, p_customer_names text[], p_invoice_ids uuid[], p_recurring_ids uuid[])

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_period_is_postable(_region public.accounting_region, _dt date)

unresolved · public.finance_period_is_postable(_region public.accounting_region, _dt date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_segment_report(p_region public.accounting_region, p_from date, p_to date)

unresolved · public.finance_segment_report(p_region public.accounting_region, p_from date, p_to date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.get_customer_banking(_customer_id uuid)

unresolved · public.get_customer_banking(_customer_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.get_table_columns(_table text)

unresolved · public.get_table_columns(_table text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_compliance_check()

unresolved · public.gobd_compliance_check()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_has_legal_hold(_object_table text, _object_id uuid, _data_class_code text)

unresolved · public.gobd_has_legal_hold(_object_table text, _object_id uuid, _data_class_code text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_period_state(_region public.accounting_region, _dt date)

unresolved · public.gobd_period_state(_region public.accounting_region, _dt date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_phase13_check()

unresolved · public.gobd_phase13_check()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_phase14_check()

unresolved · public.gobd_phase14_check()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_retention_due_date(_data_class_code text, _start timestamp with time zone)

unresolved · public.gobd_retention_due_date(_data_class_code text, _start timestamp with time zone)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.has_accounting_region(_user_id uuid, _region public.accounting_region)

unresolved · public.has_accounting_region(_user_id uuid, _region public.accounting_region)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.has_finance_region_access(_region public.accounting_region)

unresolved · public.has_finance_region_access(_region public.accounting_region)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.has_valid_reauth(_user_id uuid, _purpose text)

unresolved · public.has_valid_reauth(_user_id uuid, _purpose text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.hoo_ops_kpis()

unresolved · public.hoo_ops_kpis()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.is_ac_meeting_member(_meeting_id uuid, _user uuid)

unresolved · public.is_ac_meeting_member(_meeting_id uuid, _user uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.is_device_active(_sub_id uuid)

unresolved · public.is_device_active(_sub_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.lager_overview_counts()

unresolved · public.lager_overview_counts()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.license_next_number(p_prefix text)

unresolved · public.license_next_number(p_prefix text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.mailcenter_dashboard_kpis()

unresolved · public.mailcenter_dashboard_kpis()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.main_dashboard_kpis(p_at_only boolean)

unresolved · public.main_dashboard_kpis(p_at_only boolean)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.main_dashboard_tenant_kpis(p_source_system text, p_tenant_id uuid, p_tenant_selected boolean)

unresolved · public.main_dashboard_tenant_kpis(p_source_system text, p_tenant_id uuid, p_tenant_selected boolean)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.mark_credit_note_sent(_id uuid, _to text)

unresolved · public.mark_credit_note_sent(_id uuid, _to text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.mfa_required_for_user(_user_id uuid)

unresolved · public.mfa_required_for_user(_user_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ml_admin_delete_lead(_lead_id uuid)

unresolved · public.ml_admin_delete_lead(_lead_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.next_case_number()

unresolved · public.next_case_number()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.next_document_number(p_code text)

unresolved · public.next_document_number(p_code text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.next_document_number(p_code text, p_case_number text)

unresolved · public.next_document_number(p_code text, p_case_number text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.next_invoice_number(p_date date)

unresolved · public.next_invoice_number(p_date date)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.notify_customer_event(_event text, _ticket_id uuid, _repair_order_id uuid, _recipient_email text, _customer_name text, _ticket_number text, _repair_number text, _message text)

unresolved · public.notify_customer_event(_event text, _ticket_id uuid, _repair_order_id uuid, _recipient_email text, _customer_name text, _ticket_number text, _repair_number text, _message text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.notify_super_admins(_kind text, _title text, _body text, _ref_type text, _ref_id uuid, _severity text)

unresolved · public.notify_super_admins(_kind text, _title text, _body text, _ref_type text, _ref_id uuid, _severity text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.order_status_counts(p_order_id uuid)

unresolved · public.order_status_counts(p_order_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.order_tenant_scope_ok(_order_id uuid)

unresolved · public.order_tenant_scope_ok(_order_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.peek_document_number(p_code text)

unresolved · public.peek_document_number(p_code text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ph_catalog_public(_catalog_id uuid) [PRODUCT HUB]

unresolved · public.ph_catalog_public(_catalog_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.recompute_device_health(_serial text)

unresolved · public.recompute_device_health(_serial text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.refresh_warranty_and_maintenance_status()

unresolved · public.refresh_warranty_and_maintenance_status()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.repair_quote_tenant_ok(_quote_id uuid)

unresolved · public.repair_quote_tenant_ok(_quote_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.repair_tenant_ok(_repair_order_id uuid)

unresolved · public.repair_tenant_ok(_repair_order_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_confirm_creditor(p_creditor_id text)

unresolved · public.rp_confirm_creditor(p_creditor_id text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_get_mandate_iban(p_mandate_id uuid)

unresolved · public.rp_get_mandate_iban(p_mandate_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_installment_schedule(p_plan_id uuid)

unresolved · public.rp_installment_schedule(p_plan_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_item_action(p_item_ids uuid[], p_action text, p_value text, p_reason text)

unresolved · public.rp_item_action(p_item_ids uuid[], p_action text, p_value text, p_reason text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_list_mandates()

unresolved · public.rp_list_mandates()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_log_delivery(p_prenotification_id uuid, p_channel text, p_recipient text, p_status text, p_is_resend boolean, p_provider_ref text, p_error text)

unresolved · public.rp_log_delivery(p_prenotification_id uuid, p_channel text, p_recipient text, p_status text, p_is_resend boolean, p_provider_ref text, p_error text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_prepare_direct_debit(p_run_id uuid)

unresolved · public.rp_prepare_direct_debit(p_run_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_prepare_run(p_period text)

unresolved · public.rp_prepare_run(p_period text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_return_debit_action(p_id uuid, p_status text, p_note text)

unresolved · public.rp_return_debit_action(p_id uuid, p_status text, p_note text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_sync_payments(p_run_id uuid)

unresolved · public.rp_sync_payments(p_run_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.rp_validate_run(p_run_id uuid)

unresolved · public.rp_validate_run(p_run_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.security_deactivate_stale_sessions()

unresolved · public.security_deactivate_stale_sessions()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.security_has_permission(_user_id uuid, _permission_key text)

unresolved · public.security_has_permission(_user_id uuid, _permission_key text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_factory_invoice_pdf(_production_order_id uuid, _path text)

unresolved · public.set_factory_invoice_pdf(_production_order_id uuid, _path text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sidebar_lager_counts()

unresolved · public.sidebar_lager_counts()

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sidebar_production_counts(p_at_only boolean)

unresolved · public.sidebar_production_counts(p_at_only boolean)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.source_to_tenant_code(_source text)

unresolved · public.source_to_tenant_code(_source text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tenant_scope_id_ok(_tenant_id uuid)

unresolved · public.tenant_scope_id_ok(_tenant_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.tenant_scope_ok(_source text)

unresolved · public.tenant_scope_ok(_source text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.tenant_scope_ok_id(_tenant_id uuid)

unresolved · public.tenant_scope_ok_id(_tenant_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.tickets_dashboard_counts(_user_id uuid)

unresolved · public.tickets_dashboard_counts(_user_id uuid)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tickets_dashboard_counts(_user_id uuid, _source_system text)

unresolved · public.tickets_dashboard_counts(_user_id uuid, _source_system text)

Ursache: Potenzielles Risiko: Definer-RPC ohne einfach erkennbaren Rollencheck; abhängige Schutzfunktionen manuell prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## lov_finding_006a75d168f7259a

unresolved · supabase/functions/ac-email-autolink/index.ts

Ursache: The endpoint accepts requests without verifying a caller credential and uses the service-role client to read mail, contact, and order data and update mail links.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint queries database tables and writes updates to mail_messages in durable storage using the service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_01b05992862b294b

unresolved · supabase/functions/admin-reset-jerry/index.ts

Ursache: Anyone can change a user's password through the password reset feature, so they can take over that person's account.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint performs an administrative password reset using service role credentials without requiring an admin role or privileged authority.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_01c314f2b58b194b

unresolved · supabase/functions/offers-ai-autoscore/index.ts

Ursache: Anyone can change scores on your open offers, so sales decisions can be influenced without an authorized employee.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates ai_probability, offer_score, ai_reason, ai_actions, and ai_scored_at in the offers database table using service-role privileges.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_02f750951452daf6

unresolved · supabase/functions/ac-journey-tick/index.ts

Ursache: The endpoint verifies no user, provider, or machine credential before querying due journey runs and their associated contacts with service-role access.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can execute the endpoint to read private journey and contact records, send outbound customer communications (SMS, WhatsApp, Email), and mutate journey run states in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_040f79f8da123789

unresolved · supabase/functions/import-alix-lasers-de/index.ts

Ursache: Any signed-in user can overwrite shared product listings, so customers may see inaccurate product information.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler uses service_role credentials to mutate ph_products records directly in durable storage.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0cd00d4445ad701e

unresolved · supabase/functions/as-send-sms-reminder/index.ts

Ursache: The handler inserts a reminder for any request-selected case with the service role and never checks whether the authenticated caller may manage that case.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The edge function inserts rows into as_reminders using the privileged admin client for any caller-selected case_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_0e9d121dc4ee77fc

unresolved · supabase/functions/bank-api-fetch/index.ts

Ursache: Anyone can trigger bank statement imports without authentication, causing external statements to be uploaded and recorded into finance import tables.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Uses the privileged service-role client to upload statement files to the bank-statements storage bucket and insert new bank_imports rows.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_108fb37fdfeda925

unresolved · supabase/functions/ac-customer-intel/index.ts

Ursache: Anyone can send a customer's private contact, message, and call details to an outside service, so confidential customer information may be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Private contact, message, and call data are posted to an external AI service and saved to ac_predictions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_10fba61adf821212 [PRODUCT HUB]

unresolved · supabase/functions/ph-en-batch/index.ts

Ursache: Anyone can replace approved product copy, so published catalog content can be altered without staff approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler runs batch translation updates directly against ph_product_translations with a service role client, executing durable database upserts.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_113966ca22401a64

unresolved · supabase/functions/sync-zoho-to-finance/index.ts

Ursache: The public handler performs privileged reads and finance writes without verifying any user, machine, or provider credential.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated edge function writes and updates records in finance_transactions and finance_accounts using service-role privileges.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1376815e4ca5950a

unresolved · supabase/functions/ai-service-analyze/index.ts

Ursache: An authenticated caller can submit any ticket_id, which the handler reads with service-role credentials without checking that the caller may access that ticket.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads unverified tickets table row using privileged service-role client and returns analysis derived from it.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_13d6e91ec712f40a_604475b4

unresolved · supabase/functions/ac-router-simulate/index.ts

Ursache: Anyone can retrieve customer scores and internal agent-routing details, exposing confidential customer and workforce information.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The privileged service-role client retrieves score data from durable store ac_customer_scores and returns it to unauthenticated callers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_16d3e37b9c8ba4ad

unresolved · supabase/migrations/20260720211642_0d5010b4-1c33-4de4-a985-051f29bfb91d.sql

Ursache: Any signed-in user can query funnel analytics for any website, exposing cross-tenant website visitor and funnel statistics.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function executes as SECURITY DEFINER and reads raw event records from public.ac_analytics_events for any chosen funnel's website, returning visitor counts and conversion metrics.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1794cebaf2967832

unresolved · src/pages/PLM/Aenderungsfreigabe.tsx

Ursache: Production staff can mark a change approved as if quality had signed off, so changes can pass review without independent quality oversight.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Direct client updates to plm_changes allow users with non-QM write roles (such as Produktion) to persist approvals and QM sign-offs in the database without server-side role validation.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1a410c3cce005159

unresolved · supabase/functions/social-competitors-sync/index.ts

Ursache: Anyone can rewrite competitor reports for every customer, so business analytics can be made unreliable.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged client executes upsert directly on social_competitor_snapshots table.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1aac574b83b92e0b

unresolved · supabase/functions/cmr-recurring-run/index.ts

Ursache: The unauthenticated service-role handler reads recurring plans and settings, creates tenant invoices, and advances billing schedules without authenticating its caller.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated requests use service role authority to generate invoices in cmr_documents and advance recurring plan schedules in cmr_recurring_plans.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1b423c4366778754_78e6bd31

unresolved · supabase/migrations/20260720212030_9bf55c82-51cf-4ae2-b9f5-c0c3c167c120.sql

Ursache: Any signed-in user can view another site's live visitor locations and activity, so visitors' recent activity can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Queries live visitor counts and locations from public.ac_analytics_events for any caller-supplied _website_id using SECURITY DEFINER without verifying website ownership or tenant membership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1c06d10916b40cbc

unresolved · supabase/functions/finance-tax-export/index.ts

Ursache: Any finance user can export another company's tax data, so confidential financial totals and transaction details are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Persists filing lines and returns calculated filing data derived from transactions across tenants.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_1deb9bcf8e2fe9db

unresolved · supabase/functions/ticket-create-appointment/index.ts

Ursache: Anyone can create appointments and change ticket dates or status, so another customer's support case can be altered without permission.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler updates the target ticket status and appointment timestamps in public.tickets using privileged service-role access without caller authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_214081f60b07281d

unresolved · supabase/functions/mobile-voice-transcribe/index.ts

Ursache: The authenticated caller supplies the ticket ID, while the handler inserts with service-role credentials and does not check the caller's authority over that ticket.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: A ticket_messages row is inserted using the service-role client for an arbitrary caller-controlled ticket_id without verifying access to the ticket.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_22d2f74a8a4d2421

unresolved · supabase/functions/bank-api-fetch/index.ts

Ursache: Anyone can run the bank statement import endpoint without authentication, accessing internal banking configurations and writing bank statements using privileged credentials.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads protected bank connection configurations from app_settings using the service role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_24579cadca97b1b6

unresolved · supabase/functions/alixdocs-hash-backfill/index.ts

Ursache: Anyone can invoke this handler without an Authorization header; the empty-token path skips verification and proceeds using the service-role client.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers invoke the handler, which downloads storage objects and mutates document records using service-role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_27ef54fe18b6bfc6

unresolved · supabase/functions/alixdocs-learn-rules/index.ts

Ursache: Anyone can invoke the function without authentication to read feedback and document metadata if dry_run is set.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers trigger execution which modifies alixdocs_matching_rules durable state.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_28bb477650901ea0_7d236364

unresolved · supabase/functions/delivery-approval-monthly-report/index.ts

Ursache: Anyone can email the approval report to an address they choose, exposing internal operating data.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sends an external email via Resend containing delivery approval internal operating figures to any caller-supplied recipient address.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_291229c8706e74d8

unresolved · supabase/functions/esc-whatsapp-inbound/index.ts

Ursache: Anyone can mark another person's event confirmed or declined, so attendance and scheduling can change without consent.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged update to esc_events row modifying event status without validating caller resource ownership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2989a7a085c7a5ca_bfcf4258

unresolved · supabase/functions/dispatch-eta-sms/index.ts

Ursache: The request-selected route_plan_id is used for a service-role update without checking whether the caller is authorized for that record.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler uses the service-role client to mutate eta_at on arbitrary route_plans rows.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2d96488747bd90ab

unresolved · supabase/functions/alixdocs-approval-decide/index.ts

Ursache: The service-role update accepts a decision without an assigned-approver binding whenever the pending state has a null current_approver.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates approval state and doc status with service-role client when current_approver is null.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_2f496f49c8a0776a

unresolved · supabase/functions/sig-apply-facsimile/index.ts

Ursache: Anyone can apply your stored signature to an uploaded document, so people may mistake it for an approved company document.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated handler queries settings and stamps the document while writing an audit row to sig_facsimile_log.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_310b81ae9b51152a

unresolved · supabase/functions/mobile-push-send/index.ts

Ursache: The endpoint never verifies a caller credential before using service-role access to query role membership and push subscriptions associated with the caller-selected recipients.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint queries private push subscription credentials (endpoint, p256dh, auth_key) using the service-role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_312fcf7bf6edca18_3be70c29

unresolved · supabase/functions/send-invoice-mail/index.ts

Ursache: Anyone can send custom emails to arbitrary addresses from your business, so recipients can receive unwanted messages and your account may be used for spam.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sends external emails via Lovable Email or Resend to arbitrary caller-specified addresses with caller-controlled content without verifying the Authorization token.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_321b0bea0163279e

unresolved · supabase/functions/collect-document-generate/index.ts

Ursache: Any finance user can create collection documents for other tenants, so confidential financial records can be changed without approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged service client inserts records into collect_documents for arbitrary tenant case_ids.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_37d780060351d132

unresolved · supabase/functions/mediapaket-reminders/index.ts

Ursache: The unauthenticated request controls base_url, which is embedded in reminder and notification emails sent to customers and staff; no server-chosen destination bound is applied.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: An unauthenticated request sets base_url which is included in emails sent via send-mail to customers and staff.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_38eef2927644a86c_2da0a87d

unresolved · supabase/functions/ticket-sla-check/index.ts

Ursache: The endpoint verifies no caller credential before invoking a SECURITY DEFINER function with the service-role client.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated handler invokes ticket_sla_check_and_escalate via service role, updating ticket sla_status, escalation counts, priorities, and inserting history records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_38eef2927644a86c_47b6f826

unresolved · supabase/functions/ticket-sla-check/index.ts

Ursache: Anyone can trigger ticket priority and service-level changes, so your team may lose control of customer-case handling.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers invoke ticket_sla_check_and_escalate() using service_role, modifying status and escalating priority of tickets.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_39468467a3a1e242

unresolved · supabase/functions/send-repair-quote/index.ts

Ursache: An unauthenticated request selects the record that determines the external recipient and quote content.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint sends an external email via Resend API to the customer email retrieved based on caller-specified quote_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3e5d7e5d17036bf2

unresolved · supabase/functions/tmp-create-sobitsch/index.ts

Ursache: The endpoint performs account administration and commission setup without verifying an authorized role or capability.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler invokes admin.auth.admin.createUser to create a Supabase Auth account and bulk upserts records into commission_assignments using a service-role client without authentication or authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3e6f3a3c10a40230

unresolved · supabase/functions/pruefung-release/index.ts

Ursache: The handler verifies only that the caller is signed in. It does not check an admin role before releasing held installments, emailing the customer, and changing their invoice status to open.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function sends customer emails and modifies durable database records in ratenplan_generated_invoices with service role privileges.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3f184b5b3878e895

unresolved · supabase/functions/ac-webhook-dispatch/index.ts

Ursache: Anyone can send fabricated events through your saved integrations, so connected systems may act on unapproved information.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged service_role insert into ac_event_bus with caller-supplied payload and event_type triggers outbound delivery to active subscriptions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3f531b21758d8b2f

unresolved · supabase/functions/send-mail/index.ts

Ursache: Signed-in users allowed to send mail can send custom messages to arbitrary addresses, so outsiders can receive unwanted messages from your business.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function sends external emails via Resend to caller-chosen recipients with caller-supplied subject and body content, producing an external outbound communication effect without server bounds.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_3f6f96a860e513ff

unresolved · supabase/functions/ac-workflow-studio/index.ts

Ursache: The save operation uses the service-role key without authenticating the caller or checking an admin role, and accepts a request-selected active flag.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Handler writes automation rules directly into database table ac_automation_rules with service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_413dd4d3641d23bd

unresolved · supabase/functions/as-ai-suggest/index.ts

Ursache: Any signed-in user can invoke a service-role case update that the database policy reserves for designated staff roles.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates health_score on as_cases and inserts timeline and upsell records using service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_43edd4e59b516cae

unresolved · supabase/functions/ac-agent-assist-live/index.ts

Ursache: Anyone can have private customer chats processed through agent assistance, so customer correspondence is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler loads private customer messages from public.ac_messages and returns derived conversation context in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_44ddf2563f3b0bce

unresolved · supabase/functions/cmr-send-document/index.ts

Ursache: The service-role lookup trusts a request-supplied documentId and does not verify that the authenticated caller may access that document or its tenant.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged service-role client queries an arbitrary documentId without verifying tenant ownership and updates its status and sent_at timestamp.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_452bd5908dcf2082

unresolved · supabase/functions/ticket-customer-notify/index.ts

Ursache: Anyone can trigger an email from the service address to a caller-chosen recipient with caller-written content.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends arbitrary emails to caller-specified recipient_email via Resend external API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4bc3611a6285a5f0

unresolved · supabase/functions/ac-conversation-qa/index.ts

Ursache: Anyone can send another customer’s conversation to quality review, so private support discussions are exposed outside your application.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Caller-supplied conversation_id is loaded via service_role bypass and transmitted to an external service.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_4e8e8f0051d29984

unresolved · supabase/functions/esc-calendar-sync/index.ts

Ursache: Anyone can trigger updates to employees' connected calendars, exposing scheduled event details and disrupting their personal schedules.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler reads events and pushes updates to third-party APIs using service role access without authenticating the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_52b818a8bbb78eb6

unresolved · supabase/functions/social-showcase-public/index.ts

Ursache: Anyone can disable or replace another customer's public showcase, so their marketing page and visitor access can be disrupted.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated requests write and overwrite showcase configuration records in the app_settings table via the privileged service-role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_55788009de5e6065

unresolved · supabase/functions/ac-wfm-adherence-alerts/index.ts

Ursache: Anyone can invoke this handler without a credential; it uses the service-role client to call an internal workforce-adherence RPC and create notifications for agents.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Handler creates notification records in durable app_notifications storage and returns internal adherence metrics count without auth.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_55eebf6531b0d797

unresolved · supabase/functions/catalog-import-firecrawl/index.ts

Ursache: Anyone can replace an existing catalog item with scraped details, so product records can be corrupted.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Directly updates existing catalog_items rows in the database using the privileged service role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_58c64b182fdc8abb_138f6013

unresolved · supabase/functions/finance-asset-depreciation-run/index.ts

Ursache: Anyone can change asset values and view asset details, so your financial records and planning can be altered or exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler performs service-role upserts into finance_asset_depreciations without authenticating the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_58c64b182fdc8abb_baa3b4af

unresolved · supabase/functions/finance-asset-depreciation-run/index.ts

Ursache: The endpoint never verifies the Authorization header; it uses a service-role client to read all active assets and returns asset names, values, and computed depreciation entries.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler executes an unauthenticated service-role SELECT against finance_assets and returns asset names, values, and calculations in the HTTP response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_597a547a91b6cb80

unresolved · supabase/functions/orders-inbox-process/index.ts

Ursache: Anyone can process pending customer orders through the order import, so private customer and order records can be changed without approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts orders into the orders table and modifies customer and inbox records in durable storage without verifying caller identity.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5a4b77537eec8b00

unresolved · supabase/functions/alixdocs-zip/index.ts

Ursache: The endpoint verifies access to the document row, then uses a service-role lookup and download for storage_path, which authenticated clients can supply when inserting version rows.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged storage download fetches arbitrary files from the private bucket into a zip returned to the client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5bcfc333ec4f9bc9

unresolved · supabase/functions/finance-asset-depreciation-run/index.ts

Ursache: Anyone can change asset values and post depreciation, so financial statements can be misstated.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler performs service-role updates on finance_assets rows without checking caller authentication or role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5e865420cc71ba0c

unresolved · supabase/functions/collect-send-sms/index.ts

Ursache: Any signed-in finance user can send custom texts to arbitrary phone numbers, so people can receive unwanted messages from your business.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends outbound messages via Twilio to arbitrary caller-selected recipients with caller-controlled message text.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_5eb7960ed2ed2229

unresolved · src/pages/AlixDocsAiSearch.tsx

Ursache: Any signed-in user can add executable markup to a document, so an administrator who searches it can lose control of their account.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Search snippet containing raw unescaped HTML from document full text is rendered directly into the DOM via dangerouslySetInnerHTML in an administrative UI view.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_60a9985b359fcaaf

unresolved · supabase/functions/catalog-import-airtable/index.ts

Ursache: Anyone can call the handler’s list and preview actions; it uses the server’s Airtable credentials and returns base metadata or records without verifying a caller credential.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Calls Airtable metadata and record APIs with server credentials and returns third-party data without authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_62db31108e6e90e3

unresolved · supabase/functions/ac-voice-ai-studio/index.ts

Ursache: The endpoint submits caller-controlled campaign objectives to the metered AI gateway without authentication and returns its generated script.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Outbound call to metered external Lovable AI gateway and durable insert into ac_predictions without authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_63a444f362255ddb

unresolved · supabase/functions/ac-campaign-ab-decide/index.ts

Ursache: Anyone can inspect recipient activity and change a campaign’s reported winner, so campaign results can be manipulated and customer activity exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates campaign ab_variants and results for an arbitrary caller-chosen campaign_id.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_63fca018638248be_28891043

unresolved · supabase/functions/ac-chat/index.ts

Ursache: Anyone can post messages into another visitor's chat conversation, allowing them to tamper with support requests and impersonate users.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler performs a durable insert into ac_messages using the privileged service client for an unauthenticated, caller-asserted conversation.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_63fca018638248be_53993ff0

unresolved · supabase/functions/ac-chat/index.ts

Ursache: The poll action checks only that a caller-selected conversation belongs to the site selected by the request key.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Returns messages from public.ac_messages for any conversation ID belonging to the website.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6708a45359831172

unresolved · supabase/functions/send-invoice-mail/index.ts

Ursache: Any signed-in finance user can send payment notices with custom content to arbitrary addresses, so private account details may reach the wrong people.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: collect-send-dunning calls send-invoice-mail which transmits outbound emails via external email service to arbitrary caller-supplied to_email and subject/body.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_675c4841c9be4f6b

unresolved · supabase/functions/ac-router-simulate/index.ts

Ursache: Anyone can inspect agent availability, assignments, and internal routing rules, so staffing and customer-service operations are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler queries ac_routing_rules with service-role credentials and returns simulation details to unauthenticated callers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_676a76c192d1c5c0

unresolved · supabase/functions/finance-qr-generate/index.ts

Ursache: Anyone can alter an invoice's payment details, so customers may receive incorrect payment instructions.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler updates the database row's reference and status fields using a privileged admin client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6820ef9219a29db8

unresolved · supabase/functions/ac-kb-embed/index.ts

Ursache: Anyone can send another team’s knowledge article for external processing, so confidential draft material may be disclosed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler sends article text externally to the Lovable AI Gateway and persists the resulting embedding vector to the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_689b0326e896c2b9

unresolved · supabase/functions/collect-morning-report/index.ts

Ursache: Anyone can see customer debt totals, high-risk names, and payment expectations, so sensitive financial information is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint executes privileged upsert operations into collect_morning_reports and triggers Lovable AI API requests without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6cf979d98c0592e9

unresolved · supabase/functions/ac-customer-intel/index.ts

Ursache: Anyone can trigger customer intelligence analysis for any contact id, sending private customer messages and call history to an outside AI service and writing predictions.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler transmits private contact records, messages, and calls to external AI and inserts predictions into ac_predictions.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6f686b06e95c91e0

unresolved · supabase/functions/ac-omnichannel-orchestrate/index.ts

Ursache: Anyone can send customer details and conversation history to an outside analysis service, so customer information may leave your business without approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers cause outbound HTTP POST requests transmitting customer and message data to an external AI gateway.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_718ef6275274a96d

unresolved · supabase/functions/tmp-create-sobitsch/index.ts

Ursache: The endpoint verifies no caller identity or role before creating an auth user and assigning the fixed identity commission rights across matching orders.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint uses the service role key to provision user profiles, commission employee records, and commission assignments without caller authentication or role checks.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_742579dc7034b64e

unresolved · supabase/functions/social-metrics-sync/index.ts

Ursache: Anyone can rewrite published-post metrics for customers, so performance reports can be made misleading.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged service-role query selects by caller-provided post_id and writes metrics without checking client ownership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_74e43b7ec94e2367_821fd4e7

unresolved · supabase/functions/alixdocs-customer-export/index.ts

Ursache: Any signed-in user without a tenant assignment can export another customer's documents, so private files and customer details can leave their intended audience.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Downloads private files from storage bucket alixdocs-private and returns them in a zip.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_752434abd9742e22

unresolved · supabase/functions/finance-ai-forecast/index.ts

Ursache: Anyone can read financial activity and rewrite forecast records, so sensitive business figures and planning can be exposed or changed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Upserts forecast rows into the database with service-role privileges without authenticating the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_755a57788035e770

unresolved · supabase/functions/send-order-confirmation/index.ts

Ursache: Any authenticated user can supply an arbitrary recipient email address to receive order details and signed document links.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function sends an outbound email containing order details and download link via Resend API to the requester-chosen recipient.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_77810b1b4b728af7

unresolved · supabase/migrations/20260720205540_12d9e922-2380-414e-81fd-03062eda49ac.sql

Ursache: Any signed-in user can read another site's goal results and revenue totals, so confidential business performance can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads goals and analytics conversion / revenue metrics for any caller-supplied _website_id from public.ac_web_goals and public.ac_analytics_events without tenant or ownership authorization.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7c6fbb7e2e06dc5b

unresolved · supabase/functions/lager-bestand-notify/index.ts

Ursache: Anyone can trigger inventory notices, so customer details and device records can reach unauthorized recipients.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends notification emails to customer addresses and internal staff.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7cfb49a133e44934

unresolved · supabase/functions/maintenance-reminder-daily/index.ts

Ursache: Anyone can run maintenance reminders, so private maintenance records can be changed and customer notices sent without approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated caller invokes status refresh and database mutations across maintenance records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_7f26776bd0d3a68e

unresolved · supabase/functions/convert-signed-offer-to-order/order-identity.ts

Ursache: Anyone can create orders from signed offers, so your team may process purchases a customer never authorized.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint uses service role to insert/upsert orders and order_items records and trigger bank financing requests without verifying caller identity.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_80694480687b8731

unresolved · supabase/functions/ticket-sync-alert/index.ts

Ursache: Anyone can make your business send internal ticket-sync alerts, so staff may receive misleading messages that waste time and undermine trust.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint triggers outbound email dispatches via the external Resend API.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_80f949ebfeee1886

unresolved · supabase/functions/finance-reminder-engine/index.ts

Ursache: The tenant helper makes a user with no access rows unrestricted, causing this service-role handler to omit its tenant filter and create reminders from every matching account.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts reminders and reminder items into durable database tables across all tenants.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_840f31fb29294dc7

unresolved · supabase/functions/sms-config-test/index.ts

Ursache: The test action lets the requester choose both the SMS recipient and message content without a server-chosen bound.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Invokes external paid Twilio API to dispatch an SMS message with arbitrary caller-controlled body to an arbitrary phone number.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86d0bf0477028299

unresolved · supabase/functions/finance-ch-dd-export/index.ts

Ursache: The endpoint only checks the Authorization header prefix; it never validates the token before reading runs and mandate data with the service-role client.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Directly returns XML containing customer bank account details read from the database using service-role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_86d3d8b71cfd055f

unresolved · supabase/functions/collect-payment-link/index.ts

Ursache: Any finance user can create payment links for other tenants’ cases, so customers may receive unauthorized payment requests.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged service role client creates collect_payment_links entries for arbitrary caller-chosen case_id across tenants.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8703f96241dee35e_4db211d4

unresolved · supabase/functions/sync-to-alixsmart/index.ts

Ursache: The service-role query uses a caller-supplied ticket ID after checking only that the caller signed in; the handler has no role or resource-ownership binding.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Service-role query fetches caller-selected ticket and pushes ticket data to external endpoint, updating last_outbound_sync_at and sync logs.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8703f96241dee35e_aec296a4

unresolved · supabase/functions/sync-to-alixsmart/index.ts

Ursache: Any signed-in user can send another customer's ticket details to an external system, so private support conversations may be disclosed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler queries any caller-specified ticket using the service role and sends external HTTP requests to AlixSmart, as well as updating last_outbound_sync_at in tickets.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_88ebf49df7bfdf53

unresolved · supabase/functions/rz-reminder-send/index.ts

Ursache: Any signed-in user can send payment reminders to customers, so customers may receive unsolicited or mistimed payment notices.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Dispatches external reminder emails to customers via send-invoice-mail and updates reminder statuses in rz_reminders using service-role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8ac8ea7d48393f28

unresolved · supabase/functions/ac-journey-run/index.ts

Ursache: Anyone can enroll another customer in an automated journey, so that customer may receive unauthorized messages or have their records changed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts a new journey run record into public.ac_journey_runs and executes journey actions (sending emails, SMS, WhatsApp messages, or webhooks).

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8b2f741253363b3f

unresolved · supabase/functions/pdf-order-commit/index.ts

Ursache: The handler trusts customer_choice.id and inserts an offer with service credentials without checking that the caller may use that customer.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged admin client inserts a new offer row linked to caller-chosen customerId in the durable database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_8d76058b0444465c

unresolved · supabase/functions/finance-automations-engine/index.ts

Ursache: Anyone can run automations against invoices, reminders, and anomaly records, so financial workflows and private business records can be changed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Writes run history records into finance_automation_runs and updates finance_automations.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_94ff829ba690f3f3

unresolved · supabase/functions/bank-auto-reconcile/index.ts

Ursache: Anyone can run bank reconciliation, so private bank transactions and invoice balances can be exposed or changed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The edge function mutates bank transaction matching scores and allocations without verifying caller credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_951b00a22a7089dc

unresolved · supabase/functions/as-workflows-run/index.ts

Ursache: Anyone can invoke this route without a credential; it uses the service role to read cases and checklists whose direct access is limited to role-authorized users.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The unauthenticated endpoint triggers outbound reminder emails via as-send-email-reminder and updates database cases and timeline events using service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_98ce69bedfbee8e0

unresolved · supabase/functions/esc-calendar-sync/index.ts

Ursache: The unauthenticated request can choose a user_id (or omit it to process all active connections), after which the handler posts assigned events to the corresponding connected Microsoft calendar.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler makes external HTTP POST requests to the Microsoft Graph API (/me/events) using refreshed user OAuth tokens, modifying external calendars without authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9a2e7a4d1dc3c9a6 [PRODUCT HUB]

unresolved · supabase/functions/product-hub-validate/index.ts

Ursache: Anyone can run the product hub validation handler to inspect unpublished product details, technical specifications, and internal validation reports.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler queries ph_products and ph_documents using the service-role client and returns detailed product and document data in the HTTP response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_9e661ffc56acce39

unresolved · supabase/functions/ac-chat/index.ts

Ursache: Anyone with a public chat key can read another visitor’s messages, so customer discussions are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The poll action queries and returns messages directly from the durable ac_messages database table for the requested conversation.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a0a466e697d09e51

unresolved · supabase/functions/alixdocs-learn-rules/index.ts

Ursache: Anyone can rewrite shared matching rules, so document classification can be changed for every user.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function performs durable inserts and updates to alixdocs_matching_rules using the service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a33d1e6c8240851c

unresolved · supabase/functions/ac-revenue-forecast/index.ts

Ursache: Anyone can view revenue trends and forecasts calculated from your sales records, so sensitive business performance is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint calculates and outputs revenue aggregations and forecasts directly read from the ac_revenue_attributions database table.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a344cf8be2820684

unresolved · supabase/functions/ac-journey-trigger/index.ts

Ursache: Anyone can enroll another customer in an automated journey, so that customer may receive unrequested messages and have journey records created for them.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts new rows into public.ac_journey_runs using the service role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_a6af40d2b040e4a1

unresolved · supabase/functions/ac-knowledge-rag/index.ts

Ursache: Anyone can retrieve private document summaries through knowledge search, putting customer and business information at risk.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: PostgREST query interpolation allows injection into document filter returning private document records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ad68a76e0a7dba39

unresolved · supabase/functions/sig-apply-facsimile/index.ts

Ursache: Anyone can put your company signature on a document they provide, so recipients may trust a forged approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The privileged client downloads the private signature asset and inserts a log into sig_facsimile_log, returning the signed PDF.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b0851d9805f11435

unresolved · src/components/AzInvoiceTab.tsx

Ursache: Anyone can guess a document link and read customer invoices, exposing private billing records.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The od-download function serves private customer invoices from durable storage without authentication when supplied with a matching token.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b4d04ac4e0a048bd

unresolved · supabase/functions/ac-missed-call-sms/index.ts

Ursache: Anyone can use another customer’s missed call to send a text to that caller, so customers may receive unauthorized messages.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends an external SMS via Twilio to the phone number associated with the specified call.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b4dbe8c9ecfd794e_659534c3

unresolved · supabase/functions/finance-camt054-import/index.ts

Ursache: Anyone can add unverified bank notifications and payment entries, so your financial records and reconciliation results can be falsified.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated requests write records directly to finance_camt054_notifications and finance_camt054_entries tables via service role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b4dbe8c9ecfd794e_7e264ad8

unresolved · supabase/functions/finance-camt054-import/index.ts

Ursache: Anyone can submit a fabricated Bearer value and import arbitrary bank notification data using the service-role client.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can insert arbitrary bank notification records and entries into the database via the service-role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b59f50206d13ea0b

unresolved · supabase/functions/send-customer-sms/index.ts

Ursache: Any signed-in service user can send a custom text to an arbitrary phone number, so people can receive unwanted messages and document links from your business.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The endpoint performs an external HTTP POST to the Twilio Messages API, sending an outbound SMS with caller-supplied recipient phone number and custom message body to third parties.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b740221af1bd20a5

unresolved · supabase/functions/finance-sepa-export/index.ts

Ursache: Any signed-in user can export customer debit instructions, so sensitive bank details can leave your finance workflow.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The edge function updates status to 'exportiert' on finance_sepa_runs and items using admin privileges without checking the caller's role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_b98203874ed68dbf

unresolved · supabase/functions/alixdocs-sign-return/index.ts

Ursache: The handler accepts a caller-supplied signature request ID and uses service-role credentials without verifying a user, provider signature, or scoped capability.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates document status to freigegeben, writes storage files, versions, and audit log entries using service_role credentials.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_baa5414ce6fda013

unresolved · supabase/functions/orders-inbox-process/index.ts

Ursache: Anyone can process queued customer orders, so imports may create or change orders without an authorized reviewer.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Processes queued inbox orders, inserting rows into orders and order_items and updating orders_inbox state.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bb420b3953e6ab20

unresolved · supabase/functions/ac-health-score/index.ts

Ursache: The request has no authentication check; a caller can trigger service-role reads of customer orders, unpaid balances, message history, and contact sentiment, followed by score upserts.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Upserts computed health scores, lifecycle stages, and aggregate factors into ac_customer_health using service_role credentials without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_bf2b6a2d007ce4fc

unresolved · supabase/functions/ac-journey-optimize/index.ts

Ursache: Anyone can inspect another organization’s journey performance and setup, so private customer-program data is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Database queries for ac_journeys, ac_journey_steps, and ac_journey_runs use privileged service_role credentials and caller-specified journey_id without binding to caller identity.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c1970a6abcb44913

unresolved · supabase/functions/finance-bank-import/index.ts

Ursache: Anyone can view bank statement details or add banking activity to your records, so financial information and reconciliation data are not protected.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts and updates financial bank statements and transaction lines into durable storage using the service role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c26f3c6f2ff20f41

unresolved · supabase/functions/finance-datev-export/index.ts

Ursache: Anyone can download customer-linked transaction details, so confidential accounting activity is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Reads transactions and customer details from finance_transactions and returns them as CSV.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c3d615c0a49c15fb

unresolved · supabase/functions/finance-ch-dd-export/index.ts

Ursache: Anyone can export customer debit instructions, so sensitive bank details can leave your finance workflow.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates the status and metadata of finance_ch_dd_runs and finance_ch_dd_run_items in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c45c9cbb478d7312

unresolved · supabase/functions/mediapaket-portal/index.ts

Ursache: Anyone can send a status notification email to any customer by providing their package ID, while other server functions require sign-in.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends outbound emails to customer addresses via the send-mail service using service role credentials without requiring authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_c79ad01cbeb6bd2e

unresolved · supabase/functions/alixdocs-hash-backfill/index.ts

Ursache: Anyone can change stored document integrity records, so altered files may no longer be detected reliably.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can trigger batch recalculation and update of document hashes in alixdocs_documents.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cac3d0218bcb0bbb

unresolved · supabase/functions/sync-finance-deposits/index.ts

Ursache: Anyone can refresh financial deposit totals and trigger recalculations, so your finance records and reports can be changed without permission.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Upserts deposit rows into finance_deposits and invokes finance_deposit_recalc to recalculate deposit statuses in database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cc69b9a46e5b7c7e

unresolved · supabase/functions/ac-playbook-run/index.ts

Ursache: Anyone can invoke a background playbook runner that queries private customer health and contact records without authenticating.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Background playbook runner queries customer health and contact records, triggering external communications and inserting lifecycle run records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cd2ce2ad522f11c1

unresolved · supabase/functions/sig-create-request/index.ts

Ursache: An authorized sender controls the signer address and several invitation details; the handler sends an Alix-branded signature email to that chosen recipient without a server-selected recipient bound.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends transactional signature invitation emails via external email service to arbitrary recipient addresses supplied by the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d51da742f6515a44

unresolved · supabase/functions/send-review-invitation/index.ts

Ursache: The authenticated caller supplies order_id, but the service-role queries do not verify that the caller may access that order or its review.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler queries the durable orders and reviews tables with service-role privileges and returns the review URL and token in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d56fcb31625300b3

unresolved · supabase/functions/ac-call-ai-process/index.ts

Ursache: Anyone can retrieve private call transcripts through call processing, so recorded customer conversations are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The handler mutates ac_calls records in durable storage and returns transcripts of customer conversations directly in the response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d599eb858f23ab35_c16d2b6f

unresolved · supabase/functions/finance-sepa-export/index.ts

Ursache: Any signed-in user can download another account's bank details and payment mandates, so sensitive financial information is exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged query reads finance_sepa_runs and mandate details without verifying caller's ownership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d599eb858f23ab35_e1c9b149

unresolved · supabase/functions/finance-sepa-export/index.ts

Ursache: Any signed-in user can export another company's payment details, so bank account information and collection totals are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged client reads finance_sepa_runs and associated items, returning bank details in response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d76d8adca9d2e204

unresolved · supabase/functions/finance-management-pack/index.ts

Ursache: Anyone can change the status and recipient list for confidential management reports, so your reporting history can be falsified.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: An unauthenticated caller can update status, sent_at, and sent_to on arbitrary finance_management_packs rows using the service role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d788ed2671203a5e

unresolved · supabase/functions/as-send-sms-reminder/index.ts

Ursache: Any signed-in user can text another team's case details to any phone number, so private customer information can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Fetches external Twilio API to send SMS containing case details and writes timeline/reminder records using admin client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d827e70493abbc17

unresolved · supabase/functions/finance-compliance-report/index.ts

Ursache: The endpoint verifies sign-in but does not check the Admin or Read Only Audit role before using service-role access to export audit logs.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Service-role client queries audit_logs and returns durable audit records containing user activity and financial details in a CSV response.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d86e3d3e3deb87d6

unresolved · supabase/functions/esc-send-message/index.ts

Ursache: Anyone can send custom messages from your business to arbitrary email addresses or phone numbers, so recipients can receive unwanted messages in your name.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated callers can trigger outbound messages to arbitrary destinations with arbitrary text via Twilio.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d9dbde1372d10aa0_2fd2e69b

unresolved · supabase/functions/credit-score-calculate/index.ts

Ursache: Anyone can submit an assessment ID; the handler uses service-role credentials to read the assessment and related customer records without verifying a caller.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Assessment data and customer records read from durable storage are evaluated and returned in the direct response without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_d9dbde1372d10aa0_da1f1b29

unresolved · supabase/functions/credit-score-calculate/index.ts

Ursache: Anyone can trigger this handler to read assessment and customer data and receive a score without presenting a credential.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Direct response exposes calculated credit assessment fields read from private customer records.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dae991b95413b3dd

unresolved · supabase/functions/ac-omnichannel-merge/index.ts

Ursache: Anyone can merge customer records and delete duplicates, so customer histories may be altered or lost.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Handler updates ac_messages, ac_calls, and permanently deletes ac_contacts rows using service_role.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_db88ec831c2a1cc7

unresolved · src/pages/Katalog/PdfTemplates.tsx

Ursache: Any catalog editor can run scripts when coworkers preview shared catalog templates, so their accounts and business data can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unsanitized HTML from catalog_pdf_templates and catalog items is assigned directly to container.innerHTML and attached to document.body, executing arbitrary script in the browser.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_dbd4ea3dfc6fc0db

unresolved · supabase/functions/alixdocs-upload/index.ts

Ursache: Any signed-in user can upload a new version of another user's document, so confidential records can be changed without permission.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged storage upload writes a new file version under the caller-selected existing document ID.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_de727ed9fb3a3be4

unresolved · supabase/functions/cmr-bank-automatch/index.ts

Ursache: Anyone can run bank matching, so private payment records can be exposed and linked to the wrong customer invoices.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Unauthenticated invocation executes bank line queries and causes durable writes to cmr_payments and cmr_bank_lines.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_df054ee0d6a3c45f

unresolved · supabase/functions/ac-voicemail-transcribe/index.ts

Ursache: Anyone can request transcription of a stored voicemail and receive its transcript, so private call messages can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Fetches the call recording, transcribes it, updates the database, and returns the transcript.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e0f5db0abd0fbc9a

unresolved · supabase/functions/cmr-portal-invite/index.ts

Ursache: An allowed CMR-role user can use a caller-supplied token ID to read a portal token and change its email without a tenant or customer authorization check.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Privileged lookup fetches un-scoped cmr_portal_tokens row by caller-controlled tokenId, emails portalUrl to arbitrary recipient, and mutates customer_email.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e41206eaf4d35d0e

unresolved · supabase/functions/social-showcase-public/index.ts

Ursache: Anyone can turn on another client's public showcase, so private business details and posts may be exposed without permission.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: writeCfg updates or inserts app_settings with the client's public showcase token and status.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e82b9976fc58ba0b

unresolved · supabase/functions/delivery-route-calc/index.ts

Ursache: Any signed-in user can recalculate another team's delivery routes, so scheduled stops and arrival times can be changed without approval.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates delivery_tours records in durable database storage using privileged service_role client.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_e90b7b2049e0b2bb

unresolved · supabase/functions/ac-journey-optimize/index.ts

Ursache: Anyone can select a journey and cause its data to be sent to a metered AI gateway, then receive the result, without signing in.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: An unauthenticated visitor can trigger outbound requests to metered external AI gateway https://ai.gateway.lovable.dev/v1/chat/completions and receive the generated result while other functions require sign-in.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ec3de0a630ccb72f_3f6f0b90

unresolved · supabase/functions/ticket-ai-assist/index.ts

Ursache: Any signed-in user can use ticket assistance to view another customer's support history, so confidential support details are exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Exposes ticket details and customer communication from the durable tickets table using the service_role key.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ef43972ba6ab93b7_47ca5b03

unresolved · supabase/functions/ac-outreach-engine/index.ts

Ursache: The endpoint uses a service-role client without authenticating its caller, reads admin-only outreach triggers and customer records, and inserts queued outreach runs.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Directly queries ac_outreach_triggers from the durable database using service role credentials without caller authentication.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ef43972ba6ab93b7_81382866

unresolved · supabase/functions/ac-outreach-engine/index.ts

Ursache: Anyone can queue messages to your customers, so they may receive unapproved contact and your business may incur messaging costs.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Inserts queued outreach run records into ac_outreach_runs table in the database.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_ef8daa497c253e85

unresolved · supabase/functions/alixdocs-mail-import/index.ts

Ursache: Any signed-in user can copy another user's mail attachment into their own documents, so private correspondence may be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The privileged client downloads an arbitrary attachment file by ID and writes it into the private AlixDocs bucket and database under caller ownership.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f04bfe8a3011dee3

unresolved · supabase/functions/ac-voice-ai-studio/index.ts

Ursache: Anyone can use another customer's contact details to generate a call script, so private customer information may be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Private customer contact details are queried via service role using arbitrary contact_id and reflected in the response/payload.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f0b428fcfe8c9417_0b92b853

unresolved · supabase/functions/email-selftest/index.ts

Ursache: Anyone can send test emails from your business to arbitrary addresses, so recipients can receive unwanted messages using your service.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Anyone can trigger outbound emails via Lovable Email to an arbitrary caller-provided destination address using company branding.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f0b428fcfe8c9417_dad9f717

unresolved · supabase/functions/email-selftest/index.ts

Ursache: The endpoint accepts unauthenticated requests and uses any format-valid body.to address as the recipient for a company-branded email.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Anyone can trigger outbound emails via Resend to an arbitrary caller-provided destination address using company branding.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_f257ec154dcb5f8f

unresolved · supabase/functions/zoho-invoices-auto-import/index.ts

Ursache: Requests without a bearer token bypass the user-role branch and continue to fetch private invoice data.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: The function reads protected zoho_invoices records using service role and returns invoice diffs and customer details in the response to unauthenticated callers.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_fa76ad0c8151f87b

unresolved · supabase/functions/collect-send-dunning/index.ts

Ursache: Any finance user can send payment demands for another tenant’s cases, so customers may face unauthorized collection notices.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Sends payment demand emails and updates collect_cases and collect_events using privileged service_role client across tenant boundaries.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_fddb348892872591

unresolved · supabase/functions/bank-return-dunning-escalate/index.ts

Ursache: Anyone can run the bank-return reminder job, so customers can receive unauthorized payment demands and confidential account details can be exposed.

Erwartete Änderung: Aufruferberechtigung und Datensatz-/Mandantengrenze für die konkret benannte Operation prüfen; nur nach separater Freigabe korrigieren.

Auswirkung auf bestehende Funktionen: Updates bank_return_debits state and inserts audit log entries for dunning escalations.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## SCC-FINAL-001 [PRODUCT HUB]

confirmed · public.security_audit_findings

Ursache: Policy sec_find_manage_super verwendet has_role('Super Admin'); aktuelle has_role-Definition akzeptiert auch Admin. Kein Unveränderlichkeitstrigger auf dieser Tabelle, nur updated_at.

Erwartete Änderung: Freigabedatensätze mit exakter aktiver Super-Admin-Policy und separatem unveränderlichem Freigabenachweis schützen; vorhandene Tabelle und revisionsgebundenen Handler verwenden.

Auswirkung auf bestehende Funktionen: Revisionsgebundene Freigabeeinträge können außerhalb des geschützten Handlers verändert werden; der eigentliche WORM-Auditauftrag bleibt unveränderlich. Keine Ausführung eines Korrekturpakets durch diese Änderung allein.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Manuell bestätigter Schutzmangel; kein automatisch ausgeführtes Korrekturpaket.

## SCC-FINAL-002 [PRODUCT HUB]

confirmed · public.security_policy_details / public.security_audit_findings

Ursache: security_policy_details hat SELECT für anon/authenticated und liest pg_policy ohne eigenen Rollenfilter; security_audit_findings erlaubt Admin-Lesen über is_admin(). Geschützte control_overview-Berichte bleiben separat nur für aktive Super Admins abrufbar.

Erwartete Änderung: Bestehende Sicherheitsviews/Tabellen einzeln auf genaue aktive Super-Admin-Leserechte begrenzen; vorher abhängige Reports prüfen.

Auswirkung auf bestehende Funktionen: Direkte Tabellen-/View-Zugriffe umgehen die Sichtbarkeit des Super-Admin-Menüs; vollständiger Schutz aller bestehenden Sicherheitsansichten ist nicht bestanden.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Manuell bestätigter Schutzmangel; kein automatisch ausgeführtes Korrekturpaket.

## SCC-FINAL-003

confirmed · supabase/functions/security-remediate/index.ts

Ursache: requireSuperAdmin prüft Identität und exakte zugewiesene Rolle; aktive Kontoprüfung erfolgt nur im Zweig control_overview/control_approve, nicht für ältere Aktionen.

Erwartete Änderung: Aktive Kontoprüfung an der bestehenden zentralen Autorisierungsstelle für alle Verwaltungsaktionen anwenden.

Auswirkung auf bestehende Funktionen: Ein deaktiviertes Konto mit noch gültigem Token und Super-Admin-Zuweisung wird bei älteren Verwaltungsaktionen nicht vollständig geprüft.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Manuell bestätigter Schutzmangel; kein automatisch ausgeführtes Korrekturpaket.

