import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCreditPermissions } from '@/hooks/useCreditPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Save, ShieldAlert } from 'lucide-react';

interface Policy {
  id: string;
  name: string;
  active: boolean;
  score_bands: any;
  weights: any;
  updated_at?: string;
}

export default function CreditPolicies() {
  const nav = useNavigate();
  const { isSuperAdmin } = useCreditPermissions();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [weightsTxt, setWeightsTxt] = useState('');
  const [bandsTxt, setBandsTxt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase.from('credit_policies' as any).select('*').eq('name', 'default').maybeSingle().then(({ data }) => {
      const p = data as unknown as Policy | null;
      if (p) {
        setPolicy(p);
        setWeightsTxt(JSON.stringify(p.weights ?? {}, null, 2));
        setBandsTxt(JSON.stringify(p.score_bands ?? {}, null, 2));
      }
    });
  }, [isSuperAdmin]);

  const save = async () => {
    if (!policy) return;
    setBusy(true);
    try {
      const weights = JSON.parse(weightsTxt);
      const score_bands = JSON.parse(bandsTxt);
      const { error } = await supabase.from('credit_policies' as any).update({
        weights, score_bands, updated_at: new Date().toISOString(),
      }).eq('id', policy.id);
      if (error) throw error;
      toast.success('Richtlinie gespeichert');
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-red-400" />
          Nur Super Admin darf Richtlinien bearbeiten.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav('/bonitaet')}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <div className="text-xs uppercase tracking-[2px] text-primary/80">ALIX CREDIT SCORE®</div>
          <h1 className="text-2xl font-display font-bold">Richtlinien &amp; Score-Bänder</h1>
        </div>
      </div>

      {!policy && <Card><CardContent className="p-6 text-muted-foreground">Keine Standardrichtlinie gefunden.</CardContent></Card>}

      {policy && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Gewichtung (JSON)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prozentanteile pro Kategorie – Summe sollte 100 ergeben</Label>
              <Textarea rows={16} value={weightsTxt} onChange={(e) => setWeightsTxt(e.target.value)} className="font-mono text-xs" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Score-Bänder (JSON)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Label className="text-xs text-muted-foreground">Schwellenwerte, Ampelfarben, Entscheidungsstufen</Label>
              <Textarea rows={16} value={bandsTxt} onChange={(e) => setBandsTxt(e.target.value)} className="font-mono text-xs" />
            </CardContent>
          </Card>
        </div>
      )}

      {policy && (
        <div className="flex justify-end gap-2">
          <Input value={policy.name} readOnly className="max-w-[240px] bg-muted/30" />
          <Button onClick={save} disabled={busy}><Save className="w-4 h-4 mr-2" />Speichern</Button>
        </div>
      )}
    </div>
  );
}
