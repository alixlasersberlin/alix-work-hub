/**
 * ALIXWORK MOBILE — Push-Registrierung (Web-Push + Native via Capacitor).
 * Enthält KEINE Secrets. Der VAPID Public Key wird serverseitig via
 * `push-vapid-config` geliefert.
 */
import { supabase } from '@/integrations/supabase/client';

const SW_URL = '/push-sw.js';
const DEVICE_KEY = 'alixwork.mobile.device_id';
const DEEPLINK_KEY = 'alixwork.mobile.pending_deeplink';

export type PushStatus = 'unsupported' | 'default' | 'denied' | 'granted' | 'inactive';

export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch { return false; }
}

export function setPendingDeepLink(url: string) { sessionStorage.setItem(DEEPLINK_KEY, url); }
export function takePendingDeepLink(): string | null {
  const v = sessionStorage.getItem(DEEPLINK_KEY);
  if (v) sessionStorage.removeItem(DEEPLINK_KEY);
  return v;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

async function vapidPublicKey(): Promise<string | null> {
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (envKey) return envKey;
  const { data, error } = await supabase.functions.invoke('push-vapid-config', { method: 'GET' });
  if (error) return null;
  return (data as any)?.publicKey ?? null;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (await isNative()) {
    return Notification?.permission === 'denied' ? 'denied' : 'granted';
  }
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'granted') return 'inactive';
  return 'default';
}

async function upsertDevice(row: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht angemeldet.');
  const base = {
    user_id: user.id,
    device_id: deviceId(),
    notifications_enabled: true,
    revoked_at: null,
    app_version: (import.meta.env.VITE_APP_VERSION as string) ?? null,
    user_agent: navigator.userAgent.slice(0, 200),
    last_seen_at: new Date().toISOString(),
    environment: import.meta.env.PROD ? 'production' : 'development',
    ...row,
  };
  const { data: existing } = await (supabase as any).from('mobile_push_subscriptions')
    .select('id').eq('user_id', user.id).eq('device_id', deviceId()).maybeSingle();
  const { error } = existing
    ? await (supabase as any).from('mobile_push_subscriptions').update(base).eq('id', existing.id)
    : await (supabase as any).from('mobile_push_subscriptions').insert(base);
  if (error) throw new Error(error.message);
}

/** Registriert das Gerät. Gibt echten Erfolg/Fehler zurück — keine Fake-Meldungen. */
export async function registerPush(): Promise<{ ok: boolean; transport?: string; error?: string }> {
  try {
    if (await isNative()) {
      const { Capacitor } = await import('@capacitor/core');
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return { ok: false, error: 'Berechtigung verweigert.' };
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      const token = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Kein Push-Token erhalten (Timeout).')), 15000);
        PushNotifications.addListener('registration', (r) => { clearTimeout(t); resolve(r.value); });
        PushNotifications.addListener('registrationError', (e) => { clearTimeout(t); reject(new Error(String(e?.error ?? e))); });
        PushNotifications.register();
      });
      await upsertDevice({
        platform, native_token: token, push_provider: platform === 'ios' ? 'apns' : 'fcm',
        endpoint: null, p256dh: null, auth_key: null, os: platform,
      });
      return { ok: true, transport: platform === 'ios' ? 'APNs' : 'FCM' };
    }

    if (!pushSupported()) return { ok: false, error: 'Dieses Gerät unterstützt keine Web-Push-Nachrichten.' };
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'Berechtigung verweigert.' };
    const key = await vapidPublicKey();
    if (!key) return { ok: false, error: 'Push-Konfiguration (VAPID) auf dem Server nicht verfügbar.' };
    const reg = await navigator.serviceWorker.getRegistration(SW_URL)
      ?? await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    const raw = sub.toJSON() as any;
    await upsertDevice({
      platform: 'web', push_provider: 'webpush', native_token: null,
      endpoint: sub.endpoint, p256dh: raw.keys?.p256dh, auth_key: raw.keys?.auth,
    });
    return { ok: true, transport: 'Web-Push' };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Beim Logout / Gerätewechsel: Registrierung serverseitig widerrufen. */
export async function revokePush(): Promise<void> {
  try {
    await (supabase as any).from('mobile_push_subscriptions')
      .update({ revoked_at: new Date().toISOString(), notifications_enabled: false })
      .eq('device_id', deviceId());
    const reg = await navigator.serviceWorker?.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* nicht blockierend */ }
}

/** Badge-Synchronisation (App-Icon), sofern die Plattform es unterstützt. */
export async function syncBadge(count: number) {
  try {
    const nav: any = navigator;
    if (count > 0) await nav.setAppBadge?.(count);
    else await nav.clearAppBadge?.();
  } catch { /* optional */ }
}

/** Test-Push ausschließlich an das aktuelle Gerät des angemeldeten Users. */
export async function sendTestPush(): Promise<{ ok: boolean; error?: string; info?: any }> {
  const { data, error } = await supabase.functions.invoke('send-mobile-notification', {
    body: {
      notification_type: 'TEST',
      title: 'ALIXWORK Test-Push',
      body: 'Push funktioniert auf diesem Gerät.',
      url: '/mobil/inbox',
      dedup_suffix: String(Date.now()),
    },
  });
  if (error) return { ok: false, error: error.message };
  const sent = (data as any)?.sent ?? 0;
  return sent > 0
    ? { ok: true, info: data }
    : { ok: false, error: `Kein Versand (gesendet: 0, übersprungen: ${(data as any)?.skipped ?? 0})`, info: data };
}
