import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  badge_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  weekend_enabled: boolean;
  privacy_mode: boolean;
  escalations_enabled: boolean;
}

const DEFAULTS: NotificationPreferences = {
  push_enabled: true, email_enabled: true, sms_enabled: false, whatsapp_enabled: false,
  in_app_enabled: true, sound_enabled: true, vibration_enabled: true, badge_enabled: true,
  quiet_hours_start: null, quiet_hours_end: null, weekend_enabled: true,
  privacy_mode: true, escalations_enabled: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setPrefs({ ...DEFAULTS, ...data });
      setLoading(false);
    })();
  }, [user?.id]);

  const save = useCallback(async (patch: Partial<NotificationPreferences>) => {
    if (!user) return;
    setSaving(true);
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await (supabase as any)
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
    setSaving(false);
  }, [prefs, user?.id]);

  return { prefs, save, loading, saving };
}
