import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, MailX, CheckCircle2, AlertTriangle } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid === true) setStatus('valid');
        else if (data.reason === 'already_unsubscribed') setStatus('already');
        else setStatus('invalid');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus('success');
      else if (data?.reason === 'already_unsubscribed') setStatus('already');
      else setStatus('error');
    } catch {
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {status === 'loading' && <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />}

        {status === 'valid' && (
          <>
            <MailX className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-xl font-bold text-foreground">E-Mail-Benachrichtigungen abbestellen</h1>
            <p className="text-sm text-muted-foreground">Möchten Sie keine weiteren E-Mails mehr erhalten?</p>
            <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Abbestellen bestätigen
            </Button>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Erfolgreich abbestellt</h1>
            <p className="text-sm text-muted-foreground">Sie erhalten keine weiteren E-Mails mehr.</p>
          </>
        )}

        {status === 'already' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Bereits abbestellt</h1>
            <p className="text-sm text-muted-foreground">Diese E-Mail-Adresse wurde bereits abgemeldet.</p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Ungültiger Link</h1>
            <p className="text-sm text-muted-foreground">Dieser Abmeldelink ist ungültig oder abgelaufen.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Fehler</h1>
            <p className="text-sm text-muted-foreground">Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.</p>
          </>
        )}
      </div>
    </div>
  );
}
