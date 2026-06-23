import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Proxy-Seite für order_documents Downloads.
 * Lädt die Datei im Hintergrund über die Edge Function und zeigt sie als Blob im
 * Browser an – die sichtbare URL bleibt unter alixwork.de/d/<token>.
 */
export default function OrderDocDownload() {
  const { token } = useParams();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let revoke: string | null = null;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/od-download?t=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const u = URL.createObjectURL(blob);
        revoke = u;
        setBlobUrl(u);
        document.title = 'Dokument';
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
      }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="text-center">
          <p className="text-destructive font-medium">Dokument konnte nicht geladen werden</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Dokument wird geöffnet …</span>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      title="Dokument"
      className="fixed inset-0 w-screen h-screen border-0 bg-white"
    />
  );
}
