import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Mail, Smartphone, AlertTriangle, ArrowLeft } from 'lucide-react';

interface ReauthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reason?: string;
}

export default function ReauthDialog({ open, onClose, onSuccess, reason = 'reauth' }: ReauthDialogProps) {
  const { otpState, otpChallenge, otpError, sendOtp, verifyOtp } = useAuth();
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSent(true);
    await sendOtp(reason);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    setVerifying(true);
    const ok = await verifyOtp(otpCode);
    setVerifying(false);
    if (ok) {
      setOtpCode('');
      setSent(false);
      onSuccess();
    }
  };

  const handleClose = () => {
    setOtpCode('');
    setSent(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Re-Authentifizierung</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Bestätigen Sie Ihre Identität mit einem Sicherheitscode.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!sent && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Für diese Aktion ist eine erneute Identitätsbestätigung erforderlich.
            </p>
            <Button onClick={handleSend} className="w-full gold-gradient font-semibold">
              Sicherheitscode anfordern
            </Button>
          </div>
        )}

        {sent && otpState === 'sending' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Code wird gesendet…</p>
          </div>
        )}

        {sent && otpState === 'blocked' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive text-center">{otpError}</p>
            <Button variant="outline" onClick={handleClose}>Schließen</Button>
          </div>
        )}

        {sent && otpState === 'error' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive text-center">{otpError}</p>
            <Button onClick={handleSend} className="gold-gradient font-semibold">Erneut senden</Button>
          </div>
        )}

        {sent && otpState === 'pending' && otpChallenge && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
              {otpChallenge.channel === 'sms' ? (
                <Smartphone className="w-5 h-5 text-primary" />
              ) : (
                <Mail className="w-5 h-5 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {otpChallenge.channel === 'sms' ? 'SMS' : 'E-Mail'} gesendet
                </p>
                <p className="text-xs text-muted-foreground">an {otpChallenge.destination_hint}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">6-stelliger Code</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="bg-secondary border-border text-center text-xl tracking-[0.4em] font-mono"
              />
            </div>

            {otpError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{otpError}</p>
            )}

            <Button type="submit" disabled={verifying || otpCode.length !== 6} className="w-full gold-gradient font-semibold">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Bestätigen
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
