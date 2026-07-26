import { useEffect } from 'react';

// /book → https://ticket.alix-operation.de (permanenter Redirect)
// Hinweis: In einer SPA ist kein echter HTTP-301 möglich; wir setzen einen
// harten Client-Redirect via location.replace, damit die URL im Verlauf
// nicht zurückführt. Suchmaschinen werden per <meta http-equiv="refresh">
// als zusätzlicher Hinweis bedient.
const TARGET = 'https://ticket.alix-operation.de';

export default function BookRedirect() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${TARGET}`} />
      <noscript>
        <a href={TARGET}>Weiter zum Ticket-Portal</a>
      </noscript>
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        Weiterleitung zu <a href={TARGET}>{TARGET}</a> …
      </div>
    </>
  );
}
