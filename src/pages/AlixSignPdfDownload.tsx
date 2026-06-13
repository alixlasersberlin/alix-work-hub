import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AlixSignPdfDownload() {
  const { signatureId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');

  useEffect(() => {
    const run = async () => {
      if (!signatureId || !token) {
        toast.error('Ungültiger Download-Link');
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const url = `${supabaseUrl}/functions/v1/alix-sign-pdf?signature_id=${encodeURIComponent(signatureId)}&token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: { apikey: anonKey } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        window.location.replace(objectUrl);
      } catch (e: any) {
        toast.error(e?.message || 'PDF konnte nicht geladen werden');
      }
    };

    void run();
  }, [signatureId, token]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>PDF wird geöffnet …</span>
      </div>
    </div>
  );
}