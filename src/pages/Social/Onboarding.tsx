import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Check, Search, X } from 'lucide-react';

const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X (Twitter)', 'Pinterest', 'Snapchat', 'Threads'];

type CustomerHit = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  external_customer_id: string | null;
  source_system: string | null;
};



export default function SocialOnboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({ company_name: '', contact_person: '', phone: '', mobile: '', email: '', website: '', industry: '' });
  const [locations, setLocations] = useState<string[]>(['']);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [colors, setColors] = useState('');
  const [fonts, setFonts] = useState('');

  const togglePlatform = (p: string) => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const setLoc = (i: number, v: string) => setLocations(l => l.map((x, idx) => idx === i ? v : x));

  async function submit() {
    if (!company.company_name.trim()) return toast.error('Firmenname erforderlich');
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: client, error } = await supabase.from('social_clients').insert({
        ...company,
        locations: locations.filter(l => l.trim()).map(name => ({ name })),
        corporate_colors: colors.split(',').map(c => c.trim()).filter(Boolean),
        corporate_fonts: fonts.split(',').map(f => f.trim()).filter(Boolean),
        onboarding_status: 'completed',
        onboarding_step: 4,
        created_by: user.user?.id,
        owner_user_id: user.user?.id,
      }).select().single();
      if (error) throw error;
      if (platforms.length > 0) {
        await supabase.from('social_accounts').insert(platforms.map(p => ({ client_id: client.id, platform: p, auth_type: 'password' })));
      }
      if (Object.keys(answers).length > 0) {
        await supabase.from('social_questionnaire').insert({ client_id: client.id, answers, submitted_at: new Date().toISOString() });
      }
      toast.success('Onboarding abgeschlossen');
      nav(`/social/plattformen`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Social Media Onboarding</h1>
        <p className="text-muted-foreground mt-1">Schritt {step} von 4</p>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`h-2 flex-1 rounded-full ${n <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>
          {step === 1 && 'Firmenstammdaten'}
          {step === 2 && 'Standorte'}
          {step === 3 && 'Social-Media-Plattformen'}
          {step === 4 && 'Marketing-Fragebogen & CI'}
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Firmenname *</Label><Input value={company.company_name} onChange={e => setCompany({ ...company, company_name: e.target.value })} /></div>
              <div><Label>Ansprechpartner</Label><Input value={company.contact_person} onChange={e => setCompany({ ...company, contact_person: e.target.value })} /></div>
              <div><Label>Telefon</Label><Input value={company.phone} onChange={e => setCompany({ ...company, phone: e.target.value })} /></div>
              <div><Label>Mobil</Label><Input value={company.mobile} onChange={e => setCompany({ ...company, mobile: e.target.value })} /></div>
              <div><Label>E-Mail</Label><Input type="email" value={company.email} onChange={e => setCompany({ ...company, email: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={company.website} onChange={e => setCompany({ ...company, website: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Branche</Label><Input value={company.industry} onChange={e => setCompany({ ...company, industry: e.target.value })} /></div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              {locations.map((loc, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder={`Standort ${i + 1}`} value={loc} onChange={e => setLoc(i, e.target.value)} />
                  {locations.length > 1 && <Button variant="outline" size="sm" onClick={() => setLocations(l => l.filter((_, idx) => idx !== i))}>Entfernen</Button>}
                </div>
              ))}
              <Button variant="outline" onClick={() => setLocations(l => [...l, ''])}>+ Standort hinzufügen</Button>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-3 md:grid-cols-3">
              {PLATFORMS.map(p => (
                <label key={p} className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-accent">
                  <Checkbox checked={platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <div><Label>Zielgruppe</Label><Textarea rows={2} value={answers.target_audience ?? ''} onChange={e => setAnswers({ ...answers, target_audience: e.target.value })} /></div>
              <div><Label>Kern-Botschaft / Tonalität</Label><Textarea rows={2} value={answers.tone ?? ''} onChange={e => setAnswers({ ...answers, tone: e.target.value })} /></div>
              <div><Label>Wettbewerber</Label><Textarea rows={2} value={answers.competitors ?? ''} onChange={e => setAnswers({ ...answers, competitors: e.target.value })} /></div>
              <div><Label>Ziele (Reichweite, Leads, Verkäufe…)</Label><Textarea rows={2} value={answers.goals ?? ''} onChange={e => setAnswers({ ...answers, goals: e.target.value })} /></div>
              <div><Label>CI-Farben (kommagetrennt, z.B. #000, #FFD700)</Label><Input value={colors} onChange={e => setColors(e.target.value)} /></div>
              <div><Label>CI-Schriften (kommagetrennt)</Label><Input value={fonts} onChange={e => setFonts(e.target.value)} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 1} onClick={() => setStep(s => s - 1)}><ChevronLeft className="mr-2 h-4 w-4" />Zurück</Button>
        {step < 4
          ? <Button onClick={() => setStep(s => s + 1)}>Weiter<ChevronRight className="ml-2 h-4 w-4" /></Button>
          : <Button onClick={submit} disabled={saving}><Check className="mr-2 h-4 w-4" />{saving ? 'Speichere…' : 'Onboarding abschließen'}</Button>}
      </div>
    </div>
  );
}
