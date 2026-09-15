---
name: GoBD Organisatorischer Abschluss – Besetzungsregeln
description: Verantwortliche/Vertretung, Vier-Augen-Prinzip und Trennung organisatorischer Vertretung von technischen Rechten unter /finance/gobd/abschluss
type: feature
---

- Verantwortliche Person und Vertretung dürfen pro Bereich NICHT identisch sein.
- Vier-Augen-Prüfung und Löschfreigabe müssen von unterschiedlichen Personen freigegeben werden.
- Ablauf: Verantwortlichkeiten bestätigen → Einzelfreigaben → Gesamtfreigabe → Abschlussbericht erzeugen
  → prüfen, dass Status „FREIGEGEBEN“, Zeitstempel, Version und SHA-256-Prüfsumme festgeschrieben sind.
- Sieben Bereiche: Gesamtverantwortung, Rechnungswesen, Rechnungsnummern, Verfahrensdokumentation,
  Berechtigungen, Datensicherung, Aufbewahrung.

## Besetzung (Stand 15.09.2026)
| Bereich | Verantwortlich | Vertretung | Bestätigt durch |
|---|---|---|---|
| Gesamtverantwortung | Dieter Eitner | Kenny Duc Trinh | Dieter Eitner |
| Rechnungswesen | Dieter Eitner | Kenny Duc Trinh | Ronny D. Eitner |
| Rechnungsnummern | Dieter Eitner | Ronny D. Eitner | Kenny Duc Trinh |
| Verfahrensdokumentation | Dieter Eitner | Ronny D. Eitner | Kenny Duc Trinh |
| Berechtigungen | Dieter Eitner | Lars Scheidler | Ronny D. Eitner |
| Datensicherung | Lars Scheidler | Ronny D. Eitner | Dieter Eitner |
| Aufbewahrung | Dieter Eitner | Kenny Duc Trinh | Ronny D. Eitner |

- Walla El-Issa ist vollständig aus dem GoBD-Verantwortungskonzept entfernt und darf nicht wieder eingetragen werden.
- Dieter Eitner ist oberste verantwortliche Instanz.
- Kenny Duc Trinh: nur organisatorische Vertretung, KEIN Super Admin (Rolle „Admin“), keine eigenständige Änderung
  geschützter Systemeinstellungen, Berechtigungen oder unveränderbarer GoBD-Nachweise.
- Organisatorische Vertretung ≠ technische Berechtigung: GoBD-Freigaben (`gobd_record_approval`) bleiben Super Admin
  vorbehalten, Pflege der Verantwortlichkeiten (`gobd_set_responsibility`) ist Admin/Super Admin.
- Vier-Augen-Prinzip: Dieter Eitner + Ronny D. Eitner. Bei Löschfreigaben darf Dieter Eitner nicht gleichzeitig
  Antragsteller und alleiniger Freigeber sein.
- E-Mail-Adressen sind noch offen und werden vom Kunden nachgereicht.
