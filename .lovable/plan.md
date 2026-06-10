# Alix-Finance Phase 1 – Finance Foundation

Rein **additive** Erweiterung. Keine bestehenden Tabellen, Spalten, Policies, Funktionen oder UI-Module werden verändert. Alle SQL-Migrationen verwenden `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. Keine `DROP`, kein `DELETE` ohne `WHERE`.

## Scope dieser Phase
Nur Fundament. **Keine** DATEV, **keine** Mahnungen, **keine** Zoho-Sync, **keine** Gerätesperren-Logik – nur Strukturen/UI-Platzhalter.

## 1. Datenbank (neue Migration, additiv)

### Neue Tabellen (alle in `public`, mit GRANTs + RLS)

**`finance_accounts`** – 1 pro Kunde
- `id`, `customer_id` (FK customers, unique), `debtor_number`, `payment_terms`, `credit_limit numeric`, `current_balance numeric default 0`, `overdue_balance numeric default 0`, `reminder_level int default 0`, `blocked boolean default false`, `last_payment_at`, `last_reminder_at`, `notes`, `created_at`, `updated_at`

**`finance_contracts`**
- `id`, `customer_id`, `order_id` (nullable, FK orders), `device_id` (nullable, FK lager_devices), `contract_number unique`, `contract_type` (Kauf|Leasing|Mietkauf|Ratenzahlung|Servicevertrag), `start_date`, `end_date`, `monthly_rate numeric`, `remaining_amount numeric`, `status` (aktiv|beendet|gekündigt|entwurf), `notes`, `created_at`, `updated_at`

**`finance_transactions`**
- `id`, `customer_id`, `order_id`, `device_id`, `contract_id`, `amount numeric`, `currency default 'EUR'`, `booking_date date`, `reference text`, `transaction_type` (Rechnung|Anzahlung|Zahlung|Gutschrift|Mahngebühr|Zinsen|Sonstiges), `notes`, `created_at`

**`finance_history`** – Audit, append-only
- `id`, `table_name`, `record_id`, `user_id`, `action`, `old_value jsonb`, `new_value jsonb`, `created_at`
- Trigger auf `finance_accounts`, `finance_contracts`, `finance_transactions` (INSERT/UPDATE/DELETE → row in `finance_history`).
- RLS verbietet UPDATE/DELETE für alle (nur SELECT für Finance-Rollen, INSERT nur via SECURITY DEFINER Trigger).

### Additive Spalten auf bestehenden Tabellen

**`orders`** (nur `ADD COLUMN IF NOT EXISTS`, **keine** Veränderung bestehender Felder):
- `finance_total_amount`, `finance_deposit_amount`, `finance_remaining_amount`, `finance_open_amount`, `finance_paid_amount`, `finance_overdue_amount` (numeric), `finance_payment_status` text

**`lager_devices`** (additiv):
- `finance_contract_number`, `finance_status`, `finance_invoice_status`, `finance_payment_status`, `finance_block_status`, `finance_open_amount numeric`

Alle Felder nullable, Defaults `NULL`/`0`. Bestehende Queries bleiben unberührt.

### RLS / Rollen
Neue Helper-Function `can_access_finance_module()`:
- Voll: `Super Admin`, `Admin`, `Finance`, `Geschäftsführung`
- Read-only: `Kundenservice`, `Serviceleitung`
- Sonst: kein Zugriff

Policies pro neuer Tabelle:
- SELECT: `can_access_finance_module()` ODER Read-only-Rollen
- INSERT/UPDATE: nur Voll-Zugriff
- DELETE: nur `Super Admin` (Memory-Regel)
- `finance_history`: SELECT nur Voll-Zugriff, kein INSERT/UPDATE/DELETE aus App (nur Trigger)

GRANTs: `authenticated` + `service_role` (kein `anon`).

## 2. Frontend

### Neue Menügruppe „Finance" (in `AppLayout.tsx`, additiv)
Bestehender `/finance`-Eintrag bleibt; neue Gruppe ergänzt Unterpunkte:
- `/finance/dashboard` – KPI-Platzhalter (offene/überfällige Forderungen, Anzahlungen, Verträge, Raten, Eingänge)
- `/finance` (bestehend) – Forderungen
- `/finance/anzahlungen` – Liste der Transaktionen Typ „Anzahlung"
- `/finance/vertraege` – CRUD finance_contracts
- `/finance/zahlungen` – Liste finance_transactions Typ „Zahlung"
- `/finance/mahnwesen` – Platzhalter „Phase 3"
- `/finance/datev` – Platzhalter „Phase 4"
- `/finance/geraetesperren` – bestehende Seite verlinken
- `/finance/einstellungen/systemstatus` – Status-Karten (Zoho/DATEV/Mahnwesen/Bankimport/Sperren = „vorbereitet")

Sichtbarkeit per Rollen-Guard. Bestehende Routen bleiben unangetastet.

### Kunde – neuer Tab „Finanzakte"
In bestehender Kundendetailseite zusätzlicher Tab, der `finance_accounts` zum Kunden liest/anlegt (auto-create on first view, falls Finance-Rolle).

### Auftrag – neuer Bereich „Finanzen"
Read-only Anzeige der neuen `finance_*`-Felder + Liste verknüpfter `finance_transactions`.

### Geräteakte – neuer Tab „FINANZEN"
Platzhalter mit Anzeige der neuen Felder + verknüpfter Vertrag (falls vorhanden).

### Service-Layer
`src/lib/finance/api.ts`:
- `getFinanceAccount`, `createFinanceAccount`, `updateFinanceAccount`
- `getContract`, `createContract`, `updateContract`, `listContracts`
- `createTransaction`, `updateTransaction`, `getTransactions`

Hook `useFinancePermissions()` analog zu `useRepairPermissions`.

## 3. Audit
Trigger schreiben automatisch in `finance_history`. Zusätzlich `audit_logs`-Eintrag über bestehenden `audit_trigger_fn` durch Anbinden an die drei neuen Tabellen (nutzt vorhandene Infrastruktur).

## 4. Abschlusskriterien
- [ ] 4 neue Tabellen + Trigger + RLS
- [ ] Additive Spalten auf `orders` und `lager_devices`
- [ ] Helper `can_access_finance_module`
- [ ] Menügruppe Finance mit allen Unterpunkten (Platzhalter wo nötig)
- [ ] Tabs „Finanzakte" (Kunde), „Finanzen" (Auftrag), „FINANZEN" (Gerät)
- [ ] `src/lib/finance/api.ts` Service-Layer
- [ ] Keine bestehende Funktion verändert / kein Test gebrochen

## Technische Details

```text
SQL-Migration:
  1) CREATE TABLE IF NOT EXISTS finance_accounts (...)
  2) GRANT SELECT,INSERT,UPDATE,DELETE TO authenticated; GRANT ALL TO service_role;
  3) ALTER TABLE ... ENABLE RLS; CREATE POLICY ...
  (gleich für finance_contracts, finance_transactions, finance_history)
  4) CREATE OR REPLACE FUNCTION can_access_finance_module()
  5) ALTER TABLE orders ADD COLUMN IF NOT EXISTS finance_*
  6) ALTER TABLE lager_devices ADD COLUMN IF NOT EXISTS finance_*
  7) CREATE TRIGGER finance_history_trg ... (SECURITY DEFINER)
  8) Attach existing audit_trigger_fn to new tables
```

Soll ich so umsetzen? Wenn ja, starte ich mit der Migration und danach UI + Service-Layer.
