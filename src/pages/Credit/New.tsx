import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCreditPermissions } from '@/hooks/useCreditPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

export default function CreditNew() {
  const nav = useNavigate();
  const { canWrite } = useCreditPermissions();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<'company' | 'private'>('company');
  const [form, setForm] = useState<Record<string, any>>({
    company_name: '', name: '', email: '', phone: '', address: '',
    ust_id: '', handelsregister: false, website: '', linkedin: '',
    company_age_years: 0, insolvenz: false,
    schufa_grade: '', schufa_negative: false,
    net_income: 0, employment: '',
  });
  const [amount, setAmount] = useState<number>(0);
  const [term, setTerm] = useState<number>(48);
  const [downpayment, setDownpayment] = useState<number>(20);
  const [purpose, setPurpose] = useState('');
  const [consent, setConsent] = useState(false);

  if (!canWrite) return <div className="p-8 text-center text-muted-foreground">Kein Zugriff.</div>;

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (calculate = true) => {
    if (!consent) { toast.error('Bitte Einwilligung zur Bonitätsprüfung bestätigen.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('credit_assessments' as any).insert({
        customer_type: type, customer_snapshot: form,
        requested_amount: amount, requested_term_months: term, requested_downpayment_pct: downpayment,
        purpose, consent_given: true, consent_at: new Date().toISOString(), consent_by: user?.id,
        status: 'draft',
      }).select().single();
      if (error) throw error;
      const id = (data as any).id;
      await supabase.from('credit_decision_log' as any).insert({ assessment_id: id, action: 'created', to_status: 'draft' });
      if (calculate) {
        toast.loading('Score wird berechnet …', { id: 'calc' });
        await supabase.functions.invoke('credit-score-calculate', { body: { assessment_id: id, run_ai: true } });
        toast.success('Bonitätsprüfung erstellt und berechnet.', { id: 'calc' });
      } else {
        toast.success('Entwurf gespeichert.');
      }
      nav(`/bonitaet/${id}`);
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || e));
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav('/bonitaet')}><ArrowLeft className="w-4 h-4" /></Button>
        <h1 className="text-2xl font-display font-bold">Neue Bonitätsprüfung</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Kundendaten</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Label className="flex items-center gap-2"><input type="radio" checked={type === 'company'} onChange={() => setType('company')} /> Firma</Label>
            <Label className="flex items-center gap-2"><input type="radio" checked={type === 'private'} onChange={() => setType('private')} /> Privat</Label>
          </div>
          {type === 'company' ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Firmenname *"><Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
              <Field label="Geschäftsführer"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="USt-ID"><Input value={form.ust_id} onChange={(e) => set('ust_id', e.target.value)} /></Field>
              <Field label="Website"><Input value={form.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field label="Firmenalter (Jahre)"><Input type="number" value={form.company_age_years} onChange={(e) => set('company_age_years', Number(e.target.value))} /></Field>
              <Field label="LinkedIn"><Input value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} /></Field>
              <Label className="flex items-center gap-2"><Checkbox checked={form.handelsregister} onCheckedChange={(v) => set('handelsregister', !!v)} /> Handelsregister eingetragen</Label>
              <Label className="flex items-center gap-2"><Checkbox checked={form.insolvenz} onCheckedChange={(v) => set('insolvenz', !!v)} /> Insolvenzhinweis</Label>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Name *"><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Nettoeinkommen (€/Monat)"><Input type="number" value={form.net_income} onChange={(e) => set('net_income', Number(e.target.value))} /></Field>
              <Field label="Beschäftigung">
                <Select value={form.employment} onValueChange={(v) => set('employment', v)}>
                  <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beamter">Beamter</SelectItem>
                    <SelectItem value="unbefristet">Unbefristet</SelectItem>
                    <SelectItem value="befristet">Befristet</SelectItem>
                    <SelectItem value="selbstaendig_neu">Selbständig &lt;2 Jahre</SelectItem>
                    <SelectItem value="arbeitslos">Arbeitslos</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="E-Mail"><Input value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Telefon"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Adresse"><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>SCHUFA / Bonität</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <Field label="SCHUFA-Score-Klasse">
            <Select value={form.schufa_grade} onValueChange={(v) => set('schufa_grade', v)}>
              <SelectTrigger><SelectValue placeholder="A – F" /></SelectTrigger>
              <SelectContent>
                {['A','B','C','D','E','F'].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Label className="flex items-center gap-2 pt-6"><Checkbox checked={form.schufa_negative} onCheckedChange={(v) => set('schufa_negative', !!v)} /> Negative Merkmale</Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Finanzierungswunsch</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <Field label="Betrag (€)"><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
          <Field label="Laufzeit (Monate)"><Input type="number" value={term} onChange={(e) => setTerm(Number(e.target.value))} /></Field>
          <Field label="Anzahlung (%)"><Input type="number" value={downpayment} onChange={(e) => setDownpayment(Number(e.target.value))} /></Field>
          <div className="md:col-span-3">
            <Field label="Zweck / Notiz"><Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="pt-6">
          <Label className="flex items-start gap-3">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
            <span className="text-sm">
              <strong>DSGVO-Einwilligung:</strong> Ich bestätige, dass der Kunde der Bonitätsprüfung durch Alix Lasers / Alix Medical / AlixWork ausdrücklich zugestimmt hat. Die erhobenen Daten werden ausschließlich zur Bewertung der Zahlungsfähigkeit verwendet und gemäß Aufbewahrungsrichtlinie gelöscht.
            </span>
          </Label>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>Entwurf speichern</Button>
        <Button onClick={() => save(true)} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> Speichern &amp; Score berechnen</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}
