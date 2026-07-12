import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const SETTING_KEY = 'sms.eta.template';

interface Tpl {
  de: string;
  at: string;
  sender: string;
}

const DEFAULTS: Tpl = {
  de: 'Hallo {{name}}, Ihr Techniker ist unterwegs und wird gegen {{eta}} Uhr eintreffen. – {{sender}}',
  at: 'Hallo {{name}}, Ihr Techniker ist unterwegs und wird gegen {{eta}} Uhr bei Ihnen eintreffen. – {{sender}}',
  sender: 'AlixLasers',
};

function preview(tpl: string, sender: string) {
  return tpl
    .replace(/\{\{eta\}\}/g, '14:30')
    .replace(/\{\{name\}\}/g, 'Frau Mustermann')
    .replace(/\{\{sender\}\}/g, sender)
    .replace(/\{\{city\}\}/g, 'Berlin');
}

export default function SmsTemplateSettings() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [tpl, setTpl] = useState<Tpl>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('app_settings')
      .select('value').eq('key', SETTING_KEY).maybeSingle();
    if (data?.value) {
      try {
        const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        setTpl({
          de: parsed?.de || DEFAULTS.de,
          at: parsed?.at || DEFAULTS.at,
          sender: parsed?.sender || DEFAULTS.sender,
        });
      } catch { /* ignore */ }
    }
    setLoading(false);
  }

  async function save() {
    if (!isAdmin) {
      toast({ title: 'Keine Berechtigung', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const value = JSON.stringify(tpl);
    const { data: existing } = await supabase.from('app_settings')
      .select('id').eq('key', SETTING_KEY).maybeSingle();
    const r = existing
      ? await supabase.from('app_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', SETTING_KEY)
      : await supabase.from('app_settings').insert({ key: SETTING_KEY, value });
    setSaving(false);
    if (r.error) {
      toast({ title: 'Fehler', description: r.error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Gespeichert', description: 'ETA-SMS-Vorlage aktualisiert.' });
    }
  }

  const previewDe = useMemo(() => preview(tpl.de, tpl.sender), [tpl]);
  const previewAt = useMemo(() => preview(tpl.at, tpl.sender), [tpl]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const lenDe = tpl.de.length;
  const lenAt = tpl.at.length;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">ETA-SMS-Vorlage</h1>
          <p className="text-sm text-muted-foreground">
            Nachricht, die Techniker beim Klick auf „ETA senden" an den Kunden schicken.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Absenderkennung & Platzhalter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sender">Absender (Alphanumeric Sender ID – max. 11 Zeichen)</Label>
            <Input id="sender" value={tpl.sender} maxLength={11}
              onChange={(e) => setTpl({ ...tpl, sender: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">
              Muss in der Twilio Console als Sender ID registriert sein. Wird als Twilio-„From" verwendet.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Verfügbare Platzhalter: <code>{'{{name}}'}</code> · <code>{'{{eta}}'}</code> ·{' '}
            <code>{'{{sender}}'}</code> · <code>{'{{city}}'}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">🇩🇪 Deutschland (Alix Deutschland)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} value={tpl.de} onChange={(e) => setTpl({ ...tpl, de: e.target.value })} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Zeichen: {lenDe} / 160 (Standard-SMS)</span>
            {lenDe > 160 && <span className="text-amber-500">Wird als Multi-Part-SMS verschickt</span>}
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <span className="text-xs text-muted-foreground">Vorschau:</span>
            <div className="mt-1">{previewDe}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">🇦🇹 Österreich (Alix Austria)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} value={tpl.at} onChange={(e) => setTpl({ ...tpl, at: e.target.value })} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Zeichen: {lenAt} / 160</span>
            {lenAt > 160 && <span className="text-amber-500">Wird als Multi-Part-SMS verschickt</span>}
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <span className="text-xs text-muted-foreground">Vorschau:</span>
            <div className="mt-1">{previewAt}</div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setTpl(DEFAULTS)} disabled={saving}>Zurücksetzen</Button>
        <Button onClick={save} disabled={saving || !isAdmin}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}
