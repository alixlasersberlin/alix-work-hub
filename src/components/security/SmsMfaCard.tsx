import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SMS-Zweitfaktor (nur Super Admin): Mobilnummer hinterlegen, per Code
 * bestätigen und danach wahlweise statt der Authenticator-App nutzen.
 */
export default function SmsMfaCard() {
  const { user, roles, refreshMfaState } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('mfa_sms_factors')
      .select('phone, enabled, verified_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setSavedPhone(data?.enabled ? data.phone : null);
    setEnabled(!!data?.enabled && !!data?.verified_at);
    setPhone(data?.phone ?? '');
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const sendCode = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('mfa-sms-send', {
      body: { purpose: 'enroll', phone },
    });
    setBusy(false);
    if (error || data?.error) {
      toast.error(
        data?.error === 'invalid_phone'
          ? 'Bitte eine gültige Mobilnummer angeben.'
          : data?.error === 'cooldown' || data?.error === 'rate_limited'
            ? 'Bitte kurz warten, bevor ein neuer Code angefordert wird.'
            : 'Code konnte nicht gesendet werden.',
      );
      return;
    }
    toast.success(`Code gesendet an ${data.phone_masked}`);
    setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('mfa-sms-verify', { body: { code } });
    setBusy(false);
    if (error || data?.error) {
      toast.error('Code ungültig oder abgelaufen.');
      return;
    }
    toast.success('SMS-Verifizierung aktiviert.');
    setCode('');
    setStep('idle');
    await load();
    await refreshMfaState();
  };

  const disable = async () => {
    if (!user?.id) return;
    if (!confirm('SMS-Verifizierung wirklich deaktivieren?')) return;
    setBusy(true);
    await supabase.from('mfa_sms_factors').delete().eq('user_id', user.id);
    setBusy(false);
    toast.success('SMS-Verifizierung deaktiviert.');
    await load();
    await refreshMfaState();
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Verifizierung per SMS
          </h2>
          <p className="text-sm text-muted-foreground">
            Alternative zur Authenticator-App: Der Bestätigungscode wird an Ihre hinterlegte
            Mobilnummer gesendet.
          </p>
        </div>
        {enabled ? (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Aktiv</Badge>
        ) : (
          <Badge variant="outline">Nicht aktiv</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Lädt…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="mfa-sms-phone">Mobilnummer</Label>
            <Input
              id="mfa-sms-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+49 171 1234567"
              autoComplete="tel"
            />
          </div>

          {step === 'code' && (
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="mfa-sms-code">SMS-Code</Label>
              <Input
                id="mfa-sms-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {step === 'idle' ? (
              <Button onClick={sendCode} disabled={busy || phone.trim().length < 6}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                {enabled ? 'Nummer ändern & Code senden' : 'Code senden'}
              </Button>
            ) : (
              <>
                <Button onClick={verify} disabled={busy || code.length !== 6} className="gold-gradient font-semibold">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Bestätigen
                </Button>
                <Button variant="ghost" onClick={() => { setStep('idle'); setCode(''); }}>
                  Abbrechen
                </Button>
              </>
            )}
            {enabled && step === 'idle' && (
              <Button variant="outline" onClick={disable} disabled={busy}>
                <Trash2 className="w-4 h-4 mr-2" /> Deaktivieren
              </Button>
            )}
          </div>

          {enabled && savedPhone && (
            <p className="text-[11px] text-muted-foreground">
              Codes gehen an {savedPhone.replace(/.(?=.{3})/g, '•')}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
