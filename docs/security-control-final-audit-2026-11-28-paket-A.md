# Paket A – Kritische Risiken

Nur vorbereitet, nicht ausgeführt. Keine gemeinsame automatische Freigabe; ursprüngliche revisionsgebundene Einzel-/Komponentenfreigabe bleibt bestehen. Ungeklärte Risiken sind Prüfaufträge, keine bestätigten Schwachstellen.

## lov_finding_209ac9df0e293f49 [PRODUCT HUB]

unresolved · supabase/functions/ph-com-lang-push/index.ts

Ursache: The handler accepts an unauthenticated request and lets the caller select the probe action and payload.

Erwartete Änderung: Bestehende Legacy-Sperre erhalten; zusätzlich exakte aktive Super-Admin-/Mandantenprüfung vor privilegierten Aufrufen, erlaubte Zielpfade/Methoden und vorhandene Release-Regeln erzwingen.

Auswirkung auf bestehende Funktionen: The unauthenticated probe action sends arbitrary caller-supplied JSON payloads in a PATCH request to the remote alix-lasers.com API with the server's COM_PRODUCT_HUB_WRITE_KEY.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Fehlende Aufruferauthentifizierung im Quellcode bestätigt; bestehende controlled_modes-Sperre beendet den Handler aktuell VOR der beanstandeten Operation. Daher keine aktuelle externe Ausführung behauptet. Risiko bei späterer Aufhebung ungeklärt und freigabeblockierend.

## lov_finding_38dc846b77303b8b

unresolved · supabase/functions/finance-bank-import/index.ts

Ursache: A caller supplies statement content; its purpose/end-to-end reference is parsed into QR references and used to select finance_qr_invoices by reference and amount, without binding the matched invoice to the caller.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Updating finance_qr_invoices to status 'bezahlt' and setting paid_at modifies invoice state in the durable store via the service role client.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6a796ab89ffc66d5

unresolved · supabase/functions/ac-customer-intel/index.ts

Ursache: Anyone on the internet can submit a contact_id; the function reads it without checking identity or contact ownership.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Private customer records, messages, and calls are read using the service role and posted to Lovable AI.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_6bdc45abf053d23e [PRODUCT HUB]

confirmed · supabase/functions/product-hub-import/index.ts

Ursache: An internet visitor can invoke the public function and submit products in the request body; the code parses the body without authenticating the user or checking a privileged role.

Erwartete Änderung: Bestehenden Import vor jedem Quellenabruf mit exakter aktiver Super-Admin-/Mandantenprüfung schützen; fest erlaubte Quelle und redirect-freier Abruf; keine fremden Status-, Kanal- oder Schutzfelder übernehmen.

Auswirkung auf bestehende Funktionen: Durable insert into public.ph_products using service-role credentials without checking caller role.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Quellcode manuell bestätigt: Deno.serve ab Zeile 129 erstellt privilegierten Client vor Aufruferprüfung; body.endpoint/source_url steuert fetchSource (Zeilen 119–124/137), INSERT/UPDATE importiert ohne Identitäts-/Rollenprüfung. Keine schreibende Ausnutzungsprobe ausgeführt.

## lov_finding_a75e27ec4d54559d [PRODUCT HUB]

confirmed · supabase/functions/product-hub-import/index.ts

Ursache: The handler accepts request JSON directly and constructs a service-role Supabase client without verifying a caller credential; request-supplied products become the import list.

Erwartete Änderung: Bestehenden Import vor jedem Quellenabruf mit exakter aktiver Super-Admin-/Mandantenprüfung schützen; fest erlaubte Quelle und redirect-freier Abruf; keine fremden Status-, Kanal- oder Schutzfelder übernehmen.

Auswirkung auf bestehende Funktionen: Caller can supply payload that executes service-role update on existing ph_products rows, modifying durable catalog records.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Quellcode manuell bestätigt: Deno.serve ab Zeile 129 erstellt privilegierten Client vor Aufruferprüfung; body.endpoint/source_url steuert fetchSource (Zeilen 119–124/137), INSERT/UPDATE importiert ohne Identitäts-/Rollenprüfung. Keine schreibende Ausnutzungsprobe ausgeführt.

## lov_finding_c5b0e3d6a8f2e774

unresolved · supabase/functions/finance-datev-export/index.ts

Ursache: A request passes the only in-function credential check by supplying any value beginning with Bearer, then chooses the export date range and accounting region.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: The handler queries the finance_transactions table with service_role privileges and exports confidential customer transaction records.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## lov_finding_cd621b68583af549 [PRODUCT HUB]

unresolved · supabase/functions/ph-com-lang-push/index.ts

Ursache: Anyone on the internet can submit a request to the route; no caller credential is checked before it creates a privileged client and processes the request.

Erwartete Änderung: Bestehende Legacy-Sperre erhalten; zusätzlich exakte aktive Super-Admin-/Mandantenprüfung vor privilegierten Aufrufen, erlaubte Zielpfade/Methoden und vorhandene Release-Regeln erzwingen.

Auswirkung auf bestehende Funktionen: The function invokes an external HTTP PATCH mutation on the alix-lasers.com API without authenticating the incoming request.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Fehlende Aufruferauthentifizierung im Quellcode bestätigt; bestehende controlled_modes-Sperre beendet den Handler aktuell VOR der beanstandeten Operation. Daher keine aktuelle externe Ausführung behauptet. Risiko bei späterer Aufhebung ungeklärt und freigabeblockierend.

## lov_finding_dee2f25deaa8bfd7 [PRODUCT HUB]

unresolved · supabase/functions/ph-com-registry-push/index.ts

Ursache: The handler accepts requests without authentication and parses action, path, method, and payload from the request body.

Erwartete Änderung: Bestehende Legacy-Sperre erhalten; zusätzlich exakte aktive Super-Admin-/Mandantenprüfung vor privilegierten Aufrufen, erlaubte Zielpfade/Methoden und vorhandene Release-Regeln erzwingen.

Auswirkung auf bestehende Funktionen: Unauthenticated requests execute outbound HTTP requests with the COM write key to caller-selected paths, methods, and payloads.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Fehlende Aufruferauthentifizierung im Quellcode bestätigt; bestehende controlled_modes-Sperre beendet den Handler aktuell VOR der beanstandeten Operation. Daher keine aktuelle externe Ausführung behauptet. Risiko bei späterer Aufhebung ungeklärt und freigabeblockierend.

## lov_finding_f52df2ed4cbca9d2

unresolved · Super Admin offboarding

Ursache: An offboarded Super Admin can keep using an authenticated session: offboard_user preserves the Super Admin assignment while setting the profile inactive, and public.has_role uses auth.uid() to evaluate the retained role without checking the inactive profile state.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Offboarded users who held Super Admin role retain their Super Admin user_roles record, allowing continued DELETE operations on public.bugs.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Im Tiefenscan vom 2026-11-28T04:14:20.068253158Z erneut vorhanden. Aktuelle Quelldateien separat gelesen und gehasht; negative/positive Rollen- und Mandanten-Ende-zu-Ende-Abnahme fehlt. Keine automatisch bestätigte Ausnutzbarkeit.

## db:authenticated:public.has_role(check_role text) [PRODUCT HUB]

confirmed · public.has_role(check_role text)

Ursache: Manuell geprüft: Admin erbt Super Admin; Product-Hub-DELETE-Policies nutzen diese Prüfung und erlauben dadurch Admin-Löschung.

Erwartete Änderung: Nach separater Freigabe Rollenvererbung entfernen bzw. betroffene privilegierte Policies auf exakte aktive Super-Admin-Prüfung umstellen; alle vorhandenen Fachrollen und Aufrufer einzeln prüfen.

Auswirkung auf bestehende Funktionen: Aktive Admins können durch Rollenvererbung als Super Admin gelten; davon abhängige Product-Hub-Löschregeln sind zu breit. Aktive exakte Release-Control-Aufruferprüfung bleibt unabhängig geschützt.

Abhängigkeiten: Alle bestehenden has_role-Aufrufer und Rollenvererbungen; Product-Hub-Löschregeln, Kontensperre und bestehende Release-Control-Prüfungen

Tests: Aktiver Admin darf keine Super-Admin-Product-Hub-Aktion ausführen; Inaktiver Super Admin mit synthetischem Resttoken bleibt gesperrt; Fachrollen behalten ihre zulässigen Zugriffe; Notstopp und Pilotgrenzen unverändert

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Aktuelle Definition manuell geprüft: (check_role = 'Super Admin' and r.name = 'Admin'). Admin erbt damit Super-Admin-Prüfungen. Die exakte ph2_release_admin-Fassade bleibt davon getrennt.

## lov_finding_7596267ca3ddaaea [PRODUCT HUB]

confirmed · supabase/functions/product-hub-import/index.ts

Ursache: The handler creates a service-role client and performs catalog reads and writes without authenticating the request.

Erwartete Änderung: Bestehenden Import vor jedem Quellenabruf mit exakter aktiver Super-Admin-/Mandantenprüfung schützen; fest erlaubte Quelle und redirect-freier Abruf; keine fremden Status-, Kanal- oder Schutzfelder übernehmen.

Auswirkung auf bestehende Funktionen: The handler reads catalog data from ph_products using service-role credentials and returns responses without authenticating the caller.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Quellcode manuell bestätigt: Deno.serve ab Zeile 129 erstellt privilegierten Client vor Aufruferprüfung; body.endpoint/source_url steuert fetchSource (Zeilen 119–124/137), INSERT/UPDATE importiert ohne Identitäts-/Rollenprüfung. Keine schreibende Ausnutzungsprobe ausgeführt.

## lov_finding_9fcacb28cc4c5d46 [PRODUCT HUB]

confirmed · supabase/functions/product-hub-import/index.ts

Ursache: Anyone can call the handler with endpoint or source_url. fetchSource sends the configured source API key to that URL without an origin restriction.

Erwartete Änderung: Bestehenden Import vor jedem Quellenabruf mit exakter aktiver Super-Admin-/Mandantenprüfung schützen; fest erlaubte Quelle und redirect-freier Abruf; keine fremden Status-, Kanal- oder Schutzfelder übernehmen.

Auswirkung auf bestehende Funktionen: fetchSource sends an outbound HTTP request with the internal DE_EXPORT_API_KEY header to an untrusted requester-supplied URL.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Quellcode manuell bestätigt: Deno.serve ab Zeile 129 erstellt privilegierten Client vor Aufruferprüfung; body.endpoint/source_url steuert fetchSource (Zeilen 119–124/137), INSERT/UPDATE importiert ohne Identitäts-/Rollenprüfung. Keine schreibende Ausnutzungsprobe ausgeführt.

## lov_finding_bdfe7bcb586d9539 [PRODUCT HUB]

duplicate · supabase/functions/product-hub-import/index.ts

Ursache: Anyone can create product records without an admin role, so unapproved catalog entries can enter your product hub.

Erwartete Änderung: Bestehenden Import vor jedem Quellenabruf mit exakter aktiver Super-Admin-/Mandantenprüfung schützen; fest erlaubte Quelle und redirect-freier Abruf; keine fremden Status-, Kanal- oder Schutzfelder übernehmen.

Auswirkung auf bestehende Funktionen: Durable insertion into ph_products catalog table using service role credentials without caller role check.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Quellcode manuell bestätigt: Deno.serve ab Zeile 129 erstellt privilegierten Client vor Aufruferprüfung; body.endpoint/source_url steuert fetchSource (Zeilen 119–124/137), INSERT/UPDATE importiert ohne Identitäts-/Rollenprüfung. Keine schreibende Ausnutzungsprobe ausgeführt. Manuell gleicher Einstieg, dieselbe Datenoperation und dieselbe Komponente wie lov_finding_6bdc45abf053d23e.

