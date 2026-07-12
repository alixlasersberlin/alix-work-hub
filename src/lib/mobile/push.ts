/**
 * Web-Push helper for the Alix Mobile Techniker-App.
 * Subscribes the current user to Web-Push via the `push-sw.js` service worker
 * and stores the endpoint in `mobile_push_subscriptions`.
 *
 * Requires `VITE_VAPID_PUBLIC_KEY` in the frontend env and matching
 * `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` in edge function
 * secrets for `mobile-push-send`.
 */
import { supabase } from '@/integrations/supabase/client';

const SW_URL = '/push-sw.js';
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
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

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: '/m/' });
}

export async function getPushStatus(): Promise<'unsupported' | 'denied' | 'granted' | 'default' | 'inactive'> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'granted') return 'inactive';
  return 'default';
}

export async function subscribePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Browser unterstützt keine Push-Nachrichten.' };
  if (!VAPID) return { ok: false, error: 'VITE_VAPID_PUBLIC_KEY nicht gesetzt.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, error: 'Berechtigung verweigert.' };
  try {
    const reg = await ensureRegistration();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID),
    });
    const raw = sub.toJSON() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Nicht angemeldet.' };
    const { error } = await supabase.from('mobile_push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: raw.keys?.p256dh,
      auth_key: raw.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 200),
      last_seen_at: new Date().toISOString(),
    } as any, { onConflict: 'user_id,endpoint' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from('mobile_push_subscriptions').delete().eq('endpoint', endpoint);
  }
}
