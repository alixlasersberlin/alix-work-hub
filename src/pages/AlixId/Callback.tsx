import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AlixIdCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase legt Session automatisch aus dem URL-Hash an (detectSessionInUrl).
    // Wir warten kurz, prüfen dann und leiten weiter.
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) navigate('/id/apps', { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) navigate('/id/login?err=link_expired', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Anmeldung wird abgeschlossen …</span>
      </div>
    </div>
  );
}
