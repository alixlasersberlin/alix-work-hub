/**
 * App-Identität & Umgebungen für den mobilen Build (Prompt 6, Punkt 81–85).
 *
 * Es werden ausschliesslich öffentliche Client-Werte verwendet – niemals
 * Production-Secrets. Die Trennung erfolgt über die Vite-Umgebung und die
 * Supabase-URL des jeweiligen Bundles.
 */

export const APP_NAME = 'AlixWork';
export const APP_SUBTITLE = 'Mobile Command Center';

/** Vorschlag für den nativen Build – vor Verwendung im Store prüfen. */
export const IOS_BUNDLE_ID = 'de.alixwork.mobile';
export const ANDROID_PACKAGE = 'de.alixwork.mobile';

export const APP_VERSION_MOBILE = '1.0.0';
export const APP_BUILD = '100';

export type AppEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

function detectEnvironment(): AppEnvironment {
  if (import.meta.env.DEV) return 'DEVELOPMENT';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (/(^|\.)lovable(project)?\.app$/.test(host) || host.includes('staging') || host.includes('preview')) return 'STAGING';
  return 'PRODUCTION';
}

export const ENVIRONMENT: AppEnvironment = detectEnvironment();

/** Deep-Link-Basis je Umgebung (für Push-Ziele und native Universal Links). */
export const DEEP_LINK_BASE =
  typeof window !== 'undefined' ? window.location.origin : 'https://app.alixwork.de';

export function deepLink(path: string): string {
  return `${DEEP_LINK_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
