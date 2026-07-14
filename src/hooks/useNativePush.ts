import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Bridge: registriert Native-Push (APNs/FCM) über Capacitor, sofern die App
 * in einer nativen Shell läuft. Im Browser tut der Hook nichts —
 * dort bleibt der bestehende Web-Push-Flow (usePushSubscription) zuständig.
 */
export function useNativePush() {
  const { user } = useAuth();
  const [isNative, setIsNative] = useState(false);
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        if (!cancelled) setIsNative(true);
      } catch {
        /* Capacitor nicht verfügbar – nichts tun */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const register = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') { setStatus('denied'); return; }

      await new Promise<void>((resolve, reject) => {
        PushNotifications.addListener('registration', async (t) => {
          setToken(t.value);
          setStatus('granted');
          const platform = (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android') as 'ios' | 'android';
          await (supabase as any).from('mobile_push_subscriptions').upsert(
            {
              user_id: user.id,
              platform,
              native_token: t.value,
              endpoint: null,
              p256dh: null,
              auth_key: null,
              user_agent: navigator.userAgent,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,platform,native_token' } as any
          );
          resolve();
        });
        PushNotifications.addListener('registrationError', (err) => {
          setStatus('error');
          reject(err);
        });
        PushNotifications.register();
      });

      // Deep-Link beim Antippen einer Push-Nachricht
      const { App } = await import('@capacitor/app');
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification?.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) {
          window.location.href = url;
        }
      });
      App.addListener('appUrlOpen', (evt) => {
        try {
          const u = new URL(evt.url);
          if (u.pathname.startsWith('/m/kalender')) window.location.href = u.pathname + u.search;
        } catch { /* ignore */ }
      });
    } catch (e) {
      setStatus('error');
    }
  }, [user?.id]);

  return { isNative, status, token, register };
}
