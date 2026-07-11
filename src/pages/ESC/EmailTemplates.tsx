import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';

type Dept = { id: string; name: string; color: string; slug: string };
type Template = {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  template_type: string;
  department_id: string | null;
  is_active: boolean;
  is_default: boolean;
};

const TEMPLATE_TYPES: { value: string; label: string }[] = [
  { value: 'confirmation',   label: 'Terminbestätigung' },
  { value: 'reminder',       label: 'Erinnerung' },
  { value: 'reschedule',     label: 'Verschiebung' },
  { value: 'cancellation',   label: 'Absage' },
  { value: 'invitation',     label: 'Einladung' },
  { value: 'followup',       label: 'Nachfassung' },
  { value: 'internal',       label: 'Interne Info' },
  { value: 'custom',         label: 'Sonstige' },
];

const empty = (): Partial<Template> => ({
  name: '', subject: '', body_html: '', body_text: '',
  template_type: 'confirmation', department_id: null,
  is_active: true, is_default: false,
});

export default function EmailTemplates() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Template>>(empty());

  async function load() {
    setLoading(true);
    const [d, t] = await Promise.all([
      supabase.from('esc_departments').select('id, name, color, slug').eq('is_active', true).order('name'),
      supabase.from('esc_email_templates').select('*').order('name'),
    ]);
    if (d.error) toast.error('Abteilungen: ' + d.error.message);
    if (t.error) toast.error('Vorlagen: ' + t.error.message);
    setDepts((d.data ?? []) as Dept[]);
    setTemplates((t.data ?? []) as Template[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string | 'null', Template[]>();
    for (const t of templates) {
      const k = t.department_id ?? 'null';
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return map;
  }, [templates]);

  function openNew(deptId: string | null) {
    setDraft({ ...empty(), department_id: deptId });
    setOpen(true);
  }
  function openEdit(t: Template) {
    setDraft(t);
    setOpen(true);
  }

  async function save() {
    if (!draft.name || !draft.subject || !draft.body_html) {
      toast.error('Name, Betreff und Inhalt sind Pflicht');
      return;
    }
    const payload = {
      name: draft.name!,
      subject: draft.subject!,
      body_html: draft.body_html!,
      body_text: draft.body_text ?? null,
      template_type: draft.template_type ?? 'custom',
      department_id: draft.department_id ?? null,
      is_active: draft.is_active ?? true,
      is_default: draft.is_default ?? false,
    };
    const q = draft.id
      ? supabase.from('esc_email_templates').update(payload).eq('id', draft.id)
      : supabase.from('esc_email_templates').insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success('Vorlage gespeichert');
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Vorlage wirklich löschen?')) return;
    const { error } = await supabase.from('esc_email_templates').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Gelöscht');
    load();
  }

  const groups: { id: string | null; name: string; color?: string }[] = [
    ...depts.map((d) => ({ id: d.id, name: d.name, color: d.color })),
    { id: null, name: 'Allgemein / abteilungsübergreifend' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">E-Mail-Vorlagen</h1>
        <span className="text-[12px] text-muted-foreground ml-2">
          Pro Abteilung individuelle Vorlagen für Bestätigung, Erinnerung, Verschiebung, Absage & Co.
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lädt …</div>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => {
            const items = grouped.get(g.id ?? 'null') ?? [];
            return (
              <Card key={g.id ?? 'null'}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-[14px] flex items-center gap-2">
                    {g.color && <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />}
                    {g.name}
                    <Badge variant="outline" className="ml-1 text-[10px]">{items.length}</Badge>
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => openNew(g.id)}>
                    <Plus className="w-4 h-4 mr-1" /> Vorlage
                  </Button>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-[12px] text-muted-foreground">Noch keine Vorlagen hinterlegt.</div>
                  ) : (
                    <div className="grid gap-2">
                      {items.map((t) => (
                        <div key={t.id} className="flex items-start justify-between gap-3 border rounded-md px-3 py-2 bg-card/40">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[13px] font-medium">
                              {t.is_default && <Star className="w-3.5 h-3.5 text-amber-500" />}
                              {t.name}
                              <Badge variant="secondary" className="text-[10px]">
                                {TEMPLATE_TYPES.find((x) => x.value === t.template_type)?.label ?? t.template_type}
                              </Badge>
                              {!t.is_active && <Badge variant="outline" className="text-[10px]">inaktiv</Badge>}
                            </div>
                            <div className="text-[12px] text-muted-foreground truncate">{t.subject}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Name</Label>
                <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Typ</Label>
                <Select value={draft.template_type ?? 'custom'} onValueChange={(v) => setDraft({ ...draft, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Abteilung</Label>
              <Select
                value={draft.department_id ?? '__none'}
                onValueChange={(v) => setDraft({ ...draft, department_id: v === '__none' ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Allgemein / abteilungsübergreifend</SelectItem>
                  {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Betreff</Label>
              <Input value={draft.subject ?? ''} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Inhalt (HTML)</Label>
              <Textarea rows={8} value={draft.body_html ?? ''} onChange={(e) => setDraft({ ...draft, body_html: e.target.value })} />
              <div className="text-[11px] text-muted-foreground">
                Platzhalter: <code>{'{{customer_name}}'}</code>, <code>{'{{event_title}}'}</code>, <code>{'{{event_date}}'}</code>, <code>{'{{event_time}}'}</code>, <code>{'{{location}}'}</code>, <code>{'{{department}}'}</code>, <code>{'{{confirm_url}}'}</code>, <code>{'{{cancel_url}}'}</code>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Text-Fassung (Fallback)</Label>
              <Textarea rows={4} value={draft.body_text ?? ''} onChange={(e) => setDraft({ ...draft, body_text: e.target.value })} />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={draft.is_active ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                <Label className="text-xs">Aktiv</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.is_default ?? false} onCheckedChange={(v) => setDraft({ ...draft, is_default: v })} />
                <Label className="text-xs">Standard für diesen Typ</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
