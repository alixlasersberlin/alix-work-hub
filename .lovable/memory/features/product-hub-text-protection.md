---
name: Product Hub – geschützte Beschreibungstexte
description: Kurz-/Langbeschreibung von ph_products darf nur Super Admin ändern; vor Überschreiben Warnhinweis mit Bestätigung
type: feature
---

- Kurzbeschreibung (`short_description`) und Langbeschreibung (`long_description`) im Product Hub sind **geschützte Texte**.
- Nur **Super Admin** darf sie bearbeiten; für alle anderen Rollen sind die Felder gesperrt (Hinweisbox im Reiter „Beschreibungen").
- Vor dem Speichern erscheint eine Warn-/Bestätigungsabfrage („Geschützte Texte überschreiben?"), Abbrechen setzt die Texte auf den geladenen Stand zurück.
- Umgesetzt in `src/pages/ProductHub/ProductEditor.tsx` (`isSuperAdmin`, `original`, `confirmTexts`, `changedProtectedTexts`, `doSave`).
- **Wichtig auch für Wartungs-/SQL-Aktionen und Importe:** diese Texte nie ohne Rückfrage beim Super Admin überschreiben (am 05.09.2026 wurden 34 Geräte versehentlich per Systemänderung überschrieben und aus `ph_field_history` wiederhergestellt).
