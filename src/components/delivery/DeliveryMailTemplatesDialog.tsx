import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, Save } from 'lucide-react';
import { toast } from 'sonner';

const KEY = 'delivery_journey_mail_templates';

export const DELIVERY_PHASES: { value: string; label: string }[] = [
  { value: '_default', label: 'Standard (alle Phasen ohne eigene Vorlage)' },
  { value: 'order_received', label: 'Auftrag eingegangen' },
  { value: 'order_check', label: 'Auftragsprüfung' },
  { value: 'production_planned', label: 'Produktion geplant' },
  { value: 'in_production', label: 'In Produktion' },
  { value: 'qc', label: 'Qualitätsprüfung' },
  { value: 'provisioning', label: 'Bereitstellung' },
  { value: 'tour_planning', label: 'Tourenplanung' },
  { value: 'out_for_delivery', label: 'Auslieferung' },
  { value: 'delivered', label: 'Geliefert' },
];

type Tpl = { subject: string; body: string; enabled: boolean };

const EMPTY: Tpl = {
  subject: 'Ihr Auftrag {{auftragsnummer}}: {{phase}}',
  body:
    'Guten Tag {{kunde}},\n\nIhr Auftrag {{auftragsnummer}} befindet sich jetzt im Status: {{phase}}.\n\nVoraussichtlicher Liefertermin: {{termin}}\n\nFreundliche Grüße\nAlix Lasers ®',
  enabled: true,
};

export default function DeliveryMailTemplatesDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState('_default');
  const [all, setAll] = useState<Record<string, Tpl>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
      try {
        const raw = (data as any)?.value;
        setAll(raw ? JSON.parse(raw) : {});
      } catch { setAll({}); }
      setLoading(false);
    })();
  }, [open]);

  const current: Tpl = all[phase] ?? EMPTY;
  const set = (patch: Partial<Tpl>) => setAll((a) => ({ ...a, [phase]: { ...current, ...patch } }));

  async function save() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase.from('app_settings') as any).upsert(
      { key: KEY, value: JSON.stringify(all), updated_by: u.user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Vorlagen gespeichert');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Mail className="w-4 h-4 mr-1" /> E-Mail-Vorlagen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Lieferstatus – E-Mail-Vorlagen</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Phase</Label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELIVERY_PHASES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={current.enabled !== false} onCheckedChange={(v) => set({ enabled: v })} />
              <Label>Versand für diese Phase aktiv</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Betreff</Label>
              <Input value={current.subject} onChange={(e) => set({ subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Text</Label>
              <Textarea rows={10} value={current.body} onChange={(e) => set({ body: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Platzhalter: {'{{kunde}}'}, {'{{auftragsnummer}}'}, {'{{phase}}'}, {'{{termin}}'}, {'{{grund}}'}, {'{{hinweis}}'}
            </p>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving} size="sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Speichern
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
