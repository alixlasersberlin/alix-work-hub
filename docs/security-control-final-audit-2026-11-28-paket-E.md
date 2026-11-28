# Paket E – Technische Optimierungen

Nur vorbereitet, nicht ausgeführt. Keine gemeinsame automatische Freigabe; ursprüngliche revisionsgebundene Einzel-/Komponentenfreigabe bleibt bestehen. Ungeklärte Risiken sind Prüfaufträge, keine bestätigten Schwachstellen.

## db:anon:public.ph_catalog_public(_catalog_id uuid) [PRODUCT HUB]

unresolved · public.ph_catalog_public(_catalog_id uuid)

Ursache: Manuell geprüft: liefert ausschließlich öffentliche Katalog-Statusentscheidung, keine Produktdaten.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Aufruf ohne Anmeldung möglich; interne Prüfungen, Grants und reale Datenwirkung müssen separat bewertet werden.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ac_kb_snapshot_version()

unresolved · public.ac_kb_snapshot_version()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ac_trigger_missed_call_sms()

unresolved · public.ac_trigger_missed_call_sms()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.alixdocs_feedback_autolearn()

unresolved · public.alixdocs_feedback_autolearn()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.alixdocs_guard_delete()

unresolved · public.alixdocs_guard_delete()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs_guard_release()

unresolved · public.alixdocs_guard_release()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.alixdocs_set_retention()

unresolved · public.alixdocs_set_retention()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.apply_consumption_stock()

unresolved · public.apply_consumption_stock()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.apply_goods_receipt_stock()

unresolved · public.apply_goods_receipt_stock()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.as_on_order_status_change()

unresolved · public.as_on_order_status_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.asm_device_set_tenant()

unresolved · public.asm_device_set_tenant()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.assign_bank_import_number()

unresolved · public.assign_bank_import_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.assign_ch_dd_run_number()

unresolved · public.assign_ch_dd_run_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.assign_delivery_return_number()

unresolved · public.assign_delivery_return_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.audit_capture_changes()

unresolved · public.audit_capture_changes()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.audit_trigger_fn()

unresolved · public.audit_trigger_fn()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.camt054_match_entry()

unresolved · public.camt054_match_entry()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.catalog_inq_set_number()

unresolved · public.catalog_inq_set_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.catalog_log_change()

unresolved · public.catalog_log_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.catalog_track_edit()

unresolved · public.catalog_track_edit()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.check_user_profile_self_update()

unresolved · public.check_user_profile_self_update()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.classify_ticket()

unresolved · public.classify_ticket()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.clear_lager_reservation_on_delivery()

unresolved · public.clear_lager_reservation_on_delivery()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.cmr_sync_paid_total()

unresolved · public.cmr_sync_paid_total()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.collect_invoice_realtime_sync()

unresolved · public.collect_invoice_realtime_sync()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.commission_log_status()

unresolved · public.commission_log_status()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.copilot_audit_trigger_fn()

unresolved · public.copilot_audit_trigger_fn()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.cpt_guard_portal_updates()

unresolved · public.cpt_guard_portal_updates()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.create_invoice_approval()

unresolved · public.create_invoice_approval()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.customer_portal_tickets_guard_fields()

unresolved · public.customer_portal_tickets_guard_fields()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Kundentokens und Datensatzbindung erhalten; pro Abschnitt ausschließlich erlaubte Felder übernehmen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Tokenausstellung und Portaloberfläche; Spaltenrechte je Portalabschnitt

Tests: Fremde Kundentokens und geschützte Felder abweisen; Gültige Kundenänderungen mit isolierten Testdatensätzen; Keine tatsächliche Kundenbenachrichtigung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.delivery_appointment_status_log()

unresolved · public.delivery_appointment_status_log()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.delivery_sync_ratenstart()

unresolved · public.delivery_sync_ratenstart()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.delivery_tour_status_log()

unresolved · public.delivery_tour_status_log()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.enforce_period_lock()

unresolved · public.enforce_period_lock()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.enforce_role_delegation()

unresolved · public.enforce_role_delegation()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.enforce_sod_on_user_roles()

unresolved · public.enforce_sod_on_user_roles()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.enforce_supplier_production_order_immutability()

unresolved · public.enforce_supplier_production_order_immutability()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.enforce_year_end_lock()

unresolved · public.enforce_year_end_lock()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_audit_trigger()

unresolved · public.esc_audit_trigger()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_events_set_tenant()

unresolved · public.esc_events_set_tenant()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.esc_events_sync_to_ticket()

unresolved · public.esc_events_sync_to_ticket()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_public_bookings_rate_limit()

unresolved · public.esc_public_bookings_rate_limit()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.esc_store_appointments_audit()

unresolved · public.esc_store_appointments_audit()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.esc_store_appt_to_events()

unresolved · public.esc_store_appt_to_events()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.esc_store_generic_audit()

unresolved · public.esc_store_generic_audit()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.fc_block_order_close()

unresolved · public.fc_block_order_close()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_case_autodraft()

unresolved · public.fc_case_autodraft()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_delivery_trigger()

unresolved · public.fc_delivery_trigger()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_invoice_trigger()

unresolved · public.fc_invoice_trigger()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_log_order_close()

unresolved · public.fc_log_order_close()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.fc_orders_trigger()

unresolved · public.fc_orders_trigger()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_repair_trigger()

unresolved · public.fc_repair_trigger()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.fc_set_task_defaults()

unresolved · public.fc_set_task_defaults()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_audit_trg_fn()

unresolved · public.finance_audit_trg_fn()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_deposit_bookings_after_change()

unresolved · public.finance_deposit_bookings_after_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_deposit_sync_invoice_paid()

unresolved · public.finance_deposit_sync_invoice_paid()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_history_trg_fn()

unresolved · public.finance_history_trg_fn()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.finance_inherit_accounting_region()

unresolved · public.finance_inherit_accounting_region()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_payroll_recalc()

unresolved · public.finance_payroll_recalc()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_set_region()

unresolved · public.finance_set_region()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_set_tenant()

unresolved · public.finance_set_tenant()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.finance_set_tenant_from_parent()

unresolved · public.finance_set_tenant_from_parent()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_backup_delete_audit()

unresolved · public.gobd_backup_delete_audit()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_block_delete()

unresolved · public.gobd_block_delete()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.gobd_doc_worm_guard()

unresolved · public.gobd_doc_worm_guard()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.gobd_no_delete_generic()

unresolved · public.gobd_no_delete_generic()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.guard_invoice_legal_number()

unresolved · public.guard_invoice_legal_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.license_assign_contract_number()

unresolved · public.license_assign_contract_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.license_assign_ic_number()

unresolved · public.license_assign_ic_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.license_assign_invoice_number()

unresolved · public.license_assign_invoice_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.license_assign_royalty_number()

unresolved · public.license_assign_royalty_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.log_catalog_price_change()

unresolved · public.log_catalog_price_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_delivery_eta_change()

unresolved · public.log_delivery_eta_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_mobile_config_change()

unresolved · public.log_mobile_config_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_order_status_change()

unresolved · public.log_order_status_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_repair_quote_change()

unresolved · public.log_repair_quote_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_repair_status_change()

unresolved · public.log_repair_status_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.log_user_role_change()

unresolved · public.log_user_role_change()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mail_audit_trigger_fn()

unresolved · public.mail_audit_trigger_fn()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.mail_messages_set_tenant()

unresolved · public.mail_messages_set_tenant()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.notify_order_change_request()

unresolved · public.notify_order_change_request()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.notify_order_change_request_reviewed()

unresolved · public.notify_order_change_request_reviewed()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.op_light_dunning_immutable()

unresolved · public.op_light_dunning_immutable()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.op_light_escalations_guard()

unresolved · public.op_light_escalations_guard()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.order_delivery_status_touch()

unresolved · public.order_delivery_status_touch()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ph_canary_snapshot_immutable() [PRODUCT HUB]

unresolved · public.ph_canary_snapshot_immutable()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ph_compliance_recheck() [PRODUCT HUB]

unresolved · public.ph_compliance_recheck()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.ph_log_price_changes() [PRODUCT HUB]

unresolved · public.ph_log_price_changes()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ph_log_product_changes() [PRODUCT HUB]

unresolved · public.ph_log_product_changes()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.ph_mark_translations_outdated() [PRODUCT HUB]

unresolved · public.ph_mark_translations_outdated()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Importzugang und Zieladressen absichern; bestehende Freigabesender und Nachweissperren erhalten.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Legitime Importaufrufer und bestätigte Quellhosts; Bestehende Kanalfreigaben und Sicherheitsnachweise

Tests: Ungültiger Aufrufer vor externem Abruf und Produktschreibzugriff abweisen; Fremde Zieladresse mit Testschlüssel ablehnen; Pilot, Notstopp und unveränderte 44 Geräte prüfen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.prevent_supplier_approval_escalation()

unresolved · public.prevent_supplier_approval_escalation()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.recert_auto_next()

unresolved · public.recert_auto_next()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.release_device_locks_on_payment()

unresolved · public.release_device_locks_on_payment()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.release_lager_device_on_repair_close()

unresolved · public.release_lager_device_on_repair_close()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.release_on_hold_or_lawyer()

unresolved · public.release_on_hold_or_lawyer()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.reserve_lager_device_on_po_approval()

unresolved · public.reserve_lager_device_on_po_approval()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sales_lead_after_insert()

unresolved · public.sales_lead_after_insert()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sales_leads_log_status()

unresolved · public.sales_leads_log_status()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.set_finance_records_tenant_id_from_order()

unresolved · public.set_finance_records_tenant_id_from_order()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_finance_reminder_customer_name()

unresolved · public.set_finance_reminder_customer_name()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_lager_in_produktion_on_send()

unresolved · public.set_lager_in_produktion_on_send()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_tenant_from_customer_col()

unresolved · public.set_tenant_from_customer_col()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_tenant_from_relation()

unresolved · public.set_tenant_from_relation()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_ticket_first_response()

unresolved · public.set_ticket_first_response()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_ticket_resolved_at()

unresolved · public.set_ticket_resolved_at()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_ticket_sla_deadlines()

unresolved · public.set_ticket_sla_deadlines()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_zoho_tenant_id_from_source_system()

unresolved · public.set_zoho_tenant_id_from_source_system()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.set_zoho_unpaid_tenant_id()

unresolved · public.set_zoho_unpaid_tenant_id()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.settle_deposit_on_order_ok()

unresolved · public.settle_deposit_on_order_ok()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sig_approval_notify_approver()

unresolved · public.sig_approval_notify_approver()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sig_audit_log_chain()

unresolved · public.sig_audit_log_chain()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sig_documents_validate_customer()

unresolved · public.sig_documents_validate_customer()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.sig_requests_apply_approval_chain()

unresolved · public.sig_requests_apply_approval_chain()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tg_ac_conv_automation()

unresolved · public.tg_ac_conv_automation()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tg_ac_messages_automation()

unresolved · public.tg_ac_messages_automation()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tg_alixdocs_approval_notify()

unresolved · public.tg_alixdocs_approval_notify()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tickets_assign_case_number()

unresolved · public.tickets_assign_case_number()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tickets_log_changes()

unresolved · public.tickets_log_changes()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.tickets_seed_customer_reminder()

unresolved · public.tickets_seed_customer_reminder()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tickets_sync_comm_status_on_close()

unresolved · public.tickets_sync_comm_status_on_close()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.tickets_update_comm_status_on_message()

unresolved · public.tickets_update_comm_status_on_message()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_alixdocs_sign_return()

unresolved · public.trg_alixdocs_sign_return()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_alixsmart_customer_link_created()

unresolved · public.trg_alixsmart_customer_link_created()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_alixsmart_device_link_updated()

unresolved · public.trg_alixsmart_device_link_updated()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_alixsmart_order_updated()

unresolved · public.trg_alixsmart_order_updated()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_alixsmart_ticket_reply()

unresolved · public.trg_alixsmart_ticket_reply()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_alixsmart_ticket_updated()

unresolved · public.trg_alixsmart_ticket_updated()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_audit_user_roles()

unresolved · public.trg_audit_user_roles()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.trg_bankpost_to_journal()

unresolved · public.trg_bankpost_to_journal()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_cashbook_to_journal()

unresolved · public.trg_cashbook_to_journal()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_device_maintenance_completed()

unresolved · public.trg_device_maintenance_completed()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dispatch_calendar_sync()

unresolved · public.trg_dispatch_calendar_sync()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dispatch_tour_calendar_sync()

unresolved · public.trg_dispatch_tour_calendar_sync()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_auto_warranty_maintenance()

unresolved · public.trg_dl_auto_warranty_maintenance()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_lager_reservation()

unresolved · public.trg_dl_lager_reservation()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_order_delivered()

unresolved · public.trg_dl_order_delivered()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_repair_order()

unresolved · public.trg_dl_repair_order()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_spare_part()

unresolved · public.trg_dl_spare_part()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_ticket()

unresolved · public.trg_dl_ticket()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_dl_update_health()

unresolved · public.trg_dl_update_health()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_notify_role_change_request()

unresolved · public.trg_notify_role_change_request()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_repair_notify_status()

unresolved · public.trg_repair_notify_status()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_sales_leads_restrict_assign()

unresolved · public.trg_sales_leads_restrict_assign()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Prüfreferenzen gefunden; deren semantische Wirksamkeit und Datensatzbindung nicht abschließend abgenommen.

## db:authenticated:public.trg_spare_part_notify_ordered()

unresolved · public.trg_spare_part_notify_ordered()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_ticket_notify_in_progress()

unresolved · public.trg_ticket_notify_in_progress()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_ticket_notify_received()

unresolved · public.trg_ticket_notify_received()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_ticket_notify_user_email()

unresolved · public.trg_ticket_notify_user_email()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_warranty_claim_to_lifecycle()

unresolved · public.trg_warranty_claim_to_lifecycle()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.trg_warranty_decision_lifecycle()

unresolved · public.trg_warranty_decision_lifecycle()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.validate_esc_public_booking()

unresolved · public.validate_esc_public_booking()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.validate_ticket_attachment()

unresolved · public.validate_ticket_attachment()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db:authenticated:public.zoho_invoice_sync_deposit_paid()

unresolved · public.zoho_invoice_sync_deposit_paid()

Ursache: Triggerfunktion: nicht direkt als gewöhnliche RPC ausführbar; Trigger-/Schreibpfad separat prüfen.

Erwartete Änderung: Identität, Fachrecht, Mandant und Buchungsregion vor Lese- oder Schreibzugriff prüfen; Fehler atomar behandeln.

Auswirkung auf bestehende Funktionen: Ausführbarkeit für angemeldete Nutzer allein beweist keinen Zugriff: interne Konten-, Rollen- und Mandantenprüfungen bleiben einzeln zu prüfen.

Abhängigkeiten: Buchhaltungsrollen und Mandantenbeziehung; Bestehende Beleg-, Saldo- und Dublettenschutzregeln

Tests: Ungültige Anmeldung und falsche Region abweisen; Rollenmatrix und getrennte Mandanten mit synthetischen Belegen; Dubletten, parallele Freigaben und Buchungsrollback in isolierter Umgebung

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Definition und tatsächliche EXECUTE-Rechte einzeln gelesen. Keine untersuchten Auth-/Rollenreferenzen erkannt; das allein bestätigt noch keine unberechtigte Datenwirkung.

## db::public.mfa_sms_codes

false_positive · public.mfa_sms_codes

Ursache: RLS aktiv ohne Policies: regulärer Zugriff wird verweigert, Service-Zugriff separat prüfen.

Erwartete Änderung: Inaktive Konten und exakte Super-Admin-Rechte getrennt prüfen; globale Rollenvererbung nur nach Abhängigkeitsanalyse ändern.

Auswirkung auf bestehende Funktionen: Konfigurationshinweis; kein bestätigter Datenverlust oder unberechtigter Zugriff aus dieser Meldung allein.

Abhängigkeiten: Rollenvererbung und sämtliche aufrufenden Richtlinien; Sitzungs-, Geräte- und Kontensperrregeln

Tests: Aktiver Admin versus Super Admin; Inaktive Benutzer mit weiter gültigem synthetischem Token; Rollen-, Lösch-, Storage- und Product-Hub-Matrix

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Aktuelle Metadaten: RLS aktiv, keine Policy. Direkter Data-API-Zugriff ist damit standardmäßig gesperrt, nicht offen. Bewusste Service-Nutzung ist gesondert zu dokumentieren.

## db::public.social_credentials

false_positive · public.social_credentials

Ursache: RLS aktiv ohne Policies: regulärer Zugriff wird verweigert, Service-Zugriff separat prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Konfigurationshinweis; kein bestätigter Datenverlust oder unberechtigter Zugriff aus dieser Meldung allein.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Aktuelle Metadaten: RLS aktiv, keine Policy. Direkter Data-API-Zugriff ist damit standardmäßig gesperrt, nicht offen. Bewusste Service-Nutzung ist gesondert zu dokumentieren.

## db::Extension citext

unresolved · Extension citext

Ursache: Öffentliches Schema; Schemahärtung und Abhängigkeiten vor einer separat freizugebenden Änderung prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Konfigurationshinweis; kein bestätigter Datenverlust oder unberechtigter Zugriff aus dieser Meldung allein.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Erweiterung im public-Schema durch aktuellen Linter bestätigt. Organisatorischer Hardening-/Optimierungshinweis, kein isolierter Nachweis einer Datenexposition.

## db::Extension vector

unresolved · Extension vector

Ursache: Öffentliches Schema; Schemahärtung und Abhängigkeiten vor einer separat freizugebenden Änderung prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Konfigurationshinweis; kein bestätigter Datenverlust oder unberechtigter Zugriff aus dieser Meldung allein.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Erweiterung im public-Schema durch aktuellen Linter bestätigt. Organisatorischer Hardening-/Optimierungshinweis, kein isolierter Nachweis einer Datenexposition.

## db::Extension pg_trgm

unresolved · Extension pg_trgm

Ursache: Öffentliches Schema; Schemahärtung und Abhängigkeiten vor einer separat freizugebenden Änderung prüfen.

Erwartete Änderung: Vorhandene Aufruferverträge erfassen; geprüfte Herkunft, aktive Konten sowie Datensatz-/Mandantenrechte vor privilegierten Aktionen erzwingen.

Auswirkung auf bestehende Funktionen: Konfigurationshinweis; kein bestätigter Datenverlust oder unberechtigter Zugriff aus dieser Meldung allein.

Abhängigkeiten: Bestehende automatische und manuelle Aufrufer; Fachrollen, Datenbeziehungen und Providerverträge

Tests: Öffentlicher Schlüssel, falsche Signatur, inaktives Konto und fremder Datensatz; Berechtigter automatischer und manueller Aufruf mit simulierten Anbietern; Keine echten E-Mails, Nachrichten oder produktiven Synchronisationen

Rollback: Vorherige Funktions-/Richtlinienversion und Aufruferkonfiguration gemeinsam sichern; kontrolliert zurücknehmen, ohne unsichere Zugänge wieder zu öffnen. Belege und Auditdaten erhalten. Kein automatischer Datenrollback.

Prüfstand: Erweiterung im public-Schema durch aktuellen Linter bestätigt. Organisatorischer Hardening-/Optimierungshinweis, kein isolierter Nachweis einer Datenexposition.

