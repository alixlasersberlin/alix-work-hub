# ALIX CONNECT · Web Suite (Phase 11)

Selbst-gehostetes Analyse- und Widget-System für beliebig viele Firmen-Webseiten. Alles auf Basis der bereits existierenden Tabellen `ac_websites` (25 Spalten inkl. `api_key`, `cookieless_analytics`, Branding, Öffnungszeiten) und `ac_analytics_events` (27 Spalten inkl. `visitor_hash`, `session_hash`, UTM, Geo, Device). Keine neuen Kern-Tabellen nötig.

## Umfang

1. Öffentlicher Tracker-Loader `connect.js` unter `/public`
2. Edge Function `ac-track` (öffentliche, gehashte Event-Aufnahme + Bot-Filter + Rate-Limit)
3. Aggregations-RPCs für Live/Historie
4. Website-Management UI mit CRUD und Snippet-Generator
5. Analytics-Dashboard pro Website
6. Datenschutz-Modus pro Website umschaltbar (Cookieless ↔ Consent)

## Datenschutz-Modell

Pro Website (Feld `cookieless_analytics`):

- **Cookieless (Default empfohlen):** Kein Cookie, `visitor_hash = sha256(ip + user_agent + daily_salt + website_id)`. Salt rotiert täglich, ist nicht rückrechenbar. Kein Consent-Banner nötig. Kein „wiederkehrender Besucher" über Tage.
- **Consent-Cookie:** Frontend setzt `_ac_vid` (1 Jahr, First-Party, SameSite=Lax) erst nach `AlixConnect.consent('granted')`. Erlaubt wiederkehrende Besucher und Cross-Session-Journey. Konsens muss die einbindende Webseite liefern (z. B. via Cookie-Banner-Callback).

Die Edge Function respektiert den Modus der Website: bekommt sie im Consent-Modus keinen Cookie-Wert, fällt sie automatisch auf Cookieless-Hash zurück.

## Module

### 1. Tracker-Loader `public/connect.js`

Vanilla-JS (~4 KB minified), SPA-fähig, keine Fremd-Deps.

- Init über `<script async src="…/connect.js" data-key="pub_…"></script>` oder `AlixConnect.init({ key })`.
- Auto-Tracking: `pageview` beim Laden und bei `history.pushState`/`popstate`, `scroll_depth` (25/50/75/100 %), `session_end` via `visibilitychange` + `sendBeacon`.
- API: `AlixConnect.track(event, meta)`, `AlixConnect.identify({ email, customer_id })`, `AlixConnect.consent('granted'|'denied')`, `AlixConnect.chat.open()`.
- Chat/Umfrage-Widget-Iframe wird bei `chat_enabled`/`surveys_enabled` lazy geladen (Hostet `/connect/widget?key=…`, folgt in Phase 12).
- DoNotTrack respektieren, Bots per UA-Heuristik nicht senden, `navigator.sendBeacon` für Session-Ende.

### 2. Edge Function `ac-track` (public, verify_jwt=false)

- POST-Body: `{ key, events: [...] }`. Öffentlicher `api_key` identifiziert die Website; niemals Service-Role exposed.
- Schritte pro Request: Website via `api_key` laden → wenn `status != active`: 200 no-op. Rate-Limit 60 req/min/IP über bestehendes `api_rate_limits`. Bot-Check (UA + `is_bot` Feld). IP hashen mit Tagessalt aus `app_settings` (Key `ac_track_salt_YYYYMMDD`, wird lazy erzeugt). Events batch-insert in `ac_analytics_events` mit `tenant_id` der Website. Geo/Device leicht aus Headern (`accept-language`, `cf-ipcountry`/`x-forwarded-*`, UA-Parsing via einfachem Regex).
- CORS offen (`*`), da Third-Party-Websites tracken.

### 3. Aggregations-RPCs

Als `SECURITY DEFINER` mit RLS-Check über `tenant_id`:

- `ac_web_live(_website_id uuid)` → `{ online_now, today, yesterday, week, month, year }` (online = distinct `visitor_hash` letzte 5 Min).
- `ac_web_top_pages(_website_id, _from, _to, _limit)` → Top-Seiten mit Views/Unique.
- `ac_web_top_referrers(_website_id, _from, _to)` und `ac_web_utm_breakdown(_website_id, _from, _to)`.
- `ac_web_daily_series(_website_id, _from, _to)` → Zeitreihe für Charts.

Bestehende SLA-/Reporting-Muster im Projekt werden wiederverwendet.

### 4. Website-Management UI `/connect/websites`

- Liste aller Domains der Mandanten (RLS-scoped), Status-Badge, Live-Besucher-Kachel.
- Dialog „Website hinzufügen": Domain, Projektname, Betreiber, Sprache, Farben, Logo, Öffnungszeiten (JSON-Editor), Datenschutz-/Impressum-URL, Toggles `chat_enabled` / `surveys_enabled` / `analytics_enabled` / `cookieless_analytics`.
- Auto-Generierung `api_key = 'pub_' || encode(gen_random_bytes(24),'base64')` beim Insert (DB-Trigger).
- Snippet-Panel mit One-Click-Copy:

```text
<script async src="https://alix-pro-hub.lovable.app/connect.js" data-key="pub_XXXX"></script>
```

### 5. Analytics-Dashboard `/connect/websites/:id/analytics`

Recharts + KPI-Tiles wie im bestehenden Reporting:

- KPI-Cockpit: Live-Besucher, Heute/Gestern/Woche/Monat/Jahr, Bounce, Ø Sitzungsdauer, Chat-Starts.
- Zeitreihe (Line): Besucher/Views 30 Tage.
- Top-Seiten, Top-Referrer, UTM-Breakdown (Table).
- Geräte / OS / Browser / Länder (Donuts).
- Live-Feed: letzte 20 Events (Realtime-Kanal auf `ac_analytics_events`).
- CSV-Export vorhanden über bestehendes Muster.
- Heatmap/Funnel als Platzhalter-Card („folgt in Phase 12 mit Widget"), nicht implementiert, um Scope zu halten.

### 6. Navigation

`/connect/websites` bekommt in `AlixConnectLayout` einen zweiten Sub-Eintrag „Analytics", damit das Menü nicht neu strukturiert werden muss. Layout-Badge bleibt Phase 10 → wird nach Rollout auf „Phase 11 · Web Suite" gesetzt.

## Technisches

- Neue Edge Function: `supabase/functions/ac-track/index.ts` (verify_jwt=false, CORS `*`, Zod-Validierung, Batch-Insert, IP-Hash mit Tagessalt aus `app_settings`).
- Neue RPCs via Migration: `ac_web_live`, `ac_web_top_pages`, `ac_web_top_referrers`, `ac_web_utm_breakdown`, `ac_web_daily_series` (SECURITY DEFINER, `search_path=public`, Tenant-Check über `has_role`/`user_tenant_access`).
- Trigger auf `ac_websites`: `BEFORE INSERT` erzeugt `api_key` wenn NULL.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_analytics_events;` (nur für Live-Feed im Admin).
- Neue Datei `public/connect.js` (Vanilla, keine Bundler-Abhängigkeit) + Route-Handler nicht nötig, Vite serviert `public/` direkt.
- Neue Pages `src/pages/AlixConnect/Websites.tsx` (Liste + Detail-Dialog) und `WebsiteAnalytics.tsx`.
- Routing in bestehender Router-Datei `src/pages/AlixConnect/*` registrieren.

## Nicht Teil dieser Phase

- Chat-/Umfrage-Widget als sichtbares Iframe (Phase 12: `connect/widget`).
- Heatmap-Rendering (Client-Recording), Funnel-Editor, Bot-Verifikation via reCAPTCHA.
- WhatsApp Cloud API, 3CX (separate Folgephasen).

## Verifikation vor Abschluss

- Test-Snippet auf einer Preview-Domain einbinden, `pageview`/`scroll_depth` prüfen.
- Rate-Limit greift bei > 60 req/min.
- Umschalten `cookieless_analytics` an einer Website: kein `_ac_vid`-Cookie wird gesetzt, Events landen weiterhin mit Hash.
- Analytics-Dashboard zeigt Live-Besucher innerhalb 5 s (Realtime + Polling-Fallback 15 s).
- Security-Scan nach der Migration ausführen und nur Findings der Web Suite fixen.
