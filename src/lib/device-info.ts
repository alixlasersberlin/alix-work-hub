/**
 * Erkennt Gerät/OS/Browser aus dem UA-String – best effort, ohne externe Lib.
 * Wird beim Registrieren einer Push-Subscription mitgeschickt, damit Admins
 * in der Geräteliste sinnvolle Bezeichnungen sehen.
 */
export function detectDeviceInfo(): { device_name: string; os: string; browser: string; app_version: string | null } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform || '' : '';

  let os = 'Unbekannt';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unbekannt';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/CriOS/i.test(ua)) browser = 'Chrome iOS';

  // Beliebiger Kurzname – Nutzer kann später umbenennen
  const device_name = os === 'iOS' ? 'iPhone/iPad' :
                       os === 'Android' ? 'Android' :
                       os === 'macOS' ? 'Mac' :
                       os === 'Windows' ? 'Windows PC' :
                       platform || 'Gerät';

  const app_version = (import.meta as any).env?.VITE_APP_VERSION || null;
  return { device_name, os, browser, app_version };
}
