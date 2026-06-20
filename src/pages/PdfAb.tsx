import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Proxy-Seite für Auftragsbestätigungs-PDFs.
 * URL bleibt unter alixwork.de; der eigentliche Abruf erfolgt im Hintergrund
 * gegen die Supabase Edge Function und wird als Blob im Browser angezeigt.
 *
 * Query: order_id+token (Fallback) ODER signature_id+token (signiert)
 */
export default function PdfAb() {
  const [params] = useSearchParams();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderId = params.get('order_id');
  const signatureId = params.get('signature_id');
  const token = params.get('token');

  useEffect(() => {
    let revoke: string | null = null;
    (async () => {
      try {
        if (!token || (!orderId && !signatureId)) throw new Error('Fehlende Parameter');
        const fn = signatureId ? 'order-confirmation-pdf' : 'order-fallback-pdf';
        const qs = signatureId
          ? `signature_id=${encodeURIComponent(signatureId)}&token=${encodeURIComponent(token)}`
          : `order_id=${encodeURIComponent(orderId!)}&token=${encodeURIComponent(token)}`;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        revoke = blobUrl;
        setUrl(blobUrl);
        document.title = 'Auftragsbestätigung';
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
      }
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [orderId, signatureId, token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="text-center">
          <p className="text-destructive font-medium">PDF konnte nicht geladen werden</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title="Auftragsbestätigung"
      className="fixed inset-0 w-screen h-screen border-0 bg-white"
    />
  );
}
