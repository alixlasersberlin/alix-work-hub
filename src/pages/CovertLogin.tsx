import { useEffect } from 'react';
import Login from './Login';

/**
 * Verdeckte Login-Aliasse (/alix-control, /alix-secure, /alix-enterprise).
 * Rendert exakt die bestehende Login-Komponente, setzt aber zusätzlich
 * robots noindex/nofollow per <meta>. Keine Änderung am Login-Flow selbst.
 */
export default function CovertLogin() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive, nosnippet';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Secure Access';
    return () => {
      document.head.removeChild(meta);
      document.title = prevTitle;
    };
  }, []);
  return <Login />;
}
