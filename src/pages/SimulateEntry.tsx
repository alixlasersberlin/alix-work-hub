import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const IMPERSONATE_KEY = 'alixwork.impersonate_user_id';

export default function SimulateEntry() {
  const { userId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (userId && /^[0-9a-f-]{8,}$/i.test(userId)) {
      try { sessionStorage.setItem(IMPERSONATE_KEY, userId); } catch { /* ignore */ }
      // Vollständiger Reload, damit useAuth die Impersonation beim Init lädt.
      window.location.replace('/');
    } else {
      navigate('/', { replace: true });
    }
  }, [userId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Simulation wird gestartet…
    </div>
  );
}
