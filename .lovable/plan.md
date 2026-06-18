## Ziel

Ab sofort bekommt **jeder neue Vorgang beim Anlegen eines Angebots** eine **einzige fortlaufende Stammnummer** (Case). Alle Folge-Dokumente (Auftragsbestätigung, Lieferschein, Rechnung, Gutschrift, Reparatur, Produktion, Mahnung usw.) übernehmen diese Stammnummer und unterscheiden sich nur durch ihren **Präfix** als Suffix-Quelle.

```text
Angebot              ANG-2026-04217
Auftragsbestätigung  AB-2026-04217
Lieferschein         LS-2026-04217
Rechnung             RG-2026-04217
Gutschrift           GU-2026-04217
Reparatur            REP-2026-04217
Produktion           PRD-2026-04217
Mahnung Stufe 2      MA-2026-04217-M2
```

Bestehende Vorgänge bleiben **unverändert** – nur Neuanlagen ab Aktivierung erhalten eine Case-Nummer.

## Konzept

1. Neuer „Master"-Kreis `case` in `number_ranges` (Format z. B. `{YYYY}-{00000}`). Liefert die Stammnummer.
2. Pro Kreis ein neues Flag `inherit_case` (boolean). 
   - `false` (Default) = bisheriges Verhalten (eigener Zähler).
   - `true` = Dokumentnummer wird aus `prefix + sep + caseNumber` gebildet, **ohne** den eigenen Zähler zu erhöhen.
3. Stammnummer wird im Datensatz gespeichert (`offers.case_number`, `orders.case_number`) und an alle Folgevorgänge vererbt.
4. Im Frontend gibt es **einen** Helper `nextDocumentNumber(code, { caseNumber, fallback })`, der je nach Modus die richtige Nummer liefert.

## Datenmodell-Änderungen (Migration)

```text
ALTER TABLE public.number_ranges
  ADD COLUMN inherit_case boolean NOT NULL DEFAULT false;

ALTER TABLE public.offers ADD COLUMN case_number text;
ALTER TABLE public.orders ADD COLUMN case_number text;
CREATE INDEX ON public.offers (case_number);
CREATE INDEX ON public.orders (case_number);

-- Seed: Master-Kreis "case"
INSERT INTO public.number_ranges (code, label, prefix, separator,
       include_year, padding, start_value, current_value,
       reset_yearly, active, inherit_case)
VALUES ('case','Vorgangs-Stammnummer','', '-', true, 5, 0, 0, true, false, false)
ON CONFLICT DO NOTHING;
```

Neue RPCs:

- `next_case_number()` → vergibt eine neue Stammnummer aus dem Kreis `case` (atomar, Jahresreset).
- `next_document_number(p_code, p_case_number text DEFAULT NULL)` 
  - wenn der Kreis `inherit_case = true` ist **und** `p_case_number` übergeben wurde:
    Rückgabe = `prefix || separator || p_case_number`, **ohne** `current_value` zu inkrementieren.
  - sonst Verhalten wie heute.

## Frontend-Änderungen

### Helper `src/lib/number-ranges.ts`

```text
nextDocumentNumber(code, { caseNumber?, fallback })  // ersetzt nextNumber-Aufrufe schrittweise
ensureCaseNumber(existing?) : Promise<string>        // gibt vorhandene Case-Nr zurück oder zieht eine neue
```

`nextNumber(code, fallback)` bleibt rückwärtskompatibel als Wrapper.

### Anlage-Stellen

- `src/pages/AngebotErstellen.tsx`: Beim **Neu-Anlegen** eines Angebots:
  1. `caseNumber = await ensureCaseNumber()`
  2. Offer-Nr = `nextDocumentNumber('offer', { caseNumber, fallback: legacy })`
  3. `case_number` ins Offer schreiben.
- `OrderConfirmationTab.tsx`, `DeliveryNoteTab.tsx`, Rechnungs-/Gutschrift-PDFs, Repair-/Production-PDFs, Mahnungen: ziehen `order.case_number` (Fallback: `offer.case_number` → über `offer_id`) und rufen `nextDocumentNumber(code, { caseNumber, fallback })`.
- Konvertierung Angebot → Auftrag (`convert-signed-offer-to-order` Edge Function + UI): `case_number` vom Angebot in den Auftrag übernehmen.

### Admin-UI `Nummernkreise.tsx`

- Neuer Schalter pro Zeile: **„An Vorgangsnummer koppeln"** (`inherit_case`).
- Vorschau zeigt im Suffix-Modus z. B. `AB-<Stammnummer>` statt `AB-2026-00001`.
- Wenn `inherit_case = true`, sind „Stellen", „Startwert", „aktueller Wert" ausgegraut.

## Rückwärtskompatibilität

- `number_ranges.active = false` → wie bisher Legacy-Logik.
- `inherit_case = false` → eigener Zähler wie bisher.
- Bestehende Aufträge/Angebote ohne `case_number` → Helper fällt automatisch auf den unabhängigen Modus zurück (keine Migration alter Daten).

## Lieferumfang dieses Schritts

1. Migration: `inherit_case`-Spalte, `case_number`-Spalten, neue Seeds + RPCs.
2. Helper-Erweiterung (`nextDocumentNumber`, `ensureCaseNumber`).
3. UI-Schalter „An Vorgangsnummer koppeln" in `Nummernkreise.tsx`.
4. Integration in **Angebotsanlage** (Case-Generierung) und **Auftragsbestätigung** (Suffix-Modus) – sofort sichtbarer Effekt.
5. Konvertierung Angebot → Auftrag übernimmt `case_number`.
6. Restliche Dokument-Tabs (Lieferschein, Rechnung, Gutschrift, Reparatur, Produktion, Mahnung) werden im Anschluss in derselben Form nachgezogen.
