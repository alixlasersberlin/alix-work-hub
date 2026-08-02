import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { FeedbackHeader, Section } from './_shared';

const KEY = 'feedback.settings';

type FeedbackSettings = {
  sender_name: string;
  reply_to: string;
  bcc: string;
  alert_enabled: boolean;
  alert_nps_max: number;
  alert_stars_max: number;
  alert_recipients: string;
  anonymize_enabled: boolean;
  anonymize_after_days: number;
  testimonial_auto_request: boolean;
  footer_text: string;
  privacy_url: string;
  imprint_url: string;
};

const DEFAULTS: FeedbackSettings = {
  sender_name: 'ALIX Lasers',
  reply_to: '',
  bcc: '',
  alert_enabled: true,
  alert_nps_max: 6,
  alert_stars_max: 2,
  alert_recipients: '',
  anonymize_enabled: false,
  anonymize_after_days: 365,
  testimonial_auto_request: false,
  footer_text: '',
  privacy_url: '',
  imprint_url: '',
};

export default function FeedbackSettings() {
  const sb = supabase as any;
  const [cfg, setCfg] = useState<FeedbackSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('app_settings').select('value').eq('key', KEY).maybeSingle();
      if (data?.value) {
        try {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          setCfg({ ...DEFAULTS, ...parsed });
        } catch {
          /* ignore malformed config */
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof FeedbackSettings>(k: K, v: FeedbackSettings[K]) {
    setCfg(prev => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const { error } = await sb.from('app_settings').upsert(
      { key: KEY, value: JSON.stringify(cfg), updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Einstellungen gespeichert');
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" />Lade Einstellungen …</div>;
  }

  return (
    <div className="space-y-6">
      <FeedbackHeader
        title="Einstellungen"
        subtitle="Absender, Alarme, Datenschutz und Fußzeile für alle Umfragen"
        action={<Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Speichern</Button>}
      />

      <Section title="E-Mail-Versand">
        <Card><CardContent className="p-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Absendername</Label>
            <Input value={cfg.sender_name} onChange={e => set('sender_name', e.target.value)} placeholder="ALIX Lasers" />
          </div>
          <div className="space-y-2">
            <Label>Antwort-Adresse (Reply-To)</Label>
            <Input value={cfg.reply_to} onChange={e => set('reply_to', e.target.value)} placeholder="feedback@alix-lasers.com" />
          </div>
          <div className="space-y-2">
            <Label>BCC-Kopie</Label>
            <Input value={cfg.bcc} onChange={e => set('bcc', e.target.value)} placeholder="rde@alix-lasers.com" />
          </div>
        </CardContent></Card>
      </Section>

      <Section title="Kritische Rückmeldungen">
        <Card><CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Alarme aktiv</Label>
              <p className="text-xs text-muted-foreground mt-1">Erzeugt einen Eintrag unter „Auswertung“, wenn eine Bewertung unter den Schwellwerten liegt.</p>
            </div>
            <Switch checked={cfg.alert_enabled} onCheckedChange={v => set('alert_enabled', v)} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>NPS-Schwelle (kleiner oder gleich)</Label>
              <Input type="number" min={0} max={10} value={cfg.alert_nps_max} onChange={e => set('alert_nps_max', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Sterne-Schwelle (kleiner oder gleich)</Label>
              <Input type="number" min={1} max={5} value={cfg.alert_stars_max} onChange={e => set('alert_stars_max', Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Benachrichtigung an</Label>
              <Input value={cfg.alert_recipients} onChange={e => set('alert_recipients', e.target.value)} placeholder="qm@alix-lasers.com, service@…" />
            </div>
          </div>
        </CardContent></Card>
      </Section>

      <Section title="Datenschutz & Aufbewahrung">
        <Card><CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Antworten automatisch anonymisieren</Label>
              <p className="text-xs text-muted-foreground mt-1">Personenbezug wird nach Ablauf der Frist aus Antworten entfernt.</p>
            </div>
            <Switch checked={cfg.anonymize_enabled} onCheckedChange={v => set('anonymize_enabled', v)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Frist in Tagen</Label>
              <Input type="number" min={30} value={cfg.anonymize_after_days} onChange={e => set('anonymize_after_days', Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <div>
                <Label>Testimonial-Freigabe automatisch anfragen</Label>
                <p className="text-xs text-muted-foreground mt-1">Bei sehr guten Bewertungen um Veröffentlichung bitten.</p>
              </div>
              <Switch checked={cfg.testimonial_auto_request} onCheckedChange={v => set('testimonial_auto_request', v)} />
            </div>
          </div>
        </CardContent></Card>
      </Section>

      <Section title="Fußzeile der Umfragen">
        <Card><CardContent className="p-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Fußzeilentext</Label>
            <Textarea rows={3} value={cfg.footer_text} onChange={e => set('footer_text', e.target.value)} placeholder="Vielen Dank für Ihre Rückmeldung – Ihr ALIX Team" />
          </div>
          <div className="space-y-2">
            <Label>Link Datenschutz</Label>
            <Input value={cfg.privacy_url} onChange={e => set('privacy_url', e.target.value)} placeholder="https://…/datenschutz" />
          </div>
          <div className="space-y-2">
            <Label>Link Impressum</Label>
            <Input value={cfg.imprint_url} onChange={e => set('imprint_url', e.target.value)} placeholder="https://…/impressum" />
          </div>
        </CardContent></Card>
      </Section>
    </div>
  );
}
