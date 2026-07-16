import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileSignature, Check } from 'lucide-react';
import { toast } from 'sonner';

const CONSENT_TEXT = 'Ich bestätige, dass ich den Vertrag vollständig gelesen habe und ihn hiermit rechtsverbindlich elektronisch signiere.';

export function ContractSignDialog({
  open, onOpenChange, contractId, contractLabel, onSigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  contractLabel: string;
  onSigned?: () => void;
}) {
  const [step, setStep] = useState<'confirm' | 'code'>('confirm');
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep('confirm'); setConsent(false); setName(''); setRole(''); setCode(''); };

  const requestOtp = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('portal-contract-sign-request', {
        body: { contract_id: contractId },
      });
      if (error) throw error;
      setStep('code');
      toast.success('Code per E-Mail versendet.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Code konnte nicht gesendet werden.');
    } finally { setBusy(false); }
  };

  const confirmSign = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('portal-contract-sign-confirm', {
        body: {
          contract_id: contractId,
          code: code.trim(),
          signed_by_name: name.trim(),
          signed_by_role: role.trim() || null,
          consents: { text: CONSENT_TEXT, accepted_at: new Date().toISOString() },
        },
      });
      if (error) throw error;
      toast.success('Vertrag rechtsverbindlich signiert.');
      onSigned?.();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? 'Signatur nicht möglich');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSignature className="w-4 h-4" /> Vertrag signieren</DialogTitle>
          <DialogDescription>{contractLabel}</DialogDescription>
        </DialogHeader>

        {step === 'confirm' ? (
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
              <span>{CONSENT_TEXT}</span>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>Vor- und Nachname *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Funktion</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Geschäftsführung" /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Wir senden Ihnen im nächsten Schritt einen 6-stelligen Bestätigungscode per E-Mail. IP, Zeitstempel und Browser werden protokolliert.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Wir haben Ihnen einen 6-stelligen Code an Ihre hinterlegte E-Mail-Adresse gesendet. Der Code ist 10 Minuten gültig.
            </p>
            <div>
              <Label>Bestätigungscode</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                     inputMode="numeric" placeholder="000000" className="tracking-[0.6em] text-center font-mono text-lg" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          {step === 'confirm' ? (
            <Button disabled={!consent || !name.trim() || busy} onClick={requestOtp}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Code anfordern'}
            </Button>
          ) : (
            <Button disabled={code.length !== 6 || busy} onClick={confirmSign}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" />Signieren</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
