import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isPhone } from '@/lib/mobil/utils';
import { useAuth } from '@/hooks/useAuth';

const OPT_OUT = 'mobil:optout';

/**
 * Leitet Smartphone-Nutzer einmalig von der Startseite auf die mobile
 * Mitarbeiteransicht (/mobil). Desktop bleibt unverändert.
 */
export default function MobileAutoRedirect() {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (new URLSearchParams(search).get('desktop') === '1') {
      localStorage.setItem(OPT_OUT, '1');
      return;
    }
    if (!user) return;
    if (pathname !== '/') return;
    if (localStorage.getItem(OPT_OUT) === '1') return;
    if (!isPhone()) return;
    nav('/mobil', { replace: true });
  }, [pathname, search, nav, user]);

  return null;
}
