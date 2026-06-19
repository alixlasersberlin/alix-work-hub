import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function OrderDocDownload() {
  const { token } = useParams();
  useEffect(() => {
    if (!token) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.replace(`${supabaseUrl}/functions/v1/od-download?t=${encodeURIComponent(token)}`);
  }, [token]);
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Dokument wird geöffnet …</span>
      </div>
    </div>
  );
}
