# PRODUCT HUB 2.0 – Wiederherstellungs- und Migrationsplan

**Status:** technische Planung aus Prompt 1, keine Umsetzung. Bestehende Produkte, Bilder, IDs, Preise, Zuordnungen und Funktionen bleiben erhalten. Keine neuen Tabellen, keine Änderungen an anderen AlixWork-Modulen. US bleibt ausgenommen.

## 1. Sicherung vor Migration

1. Das bereinigte PRODUCT-HUB-Paket an einem genehmigten internen Ziel aufbewahren. `python3 verify.py` prüft lokal Hashes, Größen, Zeilenzahlen, eindeutige Primärschlüssel und Produktverweise; keine Netzwerkzugriffe oder Wiederherstellung.
2. Vollständige konsistente Sicherung über den genehmigten Supabase-/Provider-Export ergänzen: alle 39 PRODUCT-HUB-Tabellen, zugehörige Definitionen/Abhängigkeiten und relevanten Content-Hub-Verweise, jeweils zum gleichen Zeitpunkt. Die sechs `ph_settings`-Werte ausschließlich geschützt sichern; Geheimnisse getrennt in den sicheren Einstellungen belassen.
3. Originaldateien aus den referenzierten Speichern an ein ausdrücklich genehmigtes privates Sicherungsziel exportieren. Vorher Ziel, Zugriff und Budget freigeben; keine Dateien löschen oder Quellobjekte verschieben. Fremde Storage-Quellen nur mit bestätigter Autorisierung. Je Datei Herkunft, Objektpfad, Bytezahl und SHA-256 dokumentieren.
4. Aktuellen AlixWork-Code `f743e9e851404bd84058cb40283d29bae6043fc5` und tatsächlich veröffentlichte Webseitenrevisionen unveränderlich referenzieren. Die abgegrenzte Quellkopie im Paket ersetzt keine vollständige Repository-Sicherung.
5. Fehlgeschlagene aktuelle Vollbackup-Läufe gesondert untersuchen; alte Erfolgseinträge reichen nicht. Keine Backup-Jobs oder Wiederherstellungen aus dieser Analyse starten.

**Abnahmetor A:** konsistentes Exportmanifest, vollständige Dateiinventur mit geprüften Inhalten, genehmigtes Wiederherstellungsziel und erfolgreicher isolierter Wiederherstellungstest. Bis dahin keine produktiven Migrationsänderungen.

## 2. Wiederherstellung ausschließlich isoliert prüfen

- Abgeschottete Testumgebung ohne Mail, Webseiten-Schreibzugriffe, Jobs oder externe Ereignisse bereitstellen. Kein Restore in Produktion und kein Umschalten produktiver Domains.
- Versionierte Schema-/Funktionsdefinitionen mit allen Abhängigkeiten bereitstellen; RLS und Rechte vor einer Anwendungssitzung herstellen. Metadaten im Teilpaket sind keine automatisch ausführbare Migration.
- Eltern vor Kindern importieren: Kanäle/Attribute/Produkte/Katalogvorlagen und Kataloge, dann Varianten/Produktdaten/Medien/Dokumente/Übersetzungen/SEO/Kanalstände, dann Zuordnungen, Katalogpositionen, Historien, Queues und Rollbacks. Tatsächliche Fremdschlüssel aus `schema.json` bestimmen die vollständige Reihenfolge.
- IDs unverändert übernehmen; keine Zusammenführung nach Namen, keine neue Artikelnummer für BodyGlow erfinden, kein Löschen mit CASCADE. Trigger-Nebeneffekte nur unter dokumentierter, genehmigter Testkonfiguration unterbinden, niemals produktive Schutztrigger abschalten.
- Private Dateireferenzen wieder verbinden, signierte URLs neu erzeugen; bereinigte Tokens sind nicht wiederherstellbar. Die sechs ausgeschlossenen Einstellungen aus geschützter Sicherung ergänzen. Geheimnisse nicht aus JSON herstellen oder im Frontend speichern.
- Jede der 39 Tabellen mit dem konsistenten Ausgangsmanifest vergleichen, PK/FK und Feldwerte prüfen, Bilder/Dokumente öffnen und Länderpreise unverändert nachweisen. Der aktuelle Teilvergleich kann keine bytegenaue vollständige Wiederherstellung beweisen.
- Mit Testidentitäten aktive Super-Admin-Rechte und Ablehnung anderer Benutzer prüfen; technische Nachweise sind keine zweite redaktionelle Freigabe.

**Abnahmetor B:** schriftlicher Restore-Bericht mit vollständigen Ergebnissen, fehlenden Objekten = 0, unveränderten IDs/Preisen und kontrolliertem Wiederanlauf. RPO/RTO erst nach Messung zusagen.

## 3. Zielarchitektur auf bestehender Datenquelle

```text
AlixWork – Super-Admin-Entscheidung
        |
        v
ph_products + vorhandene Produkt-/Kanal-/Medientabellen
        |
        +--> versionierter gewünschter Kanalzustand
        +--> persistierter Befehls-/Versandstatus
        |
        v
einheitlicher geschützter Verteiladapter
        |
        +--> Empfänger übernimmt dieselbe freigegebene Produktversion
        +--> öffentliche Liste/Detail/Suche/Kategorie/Sitemap aktualisieren
        +--> STATUS/HEALTHCHECK mit Identität und Version
        |
        v
ph_product_channels + ph_sync_log: bestätigter Iststatus
```

- `ph_products.id` und bestehende `alix_product_id` erhalten; Remote-IDs pro Domain bleiben eigenständig. Namen nicht als Identitätsersatz verwenden.
- `ph_product_channels` bleibt Zustandsquelle, `ph_sync_log` Protokoll. Die vorhandene feldbezogene `ph_publish_queue` nur nach Prüfung/Erweiterung für langlebige Befehle verwenden; DDL und Indexplanung separat genehmigen. Keine zweite Produktdatenbank.
- Bestehendes `product-hub-api` als autoritative Datenprojektion beibehalten. Ein neuer Receiver darf Daten aus dieser Quelle beziehen; keine widersprechende zusätzliche Masterquelle.
- PUBLISH/UPDATE/UNPUBLISH/STATUS/HEALTHCHECK einheitlich versionieren. Immer Produkt-ID, Kanal, monotonen Entscheidungsstand, Befehls-ID und Inhaltsversion übergeben; Antwort mit tatsächlichem Zustand, Version und öffentlicher URL.
- Hash allein liefert keine zeitliche Ordnung. Reihenfolge über serverseitig atomaren Kanalentscheidungszähler/vergleichbare monotone Version und sperrende vorhandene Zeile sichern. Ein verspätetes Publish darf ein neueres Offline niemals überholen.
- Preis-/Währungs-/lokale Inhalte mit einer expliziten Feldbesitzliste schützen; aktuelle Direktverträge übertragen keine Preise. Preise erst nach geprüftem länderspezifischem Vertrag übertragen, nie pauschal lokale Regeln überschreiben.
- Eine einzige Orchestrierung pro Nutzeraktion: lokale Speicherung plus genau ein Versand, explicit release unterdrückt Auto-Push, Sammelaktionen paginiert/sequenziell.
- Authentisierung serverseitig; aktive Super-Admin-/Mandanten-/Kanalprüfung, getrennte Geheimnisse, feste validierte Domains/Empfänger. Frei konfigurierbare Empfänger nur mit serverseitiger SSRF-/DNS-/Weiterleitungsprüfung.
- Wiederholungen erst nach Receiver-Idempotenz und STATUS-Abgleich: deterministisch vor Versand gescheiterte Versuche begrenzt wiederholen; unklar ausgeführte Vorgänge zuerst nach Befehls-ID abfragen. Keine blinde Wiederholung bestehender unsicherer Vorgänge.
- Grün nur bei aktueller kanal-/identitäts-/versionsgleicher Online-Bestätigung, Grau bei bestätigtem Offline, Gelb laufend/ausstehend, Rot Fehler. Alte Belege nicht auf neue Kennungen oder neuere Entscheidungen übertragen.

## 4. Vorarbeiten je Webseite

### COM und DE

Der aktuelle veröffentlichte Abruf funktioniert grundsätzlich, Direktendpunkte sind live 410. Vor Umstellung **neuen versionierten Empfangs-/Statusvertrag** im GLOBAL-Projekt implementieren oder den Abruf mit nachweisbarer Cacheinvalidierung und versionierter Bestätigung erweitern. Die stillgelegten Pfade nicht einfach ungeprüft reaktivieren.

60-Sekunden-Katalogcache verhindert derzeit eine verbindliche Fünf-Sekunden-Zusage. Cacheinvalidierung/Versionswechsel und gerenderte öffentliche Seiten müssen gemeinsam geprüft werden. Frühere globale Hidelisten für Fusion Red/Hybrid Red in den zentral gewünschten Zustand überführen, aber frühere Eigentümerentscheidungen nicht stillschweigend aufheben.

### AE

Kanal `Dubai` gegenüber `dubai` korrigieren und Vertrag auf List/Detail/SEO/Sitemap gleich anwenden. Aktueller Abruf und alter Direktadapter müssen denselben Kanalentscheidungsstand verwenden. Keine Kennung aus COM/DE übernehmen; bisher keine bestätigte AE-Zuordnung in AlixWork.

### Beauty

Vorhandenen eigenen Release-/Offlinevertrag nutzen, aber DE-Abhängigkeit, FORCE-/HIDDEN-Overrides, manuelle pending-Annahme und lokale Preis-/Inhaltsregeln dokumentieren. Redaktionelle Annahme durch alleinige AlixWork-Entscheidung ersetzen, technische Belege behalten. Frühere Overrides erst fachlich abstimmen.

### AT

Aktuelle Domainweiterleitung und echte Projektzuständigkeit klären. Statische Produktquelle anbinden, eigene bestätigte Empfänger-/Statusadresse und sichere Konfiguration liefern. Nicht als angeschlossene vierte Webseite zählen, solange sie nur DE ausliefert.

### US

Unverändert, keine Befehle/Tests/Migration.

**Abnahmetor C:** pro Domain veröffentlichter Vertrag, passende sichere Konfiguration, HEALTHCHECK, eindeutiger Bestandsabgleich und eindeutige Zuordnung. Quellcode allein oder HTTP 200 der Startseite reicht nicht.

## 5. Die sechs Schritte einzeln ausführen

| Schritt | Ergebnis | Startbedingung |
|---|---|---|
| 1, aktuell | Bestandsbericht, Teilpaket, Wiederherstellungs-/Migrationsplan | Keine Produktivänderungen; vollständige Sicherung offen |
| 2 | Drei Untermenüs, dynamische Geräte-/Webseitenmatrix auf bestehenden Daten | Freigegebene Planung; zunächst unveröffentlichter Entwurf; keine simulierten Grünzustände |
| 3 | Einheitliche Verteilung, Warteschlange, Versionen, Status, vollständiger API-Vertrag | Abnahmetore A/B, separat genehmigte Änderungen vorhandener Struktur und vollständige Secret-Konfiguration |
| 4 | Identischer Receiver in jedem Webseitenprojekt | Verbindlicher Vertrag aus Schritt 3; Änderungen dort, nicht aus read-only Snapshots |
| 5 | Geschützte Verbindungsverwaltung, Abgleich, Synchronisierung | Abnahmetor C; keine Überschreibung uneindeutiger Produkte |
| 6 | Alle 14 echten Tests, Fehlerbehebung, Wiederholung, Bericht | Vier tatsächlich unabhängige angebundene Webseiten und ein ausdrücklich freigegebenes Testprodukt |

Neue Webseiten erst nach validierter Domain, Receiver-Version und bestandenen Vertragstests automatisch als Spalte anzeigen. 100 Geräte/20 Webseiten mit horizontalem Tabellenbereich, fixierter Geräteidentität und klaren Filtern prüfen; aktuelle einfache Listen vollständig paginieren.

## 6. Abnahme und Rückfall

Die 14 Tests aus der Nutzerdatei unverändert übernehmen: vier Webseiten veröffentlichen, echte Seiten prüfen, Text/Bild ändern, einzelne Domain abschalten, andere Domains unverändert, Detail offline, ohne Duplikat reaktivieren, Ausfall/Wiederherstellung, schneller AN/AUS-Wechsel mit letztem Sollzustand, Sammelveröffentlichung, Preis-/Inhaltsbestand, gemessene Zeit und Null-Datenverlust.

Bericht je Test: Domain, Erwartung, tatsächlich beobachtetes Ergebnis, Versions-/Befehls-ID, Übertragungsdauer, öffentliche URL, Fehler und bestanden/nicht bestanden. Nicht durch Mock-/UI-Tests ersetzen. Testprodukt danach auf allen Testdomains deaktivieren, intern erhalten; kein neues Produkt ohne ausdrückliche Testauswahl erzeugen.

Rückfall bei Fehler: neue Verteilung nicht weiter ausrollen, neue Befehle stoppen ohne Daten zu löschen, bestätigte Zustände/IDs/Reservierungen erhalten. Unklare Vorgänge zuerst STATUS-abgleichen. Code auf dokumentierte geprüfte Revision zurückführen; keine alten Direktendpunkte verwenden, die heute 410 liefern. Datenrestore nur nach separater Freigabe mit Sicherheitsbackup und Schutz gegen veraltete Publikationen.

**Alte AlixWork-Kontrollen und Werkzeuge bleiben bis zur vollständigen erfolgreichen Migration bestehen.** Erst danach überflüssige Wege geordnet stilllegen; keine vorherige Löschung.

## Offene Voraussetzungen

- Vollständige konsistente Sicherung, Originaldateien, geschützte Einstellungen und isoliertes Restore-Ziel/Abnahme.
- Separate Freigabe der Schritte 2–6 und notwendiger Änderungen bestehender Tabellen, keine neuen Tabellen.
- Veröffentlichtes gemeinsames Empfangs-/Statusmodul pro Domain; Webseitenprojekte hier nur lesbar.
- Fachliche Abstimmung bestehender website-seitiger Ausblendungen, AT-Domainzuständigkeit und AE-Zuordnungen.
- Verfügbare echte Super-Admin-Sitzung und freigegebenes Testprodukt für produktive Ende-zu-Ende-Tests.