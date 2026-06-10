---
name: Finance Phase 14 — Treasury + Procure-to-Pay + Steuer/Meldewesen
description: Treasury (Bankkonten, Liquidität, Zahlungsfreigaben), P2P (Anforderung → Bestellung → Wareneingang → 3-Way-Match), Meldewesen (UStVA/ZM/OSS/Intrastat/E-Bilanz Exporte). Neue Tabellen finance_bank_accounts, finance_liquidity_entries, finance_payment_approvals, finance_purchase_requisitions/_items, finance_purchase_orders/_items, finance_goods_receipts, finance_three_way_matches, finance_tax_filings/_lines. Edge Function finance-tax-export. Seiten /finance/treasury, /finance/p2p, /finance/meldewesen.
type: feature
---

## Treasury
- `finance_bank_accounts` (tenant, IBAN, Saldo, Verfügbar)
- `finance_liquidity_entries` (Konto + Datum, Eröffnung/Zufluss/Abfluss/Schluss)
- `finance_payment_approvals` (Empfänger, Betrag, Status: pending/approved/rejected/paid)

## P2P
- `finance_purchase_requisitions` (PR-Nr. auto `PR-YYYY-00001`) + `_items`
- `finance_purchase_orders` (PO-Nr. auto `PO-YYYY-00001`) + `_items` (received_quantity)
- `finance_goods_receipts` (po_id, po_item_id, quantity)
- `finance_three_way_matches` (po_amount, received_amount, invoiced_amount, variance_amount generated)

## Meldewesen
- `finance_tax_filings` (filing_type ustva|zm|oss|intrastat|ebilanz, period_value, payload jsonb, export_format, export_content)
- `finance_tax_filing_lines`
- UNIQUE (tenant_id, filing_type, period_value); Edge Function überschreibt vorhandene Meldung idempotent.

## Edge Function
`finance-tax-export` (POST, JWT, Rollen Super Admin/Admin/GF/Finance):
- Body: `{ filing_type, period_value, tenant_id?, notes? }`
- period_value: `YYYY-MM` | `YYYY-Qn` | `YYYY`
- Erzeugt UStVA als XML-Stub, ZM/OSS/Intrastat als CSV, E-Bilanz als XML.

## RBAC
- Lesen/Schreiben: Super Admin, Admin, Geschäftsführung, Finance
- Löschen: ausschließlich Super Admin

## UI
- `/finance/treasury` — Tabs Bankkonten | Liquidität | Zahlungsfreigaben
- `/finance/p2p` — Tabs Anforderungen | Bestellungen | Wareneingänge | 3-Way-Match
- `/finance/meldewesen` — Tab je Meldungstyp + Download des erzeugten Exports
