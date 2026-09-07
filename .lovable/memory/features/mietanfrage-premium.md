---
name: ALIX Premium Mietanfrage
description: Öffentlicher Miet-Wizard /miete/premium im Design von /beratung/premium, Product Hub als einzige Preisquelle, Speicherung in sales_leads
type: feature
---
- Routen: `/miete` → Redirect auf `/miete/premium`, Bestätigung `/miete/premium/erfolgreich` (noindex). Komponenten: `src/components/PremiumRentalWizard.tsx`, Seiten `src/pages/PublicMietanfrage.tsx`, `src/pages/PublicMietanfrageErfolg.tsx`.
- 7 Schritte: Gerät · Mietmodell · Unternehmen · Kontaktdaten · Anschrift · Angaben · Prüfung. Design/Abstände/Sticky-Bottom identisch zu `PremiumSalesWizard`.
- Edge Functions (verify_jwt=false): `rental-devices` (öffentliche Geräteliste, Mietpreise/Kaution/Laufzeiten nur aus `ph_products.price_countries`), `rental-request-submit` (Turnstile, serverseitige Neuberechnung des Preis-Snapshots, Kundenmatching E-Mail → Telefon → Firma, Anfragenummer `MIET-…`).
- Kein zweites CRM: Speicherung in `sales_leads` mit `source='ALIX Mietanfrage'`, `lead_status='NEUE MIETANFRAGE'`, Snapshot-Daten in `metadata.rental`; Snapshot fließt nie zurück in den Product Hub.
- Deep-Links von alix-lasers.de: `/miete/premium?product_id=<PH-ID>` – URL nur zur Vorauswahl, Preise werden immer serverseitig neu geprüft. Keine PII über URL-Parameter.
