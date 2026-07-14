import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/theme-neo.css";
import { bootUiTemplate } from "./hooks/useUiTemplate";
import { bootInfinityTheme } from "./hooks/useInfinityTheme";
import { bootA11yPrefs } from "./hooks/useA11yPrefs";
import { bootAIBackground } from "./hooks/useAIBackground";
import { bootPageFade } from "./hooks/usePageFade";
import { bootTheme } from "./hooks/useTheme";

bootTheme();
bootUiTemplate();
bootInfinityTheme();
bootA11yPrefs();
bootAIBackground();
bootPageFade();

// app.alixwork.de → dedizierte Kalender-Domain.
// Ohne aktive Supabase-Session direkt auf /alix-control (Login), sonst auf /m/kalender.
if (typeof window !== 'undefined' && window.location.hostname === 'app.alixwork.de') {
  const p = window.location.pathname;
  const isRoot = p === '/' || p === '';
  const isLoginAlias = p === '/alix-control' || p === '/alix-secure' || p === '/alix-enterprise';
  if (isRoot) {
    let hasSession = false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const v = localStorage.getItem(k);
          if (v && v.length > 20) { hasSession = true; break; }
        }
      }
    } catch { /* Storage evtl. blockiert */ }
    const target = hasSession ? '/m/kalender' : '/alix-control';
    window.history.replaceState(null, '', target + window.location.search + window.location.hash);
  } else if (!isLoginAlias) {
    // ProtectedRoute leitet unauth. Nutzer selbst auf /alix-control – hier nichts weiter tun.
  }
}


// Native (Capacitor) Shell-Init – nur wenn App in iOS/Android-Wrapper läuft.
(async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
    ]);
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0F172A' }).catch(() => {});
    await SplashScreen.hide().catch(() => {});
    // Start-Route in nativer Shell auf Kalender fixieren
    if (location.pathname === '/' || location.pathname === '') {
      history.replaceState(null, '', '/m/kalender');
    }
  } catch {
    /* Capacitor nicht verfügbar */
  }
})();



// Workaround for React bug with browser translation extensions (Google Translate, etc.)
// See: https://github.com/facebook/react/issues/11538
if (typeof Node === "function" && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== "undefined") {
        console.warn("Cannot remove a child from a different parent", child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, [child]) as T;
  } as typeof Node.prototype.removeChild;

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== "undefined") {
        console.warn("Cannot insert before a reference node from a different parent", referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
  } as typeof Node.prototype.insertBefore;
}

createRoot(document.getElementById("root")!).render(<App />);
