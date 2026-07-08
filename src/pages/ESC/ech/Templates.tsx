import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Trash2, Save } from 'lucide-react';
import { deleteTemplate, getTemplates, subscribeEch, upsertTemplate } from '@/lib/esc/ech/store';
import { ECH_LANGUAGES, ECH_PLACEHOLDERS } from '@/lib/esc/ech/types';
import type { EchChannel, EchLanguage, EchTemplate } from '@/lib/esc/ech/types';
import { toast } from 'sonner';

const CHANNELS: EchChannel[] = ['email', 'sms', 'whatsapp', 'push', 'calendar_invite', 'teams', 'zoom', 'google_meet'];

export default function EchTemplates() {
  const [items, setItems] = useState<EchTemplate[]>(getTemplates());
  const [selected, setSelected] = useState<EchTemplate | null>(null);

  useEffect(() => subscribeEch(() => setItems(getTemplates())), []);

  const empty = (): EchTemplate => ({
    id: crypto.randomUUID(), slug: 'appointment_confirmed', name: 'Neue Vorlage',
    channel: 'email', language: 'de', subject: '', body: '', active: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  const grouped = useMemo(() => {
    const g: Record<string, EchTemplate[]> = {};
    items.forEach((t) => { (g[t.slug] = g[t.slug] ?? []).push(t); });
    return g;
  }, [items]);

  const save = () => { if (!selected) return; upsertTemplate(selected); toast.success('Vorlage gespeichert'); };
  const remove = (id: string) => { deleteTemplate(id); toast.success('Vorlage gelöscht'); if (selected?.id === id) setSelected(null); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Nachrichten-Vorlagen</h1>
        <Button size="sm" className="ml-auto" onClick={() => setSelected(empty())}><Plus className="w-4 h-4 mr-1" />Neu</Button>
      </div>

      <div className="grid md:grid-cols-[380px_1fr] gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vorlagen ({items.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {Object.entries(grouped).map(([slug, list]) => (
              <div key={slug}>
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground pt-1.5">{slug}</div>
                {list.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`cursor-pointer rounded-md p-2 border ${selected?.id === t.id ? 'border-primary/40 bg-primary/10' : 'border-border/50 hover:bg-muted/30'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[12.5px]">
                      <span className="truncate">{t.name}</span>
                      <Badge variant="outline" className="ml-auto text-[9.5px] uppercase">{t.channel}</Badge>
                      <Badge variant="secondary" className="text-[9.5px]">{t.language}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Editor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!selected && <div className="text-[12.5px] text-muted-foreground">Vorlage auswählen oder „Neu" klicken.</div>}
            {selected && (
              <>
                <div className="grid md:grid-cols-4 gap-3">
                  <div><Label className="text-[11px]">Name</Label><Input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></div>
                  <div><Label className="text-[11px]">Slug</Label><Input value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} /></div>
                  <div>
                    <Label className="text-[11px]">Kanal</Label>
                    <Select value={selected.channel} onValueChange={(v) => setSelected({ ...selected, channel: v as EchChannel })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Sprache</Label>
                    <Select value={selected.language} onValueChange={(v) => setSelected({ ...selected, language: v as EchLanguage })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ECH_LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {selected.channel === 'email' && (
                  <div>
                    <Label className="text-[11px]">Betreff</Label>
                    <Input value={selected.subject ?? ''} onChange={(e) => setSelected({ ...selected, subject: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label className="text-[11px]">Inhalt</Label>
                  <Textarea rows={12} value={selected.body} onChange={(e) => setSelected({ ...selected, body: e.target.value })} className="font-mono text-[12px]" />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Verfügbare Platzhalter: {ECH_PLACEHOLDERS.map((p) => <code key={p} className="px-1 mr-1 rounded bg-muted/50">{`{{${p}}}`}</code>)}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => remove(selected.id)}><Trash2 className="w-4 h-4 mr-1" />Löschen</Button>
                  <Button onClick={save}><Save className="w-4 h-4 mr-1" />Speichern</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
