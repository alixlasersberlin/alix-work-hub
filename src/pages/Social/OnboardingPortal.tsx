import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, Sparkles, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Client = {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  industry: string | null;
  locations: any[] | null;
  corporate_colors: Record<string, any> | null;
  corporate_fonts: Record<string, any> | null;
  onboarding_completed_at: string | null;
};

export default function SocialOnboardingPortal() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [c, setC] = useState<Client | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('social-onboarding-portal', {
        body: { action: 'load', token },
      });
      if (error || (data as any)?.error) {
        const code = (data as any)?.error ?? error?.message ?? 'error';
        setErr(code);
      } else {
        setC((data as any).client as Client);
      }
      setLoading(false);
    })();
  }, [token]);

  function update<K extends keyof Client>(k: K, v: Client[K]) {
    setC((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save(complete: boolean) {
    if (!c) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('social-onboarding-portal', {
      body: {
        action: 'save',
        token,
        complete,
        patch: {
          contact_person: c.contact_person ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          mobile: c.mobile ?? '',
          website: c.website ?? '',
          industry: c.industry ?? '',
          locations: c.locations ?? [],
          corporate_colors: c.corporate_colors ?? {},
          corporate_fonts: c.corporate_fonts ?? {},
        },
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? 'Fehler');
      return;
    }
    if (complete) {
      update('onboarding_completed_at', new Date().toISOString());
      toast.success('Vielen Dank – Ihre Angaben sind bei uns eingegangen.');
    } else {
      toast.success('Zwischenstand gespeichert');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (err || !c) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <div className="text-xl font-semibold">Link ungültig</div>
            <p className="text-sm text-muted-foreground">
              {err === 'expired'
                ? 'Dieser Onboarding-Link ist abgelaufen. Bitte fordern Sie einen neuen Link bei Ihrem Ansprechpartner an.'
                : 'Der aufgerufene Link ist nicht gültig oder wurde entfernt.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const colors = c.corporate_colors ?? {};
  const fonts = c.corporate_fonts ?? {};
  const locations = Array.isArray(c.locations) ? c.locations : [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm uppercase tracking-widest">Social-Media Onboarding</span>
          </div>
          <h1 className="text-3xl font-bold">{c.company_name}</h1>
          <p className="text-muted-foreground">
            Bitte prüfen und ergänzen Sie Ihre Angaben. Sie können jederzeit zwischenspeichern.
          </p>
          {c.onboarding_completed_at && (
            <div className="inline-flex items-center gap-2 text-emerald-600 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Onboarding abgeschlossen
            </div>
          )}
        </div>

        <Card>
          <CardHeader><CardTitle>Kontakt</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Ansprechpartner</Label>
              <Input value={c.contact_person ?? ''} onChange={(e) => update('contact_person', e.target.value)} />
            </div>
            <div>
              <Label>E-Mail</Label>
              <Input type="email" value={c.email ?? ''} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={c.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div>
              <Label>Mobil</Label>
              <Input value={c.mobile ?? ''} onChange={(e) => update('mobile', e.target.value)} />
            </div>
            <div>
              <Label>Website</Label>
              <Input placeholder="https://…" value={c.website ?? ''} onChange={(e) => update('website', e.target.value)} />
            </div>
            <div>
              <Label>Branche</Label>
              <Input value={c.industry ?? ''} onChange={(e) => update('industry', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Corporate Design</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Primärfarbe (Hex)</Label>
              <Input placeholder="#000000" value={colors.primary ?? ''}
                onChange={(e) => update('corporate_colors', { ...colors, primary: e.target.value })} />
            </div>
            <div>
              <Label>Sekundärfarbe (Hex)</Label>
              <Input placeholder="#ffffff" value={colors.secondary ?? ''}
                onChange={(e) => update('corporate_colors', { ...colors, secondary: e.target.value })} />
            </div>
            <div>
              <Label>Akzentfarbe (Hex)</Label>
              <Input placeholder="#d4af37" value={colors.accent ?? ''}
                onChange={(e) => update('corporate_colors', { ...colors, accent: e.target.value })} />
            </div>
            <div>
              <Label>Haupt-Schriftart</Label>
              <Input placeholder="z.B. Inter" value={fonts.primary ?? ''}
                onChange={(e) => update('corporate_fonts', { ...fonts, primary: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Standorte</CardTitle>
            <Button variant="outline" size="sm"
              onClick={() => update('locations', [...locations, { label: '', street: '', zip: '', city: '', country: '' }])}>
              <Plus className="mr-2 h-4 w-4" />Standort hinzufügen
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {locations.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Standorte hinterlegt.</p>
            )}
            {locations.map((l: any, i: number) => (
              <div key={i} className="grid gap-3 md:grid-cols-6 items-end border border-border rounded-lg p-3">
                <div className="md:col-span-2">
                  <Label>Bezeichnung</Label>
                  <Input value={l.label ?? ''} onChange={(e) => {
                    const n = [...locations]; n[i] = { ...l, label: e.target.value }; update('locations', n);
                  }} />
                </div>
                <div className="md:col-span-2">
                  <Label>Straße</Label>
                  <Input value={l.street ?? ''} onChange={(e) => {
                    const n = [...locations]; n[i] = { ...l, street: e.target.value }; update('locations', n);
                  }} />
                </div>
                <div>
                  <Label>PLZ</Label>
                  <Input value={l.zip ?? ''} onChange={(e) => {
                    const n = [...locations]; n[i] = { ...l, zip: e.target.value }; update('locations', n);
                  }} />
                </div>
                <div>
                  <Label>Ort</Label>
                  <Input value={l.city ?? ''} onChange={(e) => {
                    const n = [...locations]; n[i] = { ...l, city: e.target.value }; update('locations', n);
                  }} />
                </div>
                <div className="md:col-span-5">
                  <Label>Land</Label>
                  <Input value={l.country ?? ''} onChange={(e) => {
                    const n = [...locations]; n[i] = { ...l, country: e.target.value }; update('locations', n);
                  }} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => {
                  const n = locations.filter((_: any, j: number) => j !== i); update('locations', n);
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Anmerkungen</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              placeholder="Wünsche, Tonalität, No-Gos…"
              rows={4}
              value={(fonts as any).notes ?? ''}
              onChange={(e) => update('corporate_fonts', { ...fonts, notes: e.target.value })}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Zwischenspeichern
          </Button>
          <Button onClick={() => save(true)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Angaben absenden
          </Button>
        </div>
      </div>
    </div>
  );
}
