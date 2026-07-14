# Phase 10b — MFA & Re-Auth (Zero-Trust Stufe 2)

## Ausgangslage
Das Projekt nutzt bereits **Supabase Native MFA** (TOTP) mit vollständiger Setup-,
Challenge- und Recovery-UI. MFA ist laut `src/lib/mfa-required.ts` für alle
Rollen außer „Lieferant Jerry" verpflichtend. Der echte Gap war der Re-Auth-Flow
vor sensiblen Aktionen — der bisherige `ReauthDialog` zeigte nur einen
"deaktiviert"-Hinweis.

## Umgesetzt

### 1. Datenbank
- `mfa_reauth_events` (user_id, method, purpose, verified_at, expires_at, ip_hint, user_agent) — server-seitige, kurzlebige Re-Auth-Nachweise.
- `mfa_recovery_codes`, `mfa_webauthn_credentials` — Grundgerüst für spätere Passkey-Erweiterung (aktuell ungenutzt).
- `user_mfa_secrets` um TOTP-Felder erweitert (falls wir später von Supabase-nativ auf eigene TOTP-Implementierung umsteigen).
- `user_profiles`: neue Spalten `mfa_grace_until`, `mfa_exempt`, `mfa_exempt_reason`, `mfa_exempt_by`.
- Bestandsschutz: Alle Super Admins/Admins bekamen automatisch 7 Tage Grace-Period gesetzt.
- SECURITY-DEFINER-Funktionen `mfa_required_for_user`, `mfa_status_for_user`, `has_valid_reauth` (Ausführungsrecht: authenticated + service_role).
- RLS: Nutzer sehen nur eigene MFA/Recovery/Reauth-Zeilen; nur Server (service_role) schreibt Recovery/Passkey; Nutzer darf eigene Passkeys löschen.

### 2. Frontend
- **`src/components/ReauthDialog.tsx`** neu geschrieben: fragt den 6-stelligen TOTP-Code ab, ruft `supabase.auth.mfa.challenge` + `verify`, schreibt bei Erfolg einen 5-Minuten-Nachweis in `mfa_reauth_events` **und** in sessionStorage.
- **`src/hooks/useReauthGate.tsx`** neu: `const { gate, dialogProps } = useReauthGate('purpose', 'reason?')` — gate(action) prüft Cache; wenn gültig, wird die Aktion direkt ausgeführt; sonst öffnet sich der Dialog.
- **`src/pages/GeraeteVerwaltung.tsx`** verdrahtet: „Freigeben", „Sperren", „Zurücksetzen" laufen jetzt durch das Reauth-Gate mit purpose `device.manage`.

## Noch TODO (nach Bedarf)
Der Reauth-Gate ist als `useReauthGate(purpose)` überall in 3 Zeilen einbaubar.
Sinnvolle nächste Anwendungen:
- Kundendetail-Öffnen (`src/pages/CustomerDetail.tsx`) mit purpose `customer.view`
- Finance SEPA-Freigabe (`src/pages/Finance/Sepa.tsx`) mit purpose `finance.sepa.approve`
- Rollen-Änderungen (`src/pages/RollenVerwaltung*.tsx`) mit purpose `role.change`
- Bug&CAPA-Löschen mit purpose `capa.delete`
- Order-Löschen (Super Admin) mit purpose `order.delete`

Sag Bescheid welche du gate-en willst, dann setze ich das in einem Rutsch um.

## Nicht enthalten (bewusst)
- WebAuthn/Passkey (Tabellen sind vorbereitet, aber Enrollment/Auth-Flow fehlt). Nächster Schritt wäre `@simplewebauthn/browser` + `@simplewebauthn/server` Edge Functions.
- Hartes Erzwingen der Grace-Period-Sperre nach Ablauf: der Grace-Wert wird gesetzt, aber der Router-Guard interpretiert ihn noch nicht separat — Supabase-MFA-Pflicht ist ohnehin schon aktiv.

---

# Phase 10a (bereits abgeschlossen)

Gerätefreigabe-Workflow, Offline-Wipe, Auto-Logout, Domain-Anleitung siehe Git-History.
