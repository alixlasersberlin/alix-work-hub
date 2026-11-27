# PRODUCT HUB 2.0 – Bestandsanalyse

**Auftrag:** ausschließlich Prompt 1. **Prüfdatum:** 27.11.2026, ab 05:48 UTC. Keine Umsetzung von Prompt 2–6, keine Produktivschaltungen, keine Migration, keine Veröffentlichung, keine Änderungen an anderen Modulen.

## Zusammenfassung

AlixWork besitzt bereits eine brauchbare zentrale Produktdatenquelle. Ein Neubau der Produktdatenbank ist weder nötig noch vorgesehen. Das Hauptproblem ist die nicht mehr einheitliche Kommunikation: **COM und DE liefern ihre Inhalte inzwischen durch Abruf aus AlixWork aus, ihre früheren Direktendpunkte antworten jedoch mit HTTP 410. AlixWork sendet weiterhin an diese Endpunkte.** Eine neue Oberfläche allein würde diesen Widerspruch nicht beheben.

Zusätzlich sind private Bildlinks und öffentliche Bildfreigaben nicht kompatibel, Freigaberegeln zwischen Abruf und Direktversand unterschiedlich und aktuelle Webseitenzustände nicht durchgehend belegbar. Historische Erfolgseinträge sind kein aktueller Online-Nachweis.

**Vor produktiven Umbauarbeiten fehlt eine vollständige, extern geprüfte Sicherung einschließlich Originaldateien und ein erfolgreicher isolierter Wiederherstellungstest.** Der erstellte Export ist eine überprüfbare, bereinigte PRODUCT-HUB-Datensicherung mit ausdrücklich begrenztem Umfang, kein vollständiges Systembackup.

## 1. Tatsächlicher Datenbestand

Die Live-Datenbank enthält **39 `ph_*`-Tabellen**, alle mit aktivierter RLS. Die Werte unten sind echte Zeilenzahlen aus abgegrenzten Leseexporten, keine Schätzwerte aus PostgreSQL-Statistiken. Diese Statistiken meldeten einige befüllte Tabellen fälschlich als leer.

| Bereich | Bestand |
|---|---:|
| Geräte `ph_products` | 44, alle Status `published` |
| Medien `ph_media` | 313 |
| Dokumentverweise `ph_documents` | 101 |
| Webseiten `ph_channels` | 6 |
| Produkt-/Webseitenzustände `ph_product_channels` | 190 |
| Bestätigte Identitätszuordnungen `ph_lang_sync_map` | 88, jeweils 44 COM und DE |
| Übersetzungen `ph_product_translations` | 186 |
| SEO-Datensätze `ph_seo` | 44 |
| Feldhistorie `ph_field_history` | 3.164 |
| Veröffentlichungswarteschlange `ph_publish_queue` | 57 |
| Rollbacks `ph_publish_rollbacks` | 54 |
| Übertragungsprotokoll `ph_sync_log` | 272 |
| Varianten `ph_variants` | 2 |
| Marketingdatensätze `ph_marketing` | 36 |
| Separate Preise `ph_prices` | 0; Preise existieren dennoch in Produkt-/Länderdaten |

### Führende Quelle und Kennungen

- `ph_products.id`: interne UUID, bleibt unverändert.
- `alix_product_id`: bestehende zentrale Textkennung, nicht ausschließlich UUID; 31 UUID-förmige und 13 textförmige Werte. Alle 44 befüllt und eindeutig.
- SKU und Slug sind eigene Felder, keine Ersatz-IDs. Slugs vollständig und eindeutig. Keine doppelten befüllten SKUs bei Vergleich ohne Groß-/Kleinschreibung.
- **BodyGlow**, interne ID `d6775fb7-5de5-4ab4-b126-e2577b5e4a1d`, hat keine SKU. Keine Artikelnummer erfunden oder verändert.
- COM/DE: je 44 Zuordnungen mit `verified_at` und Remote-ID, innerhalb des Kanals keine doppelte Remote-ID. Das belegt gespeicherte Zuordnung, nicht deren erneute öffentliche Abnahme.
- `ph_product_channels.remote_id` allein ist unvollständig: COM nur 1, DE 31 befüllt; der aktuelle Direktversand verwendet `ph_lang_sync_map`. Ein Umbau darf diese Felder nicht ungeprüft gleichsetzen.
- Content-Hub-Snapshots in `ch_channel_state`, Katalogversionen und Veröffentlichungsbelege sind unterschiedliche Modelle, keine zweite gleichberechtigte Gerätequelle. Content Hub wurde nicht exportiert oder verändert.

## 2. Bestehende Oberfläche

Vorhanden sind Dashboard, Geräte und Editor, Webseiten, Übersetzungen, Medien, Dokumente, Preislisten, Import/Export, Freigaben, Konflikte, Verlauf, Sync Health, Einstellungen, Validierung, Master Review, Veröffentlichungen, COM-/DE-Canaries, COM-/DE-Abschaltprüfungen und Katalogeditor.

**Quellen:** `src/App.tsx:720–742,2368–2392`, `src/lib/nav/navItems.ts:717–739`, `src/pages/ProductHub/`, `src/components/producthub/`, `src/lib/producthub/`.

Wiederverwendbar: vorhandener Editor, Auswahl-/Domainadapter, Suche, Datenzugriff, Übersetzungs-/Medienverwaltung und ALIXWORK-Gestaltung. Die spätere Navigation kann auf Geräte, Webseiten und Übertragungsprotokoll reduziert werden, ohne alte Funktionen vor erfolgreicher Migration abzuschalten; Nebenfunktionen zunächst als interne Werkzeuge erhalten.

## 3. Schnittstellen und Sender

| Bestandteil | Tatsächliche Rolle | Bewertung |
|---|---|---|
| `product-hub-api` | Schlüsselgeschützter Abruf von Geräten, Details, Medien, Dokumenten, lokalen Preisen und Content-Hub-Snapshots | Führende Abrufprojektion wiederverwenden, Verfügbarkeitsregeln vereinheitlichen |
| `ph-global-publish-device` | Aktiver Benutzer, Super Admin, Mandant, Kanal und Identität; signierter Direktversand COM/DE/AE/Beauty | Schutz-/Beleglogik wiederverwendbar; COM-/DE-Ziele aktuell inkompatibel |
| `ph-com-publish-device` | Weiterleitung zum GLOBAL-Sender | Kompatibilität erhalten, später vereinfachen |
| `product-hub-lang-sync` | Älterer Preview-/Publish-/Rollbackpfad | Nicht mit neuer Verteilung oder bestätigter Veröffentlichung gleichsetzen |
| `ph-com-lang-push`, `ph-com-registry-push` | Weitere ältere COM-Schreibwege | Vor Wiederverwendung gesondert absichern/ablösen |
| `product-hub-import`, `ph-en-batch` | Privilegierter Import beziehungsweise Übersetzungsbatch | Kein gewöhnlicher sicherer Schalterpfad; Handler-Autorisierung prüfen |
| `ph-translate`, `product-hub-enrich`, `ph-ai-field`, `ph-ai-seo` | Inhaltserstellung mit eigenen Prüfungen | Wiederverwendbare Inhaltshilfen, keine Publikationsbelege |
| `product-hub-validate`, COM-/DE-Canaries | Validierung mit Schreibprotokollen beziehungsweise ältere Test-/Veröffentlichungsabläufe | In dieser Analyse nicht aufgerufen; nicht als reine Leseprüfung behandeln |

Aktuelle Claim-/Finish-RPCs für GLOBAL, Beauty und AE sind laut Live-Rechteprüfung nur für `service_role` ausführbar, nicht für `anon` oder `authenticated`. DE-Identitätsänderung besitzt eine öffentliche Invoker-Fassade über einer privaten Implementierung. Alle 39 Tabellen besitzen RLS; 141 Policies, 83 Indizes, 102 Constraints, 18 anwendungseigene Trigger und 601 Spalten wurden als Metadaten erfasst.

Bei älteren privilegierten Endpunkten fehlt laut Quellcode teilweise eine aktive Benutzer-/Rollenprüfung im Handler. Das ist ein zu prüfender Sicherheitsbefund, **kein in dieser Analyse nachgewiesener öffentlicher Angriff**. Bereitgestellte Revisionen und Gateway-Konfiguration wurden nicht vollständig verifiziert. Keine Sicherheitsregeln verändert.

## 4. Webseiten und echte Rückmeldungen

Gelesene externe Quellstände: GLOBAL `3708155e`, Austria `41a9a5f1`, UAE `66397db0`, Beauty `e24bcde2`. Snapshots sind nur lesbar; keine fremden Datenbanken oder Zugangswerte verwendet.

| Kanal | AlixWork-Konfiguration | Aktueller Anschlussbefund |
|---|---|---|
| COM | aktiv, 19 gewünschte aktive Geräte | Öffentliche Übersicht HTTP 200; 17 passende Geräte-Slugs gefunden. BlueIce Smart KI Karte und Detail HTTP 200. Direktendpunkt GET HTTP 410 `PRODUCT_HUB_PULL_ONLY` |
| DE | aktiv, 20 gewünschte aktive Geräte | Übersicht HTTP 200; 18 passende Geräte-Slugs gefunden. BlueIce Smart KI Karte und Detail HTTP 200. Direktendpunkt GET HTTP 410 `PRODUCT_HUB_PULL_ONLY` |
| Beauty | aktiv, eigene Domain | Abrufcache plus eigener Release-/Abschaltvertrag. 1 gespeicherter `beauty_online`-Beleg; weiterhin lokale Overrides und Annahmepfade im Quellstand |
| AT | in `ph_channels` inaktiv, keine Basis-URL | Austria-Quellstand mit statischem Gerätebestand; `https://alix-lasers.at` leitet bei öffentlichem GET auf `https://alix-lasers.de/` weiter. Eigenständiger AT-Empfang nicht nachgewiesen |
| AE / `dubai` | in `ph_channels` inaktiv, keine Basis-URL | Neuer UAE-Quellstand liest `channel=Dubai`, AlixWork akzeptiert dagegen exakt `dubai`/`ae`/`uae`. Dieser Groß-/Kleinschreibungsunterschied führt im vorhandenen API-Code zur Suche nach einem unbekannten Custom-Kanal. Kein autorisierter Liveabruf dieses Vertrags erfolgt |
| US / `usa` | inaktiv | Auftragsgemäß unverändert und von der Migration ausgenommen |

**COM/DE-Hauptwiderspruch, live belegt:**

- `GET https://www.alix-lasers.com/api/public/product-hub/direct-release` → 410, `RETIRED`, `PRODUCT_HUB_PULL_ONLY`.
- `GET https://alix-lasers.de/api/public/product-hub/direct-release` → dasselbe Ergebnis.
- Der aktuelle GLOBAL-Quellstand weist auch POST/PATCH/PUT/DELETE/HEAD diesem stillgelegten Handler zu. Keine Schreibmethode zu Testzwecken aufgerufen.
- GLOBAL liest Liste und Detail aus AlixWork; Liste wird erst nach erfolgreichem, identitätsgleichem Detailabruf gezeigt. Erfolgreicher Katalogcache: **60 Sekunden**, nicht fünf Sekunden; Fehler werden nicht als veralteter Erfolg ausgeliefert.
- In GLOBAL werden **Blueice Fusion Red und Blueice Hybrid Red zusätzlich website-seitig ausgeblendet**, obwohl ihre AlixWork-Aktivflags wahr sind. Genau diese beiden fehlen in beiden öffentlichen Übersichten. Quellkommentar nennt eine frühere Eigentümerentscheidung. Nicht eigenmächtig aufgehoben; vor Migration mit dem gewünschten zentralen Zustand abgleichen.

**Gespeicherte Belege:** 16 COM- und 9 DE-Kanalstände mit `global_offline`, 1 COM mit `global_direct`, 1 Beauty mit `beauty_online`; keine AE-Belege in den exportierten Kanal-Snapshots. 7 COM- und 5 DE-`global_pending`-Reservierungen. Diese historischen Belege sind unter dem geänderten Abrufmodell nicht automatisch aktuelle Zustandsnachweise.

190 Kanalstände enthalten insgesamt 98 `has_pending_changes=true`. Der jüngste DE-Kartenprüfungsfehler meldet „Bestätigter DE-Kartenlink fehlt; Verschwinden nicht nachweisbar.“ Solche Fehler dürfen nicht als erneut erforderliche Abschaltung missverstanden werden.

Die öffentliche Prüfung war eine **Momentaufnahme von Übersichten und BlueIce-Details**, keine vollständige Abnahme aller Geräte, Suche, Kategorien, Sitemap und Bilddateien. Ein Link beweist weder gerenderte Karte noch intakte Mediendatei. Keine neue echte Abschaltung oder Aktivierung ausgelöst.

## 5. Alix Nexus KI: Bild vorhanden, Versand inkompatibel

Live-Gerät: `a7ccb4ab-505d-49c5-ae21-b9f5c472d12f`, Hub-ID `ALX-ALIX-NEXUS-KI`, Status published, COM und DE aktiv.

Haupt- und Angebotsbild sind gespeichert, aber als **signierte URL im privaten `product-hub-docs`-Speicher**. Der angezeigte `alixwork.de/media/...`-Link wird durch `mediaDisplay` nur maskiert; er beweist keinen öffentlichen Medienendpunkt.

Der Editor erzeugt signierte URLs (`ProductEditor.tsx:1140–1157`), übernimmt sie als Hauptbild (`741–745`); der Direktvalidator lässt ausschließlich bestimmte öffentliche URLs ohne Query zu (`ph-global-publish-device/contract.ts:14–20,43–46`). Deshalb wird ein vorhandenes Bild als nicht öffentlich freigegeben abgelehnt, bevor überhaupt ein Release reserviert oder gesendet wird.

Bestand: 250 Medien mit öffentlichem Speicherpfad, 56 mit signiertem Pfad, 7 andere Quellen. Bei 13 Geräten ist kein Medien-Datensatz als primär markiert, bei 9 sind zwei markiert; dies bedeutet nicht automatisch ein fehlendes `hero_image_url`.

**Spätere Korrektur:** kontrollierter öffentlicher Bildauslieferungsvertrag mit kanonischen Referenzen; Originale erhalten. Nicht den gesamten Dokumentbucket öffentlich machen, nicht bloß private signierte URLs global freigeben. Keine Bilder erneut hochgeladen, heruntergeladen oder verändert.

## 6. Fehlerhafte/doppelte Abläufe

1. **Übertragungsmodell:** COM/DE-Abruf und alte Direktbefehle widersprechen sich, live 410 belegt.
2. **Bildvertrag:** signierter Upload kann Direktfreigabe nicht erfüllen, Nexus live bestätigt.
3. **Doppelte Veröffentlichung:** kanalbezogenes „Veröffentlichen“ ruft `save()` mit automatischem Push an ausgewählte direkte Seiten auf und sendet anschließend zusätzlich an den Einzelkanal (`ProductEditor.tsx:355–387,861–869`).
4. **Doppelte Abschaltversuche:** Produktflag-Update und Kanal-Upsert können jeweils Abschaltung auslösen (`api.ts:51–59,86–91`; Editor `360–367`). Bestehende Reservierungen begrenzen Schäden, beseitigen aber nicht den doppelten Ablauf.
5. **Unterschiedliche Aktivregeln:** `phIsActiveOn` und Custom-API akzeptieren nicht-inaktiv, `websiteState` verlangt published. Hold und aktive Webseite werden im Abruf nicht wie im Direktversand berücksichtigt (`product-hub-api/index.ts:249–283`).
6. **Lokale Webseitenentscheidungen:** GLOBAL-Hideliste und Beauty-Overrides/Annahmepfade verhindern ausschließlich zentrale Steuerung; frühere Eigentümerentscheidungen zunächst abstimmen.
7. **UAE-Kanalvertrag:** `Dubai` im neuen UAE-Abruf stimmt nicht mit der API-Normalisierung überein.
8. **Skalierung:** allgemeine Geräte-/Dashboard-Abfragen sind teilweise ungeblättert; Bulk-/Domainadapter paginieren bereits. Bei größeren Beständen besteht Abschneiderisiko.
9. **Alte Warteschlange:** `ph_publish_queue` ist feldbezogen mit Freigabe-/Rollbackfeldern, keine fertige dauerhafte PUBLISH/UPDATE/UNPUBLISH-Engine. Wiederverwendung benötigt eine konkrete Erweiterung und Freigabe, keine bloße Umbenennung.

## 7. Was funktioniert und was wiederverwendet wird

- 44 eindeutige Geräte, bestehende zentrale Kennungen, vollständige gespeicherte COM-/DE-Zuordnungen.
- Bestehende Produktbearbeitung, Medien-/Dokumentreferenzen, Übersetzungen, Länderpreise, Historien und Kataloge.
- Rollen-/Mandant-/Identitätsprüfung, HMAC, Reservierung, Versionsvergleich und strenge Belegauswertung des aktuellen Senders.
- Sequenzielle paginierte Sammel-/Domainadapter, US-Ausschluss, Trennung von Sollstatus und bestätigtem Ergebnis.
- Öffentlicher COM-/DE-Abruf grundsätzlich vorhanden; BlueIce Smart KI heute auf beiden Seiten erreichbar.
- **62 vorhandene Tests in 14 Dateien bestanden.** Das sind isolierte Regel-/Ansichtstests, kein produktiver Versand- oder Wiederherstellungsnachweis.

Ersetzt/vereinheitlicht werden später die konkurrierenden Übertragungswege, doppelte Orchestrierung, nicht kompatible Bildreferenzen, uneinheitliche Kanalregeln und die überladene Navigation. Bestehende Funktionen bis zur erfolgreichen Migration nicht abschalten.

## 8. Sicherungsstand und Grenzen

Erstellt: bereinigte JSON-Exporte aus **38 der 39 PRODUCT-HUB-Tabellen**, Live-Schema-/RLS-/Index-/Trigger-/ACL-Metadaten, öffentlich gelesene Ergebnisse und abgegrenzte Quellkopien; Manifest mit SHA-256, Größen und Zeilenzahlen, lokaler Verifikator. Die sechs `ph_settings`-Werte wurden aus Vorsicht nicht exportiert, nur ihre Existenz und Schlüssel geprüft. Keine Geheimnisse oder gültigen signierten URL-Tokens im Paket.

Die fünf Leseexporte entstanden in **getrennten Datenbankanweisungen zwischen 05:49:40 und 05:51:24 UTC**, nicht unter einem gemeinsamen Transaktionssnapshot. Ein gemeinsamer konsistenter Zeitpunkt ist deshalb nicht zugesichert. URL-Tokens und credentialartige Felder sind bereinigt und müssen bei einer autorisierten Wiederherstellung neu bereitgestellt werden.

**Nicht gesichert/verifiziert:** Originalbilder/-videos/-dokumente, externe Storage-Dateien, alle privaten Einstellungen, Content-Hub-Daten, vollständiger Datenbankdump, Provider-PITR und vollständige Funktionsdefinitionen einschließlich Abhängigkeiten. Keine Produktionswiederherstellung vorgenommen.

**Zusätzlicher Live-Befund:** Die fünf jüngsten `backups_metadata`-Einträge für Vollsicherungen vom 22.–26.11. sind alle `failed`; Integrität/Dateizahl/Größe jeweils ohne Nachweis. Das beweist nicht, dass ältere brauchbare Sicherungen fehlen, erlaubt aber keine Annahme einer aktuellen vollständigen Sicherung.

**Folge:** Analyse abgeschlossen; Sicherung nur im dokumentierten Teilumfang geprüft. Produktiver Migrationsstart bleibt bis zu vollständiger Sicherung und isolierter Wiederherstellung gesperrt. Siehe den separaten Wiederherstellungs- und Migrationsplan.

## 9. Nächster freizugebender Schritt

Zuerst Sicherungsnachweise vervollständigen und **einen einheitlichen Vertrag auf Basis der vorhandenen Abrufquelle mit versionierten Befehlen/Bestätigungen** festlegen. Nicht wieder ein zweites Produktmodell aufbauen. Prompt 2 erst danach als unveröffentlichte Oberfläche auf bestehenden Adaptern umsetzen; Prompt 3–6 jeweils separat freigeben.