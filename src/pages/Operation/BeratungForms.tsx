import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ExternalLink, Copy, Eye, EyeOff, Loader2, Save, MessagesSquare, Code2, ArrowUp, ArrowDown, RotateCcw, GripVertical, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import {
  BERATUNG_FORMS_META,
  BERATUNG_FORMS_DEFAULTS,
  loadBeratungForms,
  saveBeratungForms,
  type BeratungFormsConfig,
  type BeratungFormKey,
} from '@/lib/beratung/formSettings';
import {
  BERATUNG_LAYOUT_DEFAULTS,
  loadBeratungLayout,
  saveBeratungLayout,
  stepDefs,
  optionLists,
  defaultLayout,
  type BeratungLayoutConfig,
} from '@/lib/beratung/formLayout';

export default function BeratungForms() {
  const [cfg, setCfg] = useState<BeratungFormsConfig>(BERATUNG_FORMS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BeratungFormKey | null>(null);
  const [layout, setLayout] = useState<BeratungLayoutConfig>(BERATUNG_LAYOUT_DEFAULTS);

  useEffect(() => {
    Promise.all([loadBeratungForms(), loadBeratungLayout()]).then(([c, l]) => {
      setCfg(c);
      setLayout(l);
      setLoading(false);
    });
  }, []);

  const moveStep = (form: BeratungFormKey, id: number, dir: -1 | 1) =>
    setLayout((prev) => {
      const order = [...prev[form].order];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return prev;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...prev, [form]: { ...prev[form], order } };
    });

  const setStepCfg = (form: BeratungFormKey, id: number, patch: Record<string, unknown>) =>
    setLayout((prev) => ({
      ...prev,
      [form]: {
        ...prev[form],
        steps: { ...prev[form].steps, [String(id)]: { ...(prev[form].steps?.[String(id)] || {}), ...patch } },
      },
    }));

  const [newOption, setNewOption] = useState<Record<string, string>>({});

  const allOptions = (form: BeratungFormKey, key: string, defaults: string[]) => {
    const oc = layout[form].options?.[key] || {};
    const all = [...defaults, ...(oc.extra || []).filter((e) => !defaults.includes(e))];
    const order = oc.order || [];
    return [...order.filter((o) => all.includes(o)), ...all.filter((o) => !order.includes(o))];
  };

  const setOptionCfg = (
    form: BeratungFormKey,
    key: string,
    patch: { order?: string[]; hidden?: string[]; extra?: string[] },
  ) =>
    setLayout((prev) => ({
      ...prev,
      [form]: {
        ...prev[form],
        options: {
          ...(prev[form].options || {}),
          [key]: { ...((prev[form].options || {})[key] || {}), ...patch },
        },
      },
    }));

  const moveOption = (form: BeratungFormKey, key: string, defaults: string[], value: string, dir: -1 | 1) => {
    const order = allOptions(form, key, defaults);
    const i = order.indexOf(value);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setOptionCfg(form, key, { order });
  };

  const addOption = (form: BeratungFormKey, key: string, defaults: string[]) => {
    const k = `${form}:${key}`;
    const value = (newOption[k] || '').trim();
    if (!value) return;
    const existing = allOptions(form, key, defaults);
    if (existing.includes(value)) {
      toast.error('Option existiert bereits');
      return;
    }
    const oc = layout[form].options?.[key] || {};
    setOptionCfg(form, key, { extra: [...(oc.extra || []), value], order: [...existing, value] });
    setNewOption((p) => ({ ...p, [k]: '' }));
  };

  const resetLayout = (form: BeratungFormKey) =>
    setLayout((prev) => ({ ...prev, [form]: defaultLayout(form) }));

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const set = (key: BeratungFormKey, patch: Partial<BeratungFormsConfig[BeratungFormKey]>) =>
    setCfg((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopiert`);
    } catch {
      toast.error('Kopieren nicht möglich');
    }
  };

  const save = async () => {
    setSaving(true);
    const [{ error }, { error: e2 }] = await Promise.all([saveBeratungForms(cfg), saveBeratungLayout(layout)]);
    setSaving(false);
    const err = error || e2;
    if (err) toast.error(err.message);
    else toast.success('Beratungsformulare gespeichert');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Beratungsformulare …
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={MessagesSquare}
          title="Beratung"
          subtitle="Öffentliche Beratungsformulare öffnen, einbetten und bearbeiten."
          noBreadcrumbs
        />
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Speichern
        </Button>
      </div>

      <div className="grid gap-4">
        {BERATUNG_FORMS_META.map((meta) => {
          const item = cfg[meta.key];
          const primary = meta.routes[0];
          const url = `${origin}${primary}`;
          const embed = `<iframe src="${url}?embed=1" style="width:100%;min-height:900px;border:0" title="${meta.name}"></iframe>`;
          const isPreview = preview === meta.key;

          return (
            <Card key={meta.key}>
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <CardTitle className="text-base">{meta.name}</CardTitle>
                <Badge variant={item.active === false ? 'outline' : 'default'} className="text-[10px]">
                  {item.active === false ? 'Inaktiv' : 'Aktiv'}
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Label htmlFor={`active-${meta.key}`} className="text-xs text-muted-foreground">
                    Aktiv
                  </Label>
                  <Switch
                    id={`active-${meta.key}`}
                    checked={item.active !== false}
                    onCheckedChange={(v) => set(meta.key, { active: v })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{meta.description}</p>

                <div className="flex flex-wrap gap-2">
                  {meta.routes.map((r) => (
                    <Button key={r} asChild size="sm" variant="outline">
                      <a href={r} target="_blank" rel="noreferrer">
                        {r} <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => copy(url, 'Link')}>
                    <Copy className="h-3 w-3 mr-1" /> Link kopieren
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copy(embed, 'Embed-Code')}>
                    <Code2 className="h-3 w-3 mr-1" /> Embed-Code
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(isPreview ? null : meta.key)}>
                    {isPreview ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    Vorschau
                  </Button>
                </div>

                <Separator />

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Danke-Titel (Überschreibung)</Label>
                    <Input
                      value={item.thanks_title ?? ''}
                      placeholder="Standardtext des Formulars"
                      onChange={(e) => set(meta.key, { thanks_title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Danke-Hinweis (Überschreibung)</Label>
                    <Input
                      value={item.thanks_hint ?? ''}
                      placeholder="Optionaler Zusatzhinweis"
                      onChange={(e) => set(meta.key, { thanks_hint: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Danke-Text (Überschreibung)</Label>
                    <Textarea
                      rows={2}
                      value={item.thanks_text ?? ''}
                      placeholder="Standardtext des Formulars"
                      onChange={(e) => set(meta.key, { thanks_text: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Interne Notiz</Label>
                    <Textarea
                      rows={2}
                      value={item.note ?? ''}
                      placeholder="Nur intern sichtbar"
                      onChange={(e) => set(meta.key, { note: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm">Schritte & Reihenfolge</Label>
                      <p className="text-xs text-muted-foreground">
                        Reihenfolge per Pfeil ändern, Schritte ausblenden und Überschriften überschreiben.
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => resetLayout(meta.key)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Zurücksetzen
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {layout[meta.key].order.map((id, idx) => {
                      const def = stepDefs(meta.key).find((d) => d.id === id);
                      if (!def) return null;
                      const st = layout[meta.key].steps?.[String(id)] || {};
                      const hidden = !def.required && st.hidden === true;
                      return (
                        <div
                          key={id}
                          className={`rounded-lg border p-3 space-y-2 ${hidden ? 'opacity-60 bg-muted/40' : 'bg-card'}`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="text-[10px]">
                              {String(idx + 1).padStart(2, '0')}
                            </Badge>
                            <span className="text-sm font-medium">{def.name}</span>
                            <span className="text-xs text-muted-foreground">{def.note}</span>
                            <div className="ml-auto flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={idx === 0}
                                onClick={() => moveStep(meta.key, id, -1)}
                                aria-label="Nach oben"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={idx === layout[meta.key].order.length - 1}
                                onClick={() => moveStep(meta.key, id, 1)}
                                aria-label="Nach unten"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              {def.required ? (
                                <Badge variant="secondary" className="text-[10px] ml-1">Pflicht</Badge>
                              ) : (
                                <div className="flex items-center gap-1 ml-1">
                                  <Label className="text-[11px] text-muted-foreground">Sichtbar</Label>
                                  <Switch
                                    checked={!hidden}
                                    onCheckedChange={(v) => setStepCfg(meta.key, id, { hidden: !v })}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              value={st.title ?? ''}
                              placeholder="Überschrift (Standard beibehalten)"
                              onChange={(e) => setStepCfg(meta.key, id, { title: e.target.value || undefined })}
                            />
                            <Input
                              value={st.sub ?? ''}
                              placeholder="Hinweistext (Standard beibehalten)"
                              onChange={(e) => setStepCfg(meta.key, id, { sub: e.target.value || undefined })}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Auswahloptionen</Label>
                    <p className="text-xs text-muted-foreground">
                      Optionen ein-/ausblenden, sortieren oder eigene Optionen hinzufügen.
                    </p>
                  </div>
                  {optionLists(meta.key).map((list) => {
                    const values = allOptions(meta.key, list.key, list.defaults);
                    const oc = layout[meta.key].options?.[list.key] || {};
                    const hidden = new Set(oc.hidden || []);
                    return (
                      <div key={list.key} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{list.name}</span>
                          <Badge variant="outline" className="text-[10px]">Schritt {list.stepId}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto"
                            onClick={() => setOptionCfg(meta.key, list.key, { order: undefined, hidden: [], extra: [] })}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Zurücksetzen
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {values.map((v, i) => {
                            const isExtra = !list.defaults.includes(v);
                            return (
                              <div key={v} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                                <Switch
                                  checked={!hidden.has(v)}
                                  onCheckedChange={(on) =>
                                    setOptionCfg(meta.key, list.key, {
                                      hidden: on ? (oc.hidden || []).filter((h) => h !== v) : [...(oc.hidden || []), v],
                                    })
                                  }
                                />
                                <span className={`text-sm ${hidden.has(v) ? 'text-muted-foreground line-through' : ''}`}>
                                  {v}
                                </span>
                                {isExtra && <Badge variant="secondary" className="text-[10px]">eigene</Badge>}
                                <div className="ml-auto flex items-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0}
                                    onClick={() => moveOption(meta.key, list.key, list.defaults, v, -1)} aria-label="Nach oben">
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === values.length - 1}
                                    onClick={() => moveOption(meta.key, list.key, list.defaults, v, 1)} aria-label="Nach unten">
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </Button>
                                  {isExtra && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7"
                                      onClick={() =>
                                        setOptionCfg(meta.key, list.key, {
                                          extra: (oc.extra || []).filter((e) => e !== v),
                                          order: (oc.order || values).filter((o) => o !== v),
                                        })
                                      }
                                      aria-label="Entfernen">
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-8"
                            placeholder="Neue Option …"
                            value={newOption[`${meta.key}:${list.key}`] ?? ''}
                            onChange={(e) => setNewOption((p) => ({ ...p, [`${meta.key}:${list.key}`]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); addOption(meta.key, list.key, list.defaults); }
                            }}
                          />
                          <Button size="sm" variant="outline" onClick={() => addOption(meta.key, list.key, list.defaults)}>
                            <Plus className="h-3 w-3 mr-1" /> Hinzufügen
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>


                <p className="text-xs text-muted-foreground">
                  Inhalte/Schritte: <code>{meta.component}</code> · Anfragen landen unter{' '}
                  <Link to="/verkauf/anfragen" className="underline">
                    Verkauf › Anfragen
                  </Link>
                  .
                </p>

                {isPreview && (
                  <div className="rounded-lg border overflow-hidden bg-background">
                    <iframe
                      src={`${primary}?embed=1`}
                      title={`${meta.name} Vorschau`}
                      className="w-full h-[600px] border-0"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
