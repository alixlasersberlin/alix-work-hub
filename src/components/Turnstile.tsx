import { useEffect, useRef, useState } from 'react';

const SITE_KEY = '0x4AAAAAADTSYFDjvq4rKJlT';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return scriptLoading;
}

interface Props {
  onToken: (token: string) => void;
  onExpire?: () => void;
  /** Wird aufgerufen, wenn das Captcha nicht geladen/gelöst werden kann. */
  onUnavailable?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

export default function Turnstile({ onToken, onExpire, onUnavailable, theme = 'dark' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let waitInterval: number | null = null;
    let solved = false;
    // Fail-open: Wenn Cloudflare das Widget nicht laden/lösen kann
    // (Netzwerk blockiert, Domain nicht freigegeben, Fehler 300030),
    // darf der Login nicht dauerhaft blockiert bleiben.
    const failTimer = window.setTimeout(() => {
      if (!cancelled && !solved) onUnavailable?.();
    }, 8000);

    loadScript().then(() => {
      if (cancelled) return;
      waitInterval = window.setInterval(() => {
        if (cancelled) {
          if (waitInterval !== null) { clearInterval(waitInterval); waitInterval = null; }
          return;
        }
        if (window.turnstile && ref.current && !widgetId.current) {
          if (waitInterval !== null) { clearInterval(waitInterval); waitInterval = null; }
          try {
            widgetId.current = window.turnstile.render(ref.current, {
              sitekey: SITE_KEY,
              theme,
              callback: (token: string) => { solved = true; onToken(token); },
              'expired-callback': () => { solved = false; onExpire?.(); },
              'error-callback': () => { solved = false; onExpire?.(); onUnavailable?.(); },
            });
          } catch {
            onUnavailable?.();
          }
          setReady(true);
        }
      }, 100);
    }).catch(() => onUnavailable?.());

    return () => {
      cancelled = true;
      clearTimeout(failTimer);
      if (waitInterval !== null) { clearInterval(waitInterval); waitInterval = null; }
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="flex justify-center" data-ready={ready} />;
}
