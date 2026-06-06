import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MailX, CheckCircle2, AlertTriangle } from 'lucide-react';

type TokenStatus = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';
type EmailStatus = 'idle' | 'submitting' | 'success' | 'already' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const emailParam = (params.get('email') ?? '').toLowerCase();

  // Token-based flow (existing transactional system)
  const [status, setStatus] = useState<TokenStatus>('loading');
  const [processing, setProcessing] = useState(false);

  // Email-based flow (MailCenter marketing/newsletter)
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [email, setEmail] = useState(emailParam);
  const [reason, setReason] = useState('');

  useEffect(() => {
    // If neither token nor email is present, show invalid for token mode
    if (!token && !emailParam) {
      setStatus('invalid');
      return;
    }
    if (!token) {
      // Email mode: just check existing status
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      fetch(`${supabaseUrl}/functions/v1/mail-unsubscribe?email=${encodeURIComponent(emailParam)}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.already) setEmailStatus('already');
        })
        .catch(() => {});
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === true) setStatus('valid');
        else if (data.reason === 'already_unsubscribed') setStatus('already');
        else setStatus('invalid');
      })
      .catch(() => setStatus('error'));
  }, [token, emailParam]);

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

  const handleEmailUnsubscribe = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setEmailStatus('error');
      return;
    }
    setEmailStatus('submitting');
    try {
      const { data, error } = await supabase.functions.invoke('mail-unsubscribe', {
        body: { email: e, reason: reason.trim() || null, source: 'public_form' },
      });
      if (error) throw error;
      if (data?.already) setEmailStatus('already');
      else if (data?.ok) setEmailStatus('success');
      else setEmailStatus('error');
    } catch {
      setEmailStatus('error');
    }
  };

  // Token-based UI takes precedence when token is present
  if (token) {
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

  // Email-based MailCenter unsubscribe form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {emailStatus === 'success' || emailStatus === 'already' ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-foreground">
              {emailStatus === 'already' ? 'Bereits abgemeldet' : 'Erfolgreich abgemeldet'}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sie wurden erfolgreich von Werbe-E-Mails abgemeldet.<br />
              Transaktionale E-Mails zu Aufträgen, Rechnungen, Lieferungen oder Reparaturen
              erhalten Sie weiterhin.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <MailX className="w-12 h-12 text-primary mx-auto" />
              <h1 className="text-xl font-bold text-foreground">Werbe-E-Mails abbestellen</h1>
              <p className="text-sm text-muted-foreground">
                Bestätigen Sie Ihre E-Mail-Adresse, um keine Werbung mehr zu erhalten.
                Wichtige Mails zu Aufträgen, Rechnungen und Reparaturen erhalten Sie weiterhin.
              </p>
            </div>
            <div className="space-y-3 border border-border rounded-md p-4 bg-card">
              <div>
                <Label htmlFor="unsub-email">E-Mail-Adresse</Label>
                <Input id="unsub-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  autoComplete="email" />
              </div>
              <div>
                <Label htmlFor="unsub-reason">Grund (optional)</Label>
                <Textarea id="unsub-reason" rows={3} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="z. B. zu viele E-Mails" />
              </div>
              <Button onClick={handleEmailUnsubscribe}
                disabled={emailStatus === 'submitting'} className="w-full">
                {emailStatus === 'submitting' && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Von Werbe-E-Mails abmelden
              </Button>
              {emailStatus === 'error' && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Es ist ein Fehler aufgetreten. Bitte E-Mail prüfen und erneut versuchen.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
