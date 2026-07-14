import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type PermState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function fetchPublicKey(): Promise<string | null> {
  const { data, error } = await (supabase as any).functions.invoke('push-vapid-config', { method: 'GET' });
  if (error) return null;
  return (data && data.publicKey) || null;
}

/**
 * Web-Push-Registrierung. Nutzt den bestehenden /push-sw.js Service Worker
 * (nur Push, kein App-Shell-Caching – Regel: kein SW in Lovable-Preview/dev).
 */
export function usePushSubscription() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PermState>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

  useEffect(() => {
    if (!supported) { setPermission('unsupported'); return; }
    setPermission(Notification.permission as PermState);
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch { /* noop */ }
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) { toast.error('Push wird von diesem Gerät nicht unterstützt.'); return; }
    if (!user) { toast.error('Bitte zuerst anmelden.'); return; }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PermState);
      if (perm !== 'granted') { toast.warning('Benachrichtigungen wurden nicht erlaubt.'); return; }

      const reg = await navigator.serviceWorker.register('/push-sw.js');
      await navigator.serviceWorker.ready;

      const publicKey = await fetchPublicKey();
      if (!publicKey) { toast.error('Push-Konfiguration nicht verfügbar.'); return; }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const raw = sub.toJSON();
      const { error } = await (supabase as any).functions.invoke('push-subscribe', {
        body: {
          endpoint: raw.endpoint,
          p256dh: raw.keys?.p256dh,
          auth: raw.keys?.auth,
          user_agent: navigator.userAgent,
        },
      });
      if (error) throw error;
      setSubscribed(true);
      toast.success('Push-Benachrichtigungen aktiviert.');
    } catch (e: any) {
      toast.error(e?.message || 'Push-Registrierung fehlgeschlagen.');
    } finally { setBusy(false); }
  }, [supported, user]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await (supabase as any).functions.invoke('push-subscribe', {
          body: { endpoint: sub.endpoint, remove: true },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success('Push-Benachrichtigungen deaktiviert.');
    } finally { setBusy(false); }
  }, [supported]);

  return { supported, permission, subscribed, busy, subscribe, unsubscribe };
}
