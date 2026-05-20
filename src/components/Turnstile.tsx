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
  theme?: 'light' | 'dark' | 'auto';
}

export default function Turnstile({ onToken, onExpire, theme = 'dark' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled) return;
      const wait = setInterval(() => {
        if (window.turnstile && ref.current && !widgetId.current) {
          clearInterval(wait);
          widgetId.current = window.turnstile.render(ref.current, {
            sitekey: SITE_KEY,
            theme,
            callback: (token: string) => onToken(token),
            'expired-callback': () => { onExpire?.(); },
            'error-callback': () => { onExpire?.(); },
          });
          setReady(true);
        }
      }, 100);
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="flex justify-center" data-ready={ready} />;
}
