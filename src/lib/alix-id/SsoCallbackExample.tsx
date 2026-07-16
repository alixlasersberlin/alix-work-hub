// Alix ID — Referenz-Callback-Komponente
// -----------------------------------------------------------------------------
// Diese Datei wird 1:1 in die Ziel-App (AlixSmart, Academy, ...) übernommen
// und dort als Route `/sso/callback` gemountet. Sie zeigt die minimale,
// korrekte Verwendung von `createAlixIdClient().completeLogin()`.
//
// Voraussetzungen in der Ziel-App:
//   - `src/lib/alix-id/sso-client.ts` (aus Alix ID kopiert)
//   - Route: <Route path="/sso/callback" element={<SsoCallback />} />
//   - `startLogin()` wurde vorher auf der Login-Seite ausgelöst.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createAlixIdClient, type AlixIdSession } from './sso-client';

// Konfiguration — pro App anpassen:
const ALIX_ID_ISSUER = 'https://id.alixwork.de';
const APP_KEY = 'alixsmart';
const REDIRECT_URI = `${window.location.origin}/sso/callback`;

export default function SsoCallback() {
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AlixIdSession | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const client = createAlixIdClient({
      issuer: ALIX_ID_ISSUER,
      appKey: APP_KEY,
      redirectUri: REDIRECT_URI,
    });

    client
      .completeLogin()
      .then((s) => {
        setSession(s);
        // Access-Token NICHT im LocalStorage ablegen.
        // Empfohlen: an eigenen Backend/Edge-Endpoint posten → HttpOnly-Cookie.
        // Anschließend zur Ziel-Route navigieren:
        const state = s.state as { returnTo?: string } | null;
        const returnTo = state?.returnTo ?? '/';
        window.location.replace(returnTo);
      })
      .catch((e: Error) => {
        setError(e.message);
      });
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Anmeldung fehlgeschlagen</h1>
          <p style={{ color: '#666', fontSize: 14 }}>{error}</p>
          <a href="/" style={{ display: 'inline-block', marginTop: 16 }}>
            Zur Startseite
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <p style={{ color: '#666' }}>
        {session ? 'Anmeldung erfolgreich, wird weitergeleitet…' : 'Anmeldung wird abgeschlossen…'}
      </p>
    </div>
  );
}
