# Rollen- und Berechtigungsmatrix / benötigte Testkonten

Stand 28.11.2026: 43 Rollen in `roles`, Zuweisung über `user_roles.role_id`. Die automatisierten Fälle stehen in `docs/security-master-v6/role-test-matrix.csv` (301 Fälle, alle `external_authenticated_test_pending`).

## Benötigte Testkonten (je ein eigenes, aktives Konto, MFA eingerichtet, keine echten Kundendaten)
| Testkonto | Rolle(n) | Firma | Prüft |
|---|---|---|---|
| sec-test-superadmin | Super Admin | DE | Löschen, Freigaben, Security Center |
| sec-test-admin | Admin | DE | Kein Löschen, keine Super-Admin-Freigaben |
| sec-test-buchhaltung | Buchhaltung Admin | DE | Finanzen nur eigene Firma |
| sec-test-fibu | FIBU LIGHT | DE | Nur OP-Light-Funktionen |
| sec-test-vertrieb | Angebotsersteller | DE | Nur eigene Angebote/Leads |
| sec-test-anfragen | Verkaufsanfragen lesen | DE | Lesen ohne Schreiben |
| sec-test-order | Order | DE | Operativ, kein Löschen |
| sec-test-technik | Reparaturannahme | DE | Reparaturen ohne Finanzen |
| sec-test-support | After Sales, Tickets erstellen | DE | Tickets, keine fremden Vorgänge |
| sec-test-qm | QM | DE | Nur Bug & CAPA / ISO |
| sec-test-at | Österreich | AT | Nur Alix-Austria-Daten (Firmengrenze) |
| sec-test-readonly | Read Only Audit | DE | Nur lesen, Notizen anlegen |
| sec-test-lieferant | Lieferant | – | Nur freigegebene Bestellungen |
| sec-test-gesperrt | beliebig, Konto deaktiviert | DE | Gesperrte Konten werden abgewiesen |

Zusätzlich ohne Konto: anonymer Besucher und Kundenportal (Auftragsnummer + PLZ + E-Mail eines Testauftrags).

## Prüfregeln
- Horizontal: Konto A darf Datensätze von Konto B/Firma B weder lesen noch ändern.
- Vertikal: niedrigere Rolle darf keine Admin-/Super-Admin-Aktionen ausführen.
- Firmenübergreifend: DE-Konto sieht keine AT-Daten und umgekehrt.
- Keine Umgehung der Anmeldung, keine Verwendung administrativer Schlüssel als Ersatz.
