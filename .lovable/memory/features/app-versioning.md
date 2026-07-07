---
name: App Versioning
description: AlixWork version bump rule — increment APP_VERSION in src/components/AppLayout.tsx by 0.01 on every publish
type: preference
---
Regel: Bei jeder Änderung, die publiziert wird, `APP_VERSION` in `src/components/AppLayout.tsx` um 0.01 erhöhen (z.B. 5.01 → 5.02 → 5.03). Startversion war 5.0. Format: String mit zwei Nachkommastellen ('5.01', nicht '5.1').

**How to apply:** Vor jedem Publish/Update-Schritt den Wert der Konstante `APP_VERSION` inkrementieren.
