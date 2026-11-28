# PRODUCT HUB – Sicherheitsbericht Release Control v1.1

Stand: 28.11.2026. Ausschließlich lesende Sicherheitsanalyse. Keine bestehenden RLS-, Rollen-, Storage- oder Schlüsselregeln geändert, keine Befunde ignoriert oder als behoben markiert. Die Ergänzung der neuen Freigabematrix ist eine ausdrücklich beauftragte Funktionsänderung, keine Bereinigung bestehender Sicherheitsrichtlinien.

## Ergebnis: Pilotfreigabe blockiert

Ein bestätigtes hohes Rollenrisiko betrifft den Product Hub. Zusätzlich bestätigt die Quellcodeprüfung einen unzureichend autorisierten Product-Hub-Import mit zwei vom Scanner getrennt gemeldeten Schreibpfaden. Keine schreibende Ausnutzungsprobe, kein Testimport und keine Produktlöschung wurden durchgeführt. Eine endgültige Sicherheitsfreigabe wird ausdrücklich **nicht** erteilt.

## Alle 493 bestehenden Datenbankhinweise

Die vollständige objektbezogene Einzelliste liegt in `sicherheit-v1-1-inventar.csv`. Sie enthält Objekt, aufrufende Rolle, vorläufige Risikoklasse, Bestätigungsstand, Product-Hub-Bezug und nächsten Prüfschritt.

| Klasse | Anzahl | Einordnung |
|---|---:|---|
| Kritisch | 0 | Im ursprünglichen 493er-Datenbankinventar nicht als solche bestätigt |
| Hoch | 147 | 146 potenzielle Risiken; ein manuell bestätigter Rollenfehler |
| Mittel | 189 | Prüfindikator vorhanden, vollständige Aktivstatus-/Rollen-/Mandantenprüfung noch offen |
| Niedrig | 3 | `citext`, `vector`, `pg_trgm` im öffentlichen Schema |
| Informativ | 2 | RLS ohne Policies bei `mfa_sms_codes` und `social_credentials`: regulärer Zugriff verweigert, kein Beweis einer Datenfreigabe |
| Möglicher Fehlalarm | 152 | Triggerfunktionen sind nicht direkt als normale RPC ausführbar; öffentlicher Katalogstatus liefert nur eine boolesche Freigabeentscheidung |
| **Gesamt** | **493** | **Vollständig inventarisiert, nicht 493-mal manuell auf Ausnutzbarkeit geprüft** |

Der Linter meldet 476 von angemeldeten Rollen erreichbare Definer-Funktionen und 12 zusätzlich anonym erreichbare Funktionen; diese Rollenbefunde können dasselbe Funktionsobjekt mehrfach betreffen. Eine sichtbare `auth.uid()`-/Rollenprüfung allein bestätigt keine Sicherheit. Triggerbefunde werden nicht pauschal gelöscht: der tatsächliche Tabellen-Schreibpfad bleibt relevant.

### Bestätigt: Admin erbt Super Admin

`public.has_role(check_role text)` liefert für `check_role='Super Admin'` auch dann wahr, wenn lediglich `Admin` vorliegt. Die Product-Hub-Löschrichtlinien für Produkte, Medien, Dokumente, Kanalzuordnungen und Einstellungen verwenden genau diese Prüfung. Damit entspricht ihre Entscheidung nicht der Vorgabe „Löschen ausschließlich Super Admin“. Die neue Release Control verwendet deshalb eine **eigene exakte aktive Rollenprüfung für ihre neuen Prüfaktionen**; die bestehende globale Funktion und Löschrichtlinien wurden auftragsgemäß nicht geändert.

Empfehlung nach separater Freigabe: exakte Super-Admin-Prüfung in den betroffenen Löschregeln; vorher sämtliche abhängigen Richtlinien, Auth-, Storage- und Fachfunktionen inventarisieren und rollengetrennt testen. Keine globale Änderung ohne Folgenanalyse.

## Zusätzliche Tiefenprüfung

Die gestartete Tiefenprüfung lieferte 213 zusätzliche Scannerbefunde: 136 `error`, 77 `warn`. Der Scanner bezeichnet seine Abdeckung als **incomplete**, obwohl der Hintergrundauftrag abgeschlossen ist. Die Prüfung basiert auf dem Stand vor diesen Änderungen. Dies ist keine vollständige Sicherheitsabnahme und nicht dieselbe Menge wie die 493 Datenbankhinweise.

Die zusätzliche Einzelliste steht in `sicherheit-v1-1-tiefenpruefung.csv`. Sieben Befunde betreffen Product-Hub-Import bzw. alte COM-Übertragungswege:

| System | Prüfung | Einordnung und Empfehlung |
|---|---|---|
| `product-hub-import` | Anlegen von Produkten ohne aktive administrative Autorisierung | **Kritischer Quellcodebefund**: Service-Client und schreibender Importpfad, keine Caller-/Rollenprüfung. Vor Freigabe separat absichern und unangemeldete/rollenfremde Requests testen. |
| `product-hub-import` | Änderung passender vorhandener Produkte | **Kritischer Quellcodebefund** desselben Einstiegspunkts: vorhandene leere Felder werden privilegiert ergänzt. Kein tatsächlicher Testschreibzugriff durchgeführt. |
| `ph-com-lang-push` | Beliebiger Probe-Payload; unautorisierte Sprachübertragung | Scanner meldet kritisch; im aktuellen Quellcode durch `controlled_modes=true` vor dem Request-Body blockiert. Kein aktueller erfolgreicher Versand nachgewiesen. Guard nicht entfernen; später auch Caller-/Rollenprüfung verlangen. |
| `ph-com-registry-push` | Mapping lesen, registrieren und beliebige COM-Pfade aufrufen | Drei Scannerbefunde; gleicher bestehender kontrollierter Modus blockiert vor den Aktionen. Ohne diesen Guard wäre die fehlende Callerprüfung relevant. Keine Remote-Aktion ausgeführt. |

Weitere Scannerbefunde betreffen u. a. WhatsApp-Kanalrechte, ungeschützten Mail-Eingang, Finanzbelege und privilegierte Fachfunktionen. Sie wurden nicht geändert; detaillierte Einzelfallbestätigung bleibt ein separates Sicherheitsprojekt. Kein neuer Scanbefund wurde automatisch ignoriert.

## Fachliche Sicherheitsbereiche

- **RLS und Rollen:** Product-Hub-Lesezugriff ist intern; Fachschreibrechte beruhen auf `ph_can_edit`. Bestehende Löschregel hat die bestätigte Vererbungsabweichung. `ph_roles`-Delegation muss separat gegen die gewünschten Fachrollen geprüft werden.
- **Service-Role:** Neue Nachweise werden nur serverseitig geschrieben; der alte Modus-Umgehungspfad wurde für Caller gesperrt. Bestehender reservierter `ph2_*`-Schutz bleibt maßgeblich. Keine Service-Role im Browser oder Bericht.
- **Öffentliche Endpunkte:** Produktdaten-Import darf nicht durch einen öffentlich verfügbaren Projektschlüssel als administrativ legitimiert gelten. Neue Release-Control-Aufrufe ohne Anmeldung wurden mit 401 abgewiesen.
- **Schlüssel/Secrets:** Keine Werte ausgelesen, exportiert oder verändert. Ein HTTP-200 bestätigt weder Signatur noch Empfangsscope. Änderungen der Edge-Secret-Konfiguration sind im Tabellen-Zeitstempel-Kontext nicht automatisch erkennbar; nach einer solchen Änderung müssen Nachweise ausdrücklich erneut geprüft werden.
- **Storage:** Private Buckets bleiben privat. Bestehende Dateiliste ist kein vollständiges Binärbackup. Reale Dateien, Größen und Prüfsummen sowie lesende Test-API müssen im isolierten Ziel separat nachgewiesen werden.
- **DE/COM-Trennung:** Nachweise werden kanalgetrennt ausgewertet; DE erfüllt COM nicht. Nur Apex mit `alix-apex` darf den geplanten Pilotnachweis liefern. Live-Modi und Notstopp bleiben unverändert gesperrt.

## Nächste Schritte ohne automatische Änderungen

1. Bestätigte Import- und Rollenrisiken gesondert zur Korrektur freigeben.
2. Verbleibende potenzielle Datenbank-/Scannerbefunde nach Fachbereich manuell bestätigen, insbesondere aktive Rollen und Datenscope.
3. Erst nach Korrektur und Regressionen einen positiven serverseitigen Sicherheitsnachweis erstellen lassen; bis dahin bleibt die Matrix blockiert.