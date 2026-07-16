# Kundenportal Phase 2+ — Fundament (Sub-Phase 2a) 

Aufbauend auf Phase 1 (Login/OTP, Rechnungen, Meine Daten) und der bereits ausgelieferten Basis für Geräte/Verträge/Tickets. Phase 1 bleibt vollständig erhalten. AlixWork bleibt Master. Portal ist standardmäßig lesend — Schreibrechte sind auf klar definierte Kunden­aktionen begrenzt.

## Umfang Sub-Phase 2a (bereits ausgeliefert)

### Neue Tabellen

| Tabelle | Zweck | Kunden-Schreibrecht |
|---|---|---|
| `customer_portal_offer_acceptances` | Rechtsnachweis Angebotsannahme/-ablehnung, unveränderlich | INSERT (nur eigenes, sichtbares Angebot) |
| `customer_portal_contract_signatures` | Vertragsunterschrift mit OTP-Bestätigung, unveränderlich | keins (nur Edge Function) |
| `customer_portal_message_threads` + `customer_portal_messages` | Sichere Nachrichten pro Abteilung | INSERT (eigene Threads/Nachrichten), UPDATE nur `archived_by_customer`/`read_at` |
| `customer_portal_documents` | Kuratierte Dokumentenablage | keins |
| `customer_portal_notifications` | Portal-Benachrichtigungen | UPDATE nur `read_at` |
| `customer_portal_maintenance_requests` | Wartungsanfragen | INSERT (eigene) |
| `customer_portal_data_requests` | DSGVO-Anfragen | INSERT (eigene) |

### Neue Spalten auf bestehenden Tabellen

- **offers**: `customer_visible`, `portal_published_at`, `portal_version`, `portal_pdf_hash`, `accepted_at`, `accepted_by_name`, `declined_at`, `declined_reason`
- **finance_contracts**: `customer_visible`, `signature_status`, `signed_pdf_path`, `contract_version`
- **device_maintenance**: `customer_visible` (default false → alte Datensätze nicht mehr im Portal, bis explizit freigegeben)
- **warranty_records** / **warranty_decisions**: `customer_visible`

### Zugriffsregeln (RLS)

Grundprinzip: Alle neuen Portal-Tabellen sind über `current_portal_customer_id()` gesperrt. Für Angebote, Verträge, Wartungen, Garantie und Serviceberichte gilt zusätzlich `customer_visible = true` — d.h. **nichts wird automatisch sichtbar**, ein Mitarbeiter muss aktiv freigeben.

Der Kunde kann RLS-technisch nur:
- eigene Angebote annehmen/ablehnen (INSERT in `customer_portal_offer_acceptances`)
- eigene Nachrichten und Threads anlegen
- eigene Wartungsanfrage anlegen
- eigene DSGVO-Anfrage anlegen
- eigene Benachrichtigung als gelesen markieren

Vertragssignatur, Angebotsversand-Bestätigung, Dokumentveröffentlichung, Benachrichtigungen an Kunden = ausschließlich über Edge Functions mit `service_role` (folgt in 2c).

### Storage

Neuer privater Bucket **`portal-uploads`** mit RLS auf `storage.objects`:
Kunde darf ausschließlich in `<customer_id>/…` schreiben/lesen — auch bei Kenntnis fremder Pfade kein Zugriff.

### Helper

- `public.is_portal_customer(uuid)` — kompakter RLS-Helper, `SECURITY DEFINER`, `search_path=public`, auf `authenticated`/`service_role` beschränkt.

## Rollback Sub-Phase 2a

```sql
DROP TABLE IF EXISTS
  public.customer_portal_data_requests,
  public.customer_portal_maintenance_requests,
  public.customer_portal_notifications,
  public.customer_portal_documents,
  public.customer_portal_messages,
  public.customer_portal_message_threads,
  public.customer_portal_contract_signatures,
  public.customer_portal_offer_acceptances CASCADE;

-- customer_visible-Spalten belassen (default false ⇒ kein Kundenzugriff)
DROP POLICY IF EXISTS portal_customer_select_own_offers ON public.offers;
DROP POLICY IF EXISTS portal_customer_update_own_offers ON public.offers;
DROP POLICY IF EXISTS portal_customer_select_own_warranty ON public.warranty_records;
DROP POLICY IF EXISTS portal_customer_select_own_warranty_decisions ON public.warranty_decisions;
DROP POLICY IF EXISTS portal_customer_select_own_maintenance ON public.device_maintenance;

DROP POLICY IF EXISTS portal_uploads_customer_select ON storage.objects;
DROP POLICY IF EXISTS portal_uploads_customer_insert ON storage.objects;
DROP POLICY IF EXISTS portal_uploads_customer_update ON storage.objects;
-- Bucket "portal-uploads" ggf. manuell entfernen.
```

## Nächste Schritte (offen)

- **Sub-Phase 2b — Kunden-UI**: neue Seiten Angebote/Verträge/Geräte-Detail/Garantie/Wartung/Nachrichten/Dokumente/Benachrichtigungen/Sicherheit, Dashboard-Ausbau, Slide-in-Menü mobil, `PORTAL_PHASE = 3`.
- **Sub-Phase 2c — Edge Functions & E-Mails**: `portal-offer-accept`, `portal-offer-decline`, `portal-contract-sign-otp`, `portal-contract-sign`, `portal-maintenance-request`, `portal-message-send`, `portal-document-download`, `portal-upload`, `portal-notify`, `portal-sessions` + Resend-Templates ohne sensiblen Inhalt.
- **Sub-Phase 2d — AlixWork-Admin, Sicherheitstests, Abschlussdoku**: Tab „Kundenportal 2.0" mit Sichtbarkeits-Toggles, 20 geforderte Sicherheitstests inkl. zweitem Test-Kunden, Rollback-Fahrplan.

Sag Bescheid, wenn 2b starten soll.
