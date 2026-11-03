import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function SalesPortalPwa() {
  const { user, roles, profile } = useAuth();
  useEffect(() => {
    let disposed = false; let restore: (() => void) | undefined;
    const setup = async () => {
      const device = localStorage.getItem('alixwork.mobile.device_id');
      if (!user || !roles.length || !profile?.is_active || profile.account_status !== 'active' || !device) return;
      const { data, error } = await supabase.from('mobile_push_subscriptions').select('id').eq('user_id', user.id).eq('device_id', device).eq('approval_status', 'approved').is('revoked_at', null).is('blocked_at', null).limit(1);
      if (disposed || error || !data?.length) return;
      const previous = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"], link[rel="apple-touch-icon"]'));
      previous.forEach(el => el.remove());
      const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = '/sales-portal.webmanifest';
      const icon = document.createElement('link'); icon.rel = 'apple-touch-icon'; icon.href = '/sales-icon-192.png';
      document.head.append(manifest, icon);
      restore = () => { manifest.remove(); icon.remove(); previous.forEach(el => document.head.appendChild(el)); };
    };
    void setup().catch(() => { /* fail closed: no install metadata */ });
    return () => { disposed = true; restore?.(); };
  }, [user?.id, roles.join(','), profile?.is_active, profile?.account_status]);
  return null;
}