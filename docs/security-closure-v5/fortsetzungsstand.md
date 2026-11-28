# FINAL SECURITY CLOSURE v5.0 — Fortsetzungsstand, keine finale Abnahme

28.11.2026. Gesamtfreigabe umgesetzt, nicht vollständig ausgeschöpft: die Ausführungsgrenze dieser Sitzung wurde erreicht. Keine Hintergrundbereinigung. Keine Veröffentlichung der Anwendung.

## Tatsächlich ausgeführt

18 vorhandene Edge Functions korrigiert und bereitgestellt. 91 eindeutige native IDs (41 kritisch, 50 Warnungen) nach Tests und echter öffentlicher HTTP-Abweisung über die Befundverwaltung als behoben gemeldet; keine Ignorierungen. IDs und Quellen: native-closed.csv. Gemeinsame Ursachen: fehlende Maschinen-/Mitarbeiteranmeldung, unzureichende Rollen-/Firmenprüfung, globale Forderungssynchronisierung, ungeschützte Dokumentversionen, freie Retourenempfänger, unsicherer alter COM-Registryzugang und zusammengesetzte Suchfilter.

- Bestehende zentrale Caller-/Process-/Job-Prüfungen verwendet; keine parallele Sicherheitsverwaltung.
- Globaler collect_sync_cases-Aufruf service-only. Persönliche Engine-Läufe nutzen den bestehenden Echtzeitabgleich und bearbeiten nur autorisierte Firmenfälle; Zahlungsversprechen/Aufgaben sind auf geladene Elternfälle begrenzt. Keine Ausführung des globalen Neuaufbaus in Live-Tests.
- Management-Pack und Forecast verlangen aktive exakte Rollen und zulässige Firmen. Forecast liest ausschließlich ausgewählte Firma/Buchungskreis und schreibt mit persönlichen Rechten. Nicht eindeutig einer Firma zuordenbare bestehende Packs bleiben gesperrt; keine Stammdaten automatisch korrigiert. Neue Packs erhalten die ausgewählte Firma. Die beiden bestehenden Oberflächenanbindungen sind gespeichert, nicht neu veröffentlicht.
- AlixDocs prüft aktive interne Konten, Eigentümer/Bearbeitungsrolle, bestehende Elternvorgänge und Firmen vor privatem Storagezugriff. Geschäftliche Dokument-/Versionsschreibzugriffe verwenden persönliche Rechte; Storage wird ausschließlich für den zuvor geprüften Dokumentpfad privilegiert verwendet. Konkurrierende Versionsupdates melden Konflikt. Erfolgreicher realer Upload noch nicht angemeldet abgenommen.
- Retourenversand liest persönliche Vorgangsrechte und verlangt passenden Auftrag/Kundenquelle sowie exakt den gespeicherten Kundenempfänger. Kein echter Versand getestet.
- COM-Registry verlangt exakt aktiven Super Admin, feste erlaubte Zielpfade und keine Weiterleitungen; bestehende kontrollierte Sperre bleibt bestehen. Kein Webseitenaufruf in Tests.
- Neun bestehende Scheduler erhalten ausschließlich die Bindung an das vorhandene CRON_SECRET. Alle 102 Zeitpläne, Aktivierungen, Ziele und Nutzlasten unverändert; Migrationen prüfen Zeit-/Aktivierungsfingerprint transaktional. Kein Schlüssel erzeugt oder rotiert.
- Auftragsnamen werden mit separaten typisierten Feldfiltern gesucht, nicht in OR-Ausdrücke eingesetzt. Persönlicher Angebotsdigest liest ausschließlich Aufgaben autorisierter Firmenangebote; Maschinenlauf bleibt erhalten.

## Prüfnachweise

436 gemeinsame Servertests und 277 Anwendungstests bestanden; alle 18 geänderten Funktionen isoliert typgeprüft. Build OK. 18 reale Endpunkte weisen den echten öffentlichen Projektschlüssel mit 401 ab (live-public-denial.json); zusätzlich ungültige Tokens über das Edge-Testwerkzeug abgewiesen. Positive Geschäfts-/Maschinenpfade nur mit synthetischen lokalen Antworten, ohne echte Transaktionen, Kundenversand, WhatsApp oder Webseitenoperationen. SQL bestätigt collect_sync_cases: anon=false, authenticated=false, service_role=true. Geschützte Scheduler: 9/9.

## Scanner als externe Abhängigkeit

Geerbte Antwort: completion_status=failed, up_to_date=false, 600 IDs. Kein abgeschlossener aktueller Scan und keine belegte Ursache für das Plattformversagen. Schnellscan am 28.11.2026 07:58:50 UTC: keine neuen aktiven Befunde im begrenzten Bereich; Connectorprüfung mangels Konfiguration übersprungen. Ein bereits vom Nutzer ignorierter Datenbankbefund wurde nicht verändert oder erneut zur Bereinigung vorgeschlagen.

Neue Tiefenprüfung gestartet auf dem tatsächlich gespeicherten Ausgangs-Korrekturcommit 8a94fc3ad19737a6ab3e7bedafe5a56716ca573a:
security_scan/security-scan-13914134-4b95-4f3f-a064-71f725c7d887-8a94fc3ad19737a6ab3e7bedafe5a56716ca573a-c2f5e03c

Dieser Scan enthält nicht die nach seinem Start vorgenommenen v5-Korrekturen. Keine Ergebnisabfrage/Polling und kein zweiter Start; auf Benachrichtigung reagieren, dann den final gespeicherten Korrekturcommit separat prüfen. Der Scanner ist ein extern verwalteter Lovable-Dienst, nicht AlixWork-Code. Seine Laufzeit, Fehlerausgabe, Befundprojektion und Wiederöffnung können hier nicht dauerhaft repariert werden. Ein fehlgeschlagener/unvollständiger Lauf ist niemals Abnahme; IDs werden nur gegen belegten Quellstand und konkrete Test-/Bereitstellungsevidenz abgeglichen. Keine unbewiesenen Doppelmeldungen ignoriert.

## Verbleibende Arbeiten und genaue Reihenfolge

509 geerbte IDs bleiben aktiv (263 kritisch, 246 Warnungen), verlustfrei in remaining-native.csv und remaining-native-ids.txt. Dies ist die Verwaltungsbilanz, nicht die Zahl aktuell bestätigter ausnutzbarer Lücken. Jeder offene Eintrag bleibt individuell zu prüfen. 318 Datenbank-Linterhinweise separat: 2 absichtlich ohne öffentliche Policies geschützte Tabellen, 3 Erweiterungen, 12 öffentliche und 301 Mitarbeiter-Definer-Hinweise. Keine Tabellen zur Entwarnung öffnen.

1. Bereits erneut getestete v4-KI-/Automationsfunktionen einzeln mit Live-Bereitstellungsstand und ID abgleichen, insbesondere ac-qm-auto-score, ac-revenue-intel-v2, ac-compliance-governance, ac-kb-embed, ac-journey-optimize, ac-campaign-ab-decide, ac-segment-preview, delivery-approval-monthly-report, finance-asset-depreciation-run, ac-playbook-run, ac-journey-run. In dieser Sitzung nicht zusätzlich geschlossen.
2. Offene Provider-/Portal-/Signatur-/Dokumentenpfade, darunter mediapaket-portal, alixdocs-sign-return, alixsmart-sync-poll, sig-apply-facsimile, pdf-order-commit, ac-chat und portal-delivery-* individuell autorisieren und testen. Kein pauschales Schließen anhand eines Zugangshelpers.
3. RLS und alle 318 Linterhinweise anhand tatsächlicher Definitionen/Aufrufer/Rechte prüfen. Inherited/OR-Policies bleiben eine separate Abnahmeaufgabe; persönliche Edge-Clients allein beweisen keine vollständige Datenbankisolation.
4. Native historische Korrekturen/ID-Dubletten/neu hinzugekommene IDs mit dem nächsten vollständigen Scan abgleichen. initial-native.csv enthält exakt alle 600 Ausgangs-IDs; keine historische Meldung ohne belastbaren technischen Nachweis geschlossen.
5. Echte Mitarbeiter-/Mandanten-/Provider-Abnahme und isolierter Restore bleiben extern blockiert. lovable auth-session --self verweigert die Sitzung, weil dieses Supabase-Projekt extern verwaltet wird; keine Zugangsdaten erfragen und keine Testsitzung als echte Abnahme ausgeben. Historisch exponierte Zugangsdaten benötigen koordinierte Rotation außerhalb unsicherer automatischer Tests.

## Bestandsschutz

44 Produkte, identischer Vor-/Nachfingerprint 50195010c05db35ee45327dc9173008f. 102 Scheduler; vollständiger Befehlsfingerprint hat sich ausschließlich durch genehmigte Authentifizierungsbindungen verändert. Keine Löschung von Geschäftsdaten, keine echte Finanzaktion/Kundenmail, keine neue API oder Änderung der Verträge v1.2/v1.3. ph2_activation: enabled=false, emergency_stopped=true, revision=0, DE/COM blocked, kein Pilotgerät. Root AGENTS.md ist voll; keine bestehenden Nutzer-/Skillregeln gekürzt. Keine finale Sicherheitsabnahme und keine Nullrisikoaussage.
