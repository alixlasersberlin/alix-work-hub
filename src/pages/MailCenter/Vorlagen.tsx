import { useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus, Search, Pencil, Trash2, Copy, Eye, Power, FileText, Loader2,
  Bold, Italic, Heading1, Heading2, List, ListOrdered, Link as LinkIcon,
  Table as TableIcon, Image as ImageIcon, MousePointer as MousePointerSquare, PenLine,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Tpl = {
  id: string;
  name: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  category: string | null;
  department: string | null;
  language: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const CATEGORIES = ['order', 'finance', 'service', 'repair', 'delivery', 'marketing', 'newsletter', 'internal', 'custom'];
const DEPARTMENTS = ['Finance', 'Vertrieb', 'Service', 'Marketing', 'Technik', 'Tourenplanung', 'Bestellwesen', 'Kundenservice'];
const LANGUAGES = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'Englisch' },
  { value: 'fr', label: 'Französisch' },
  { value: 'it', label: 'Italienisch' },
];

const PLACEHOLDERS = [
  '{{kunde}}', '{{firma}}', '{{kundennummer}}', '{{email}}', '{{telefon}}',
  '{{auftragsnummer}}', '{{rechnungsnummer}}', '{{ticketnummer}}',
  '{{geraet}}', '{{betrag}}', '{{liefertermin}}', '{{bearbeiter}}',
];

const SAMPLE_DATA: Record<string, string> = {
  kunde: 'Max Mustermann',
  firma: 'Muster GmbH',
  kundennummer: 'K-10042',
  email: 'max@muster.de',
  telefon: '+49 30 1234567',
  auftragsnummer: 'ALX-1001',
  rechnungsnummer: 'RE-2026-0042',
  ticketnummer: 'TCK-7711',
  geraet: 'Alix Premium 3000',
  betrag: '1.500,00 EUR',
  liefertermin: '15.06.2026',
  bearbeiter: 'Anna Schmidt',
};

function renderWithSample(text: string): string {
  return (text ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE_DATA[k] ?? `{{${k}}}`);
}

function emptyTpl(): Partial<Tpl> {
  return {
    name: '',
    subject: '',
    body_html: '',
    body_text: '',
    category: 'custom',
    department: 'Kundenservice',
    language: 'de',
    is_active: true,
  };
}

export default function MailCenterVorlagen() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const isAdmin = isSuperAdmin || roles.includes('Admin');
  const isGF = roles.includes('Geschäftsführung');
  const isMarketing = roles.includes('Marketing');
  const isFinance = roles.includes('Finance');
  const isService = roles.includes('Kundenservice');
  const isTechnik = roles.includes('Technik');
  const isVertrieb = roles.includes('Vertrieb');
  const isReadOnly = roles.includes('Read Only') || roles.includes('Read Only Audit');

  const canCreate = isAdmin || isGF || isMarketing || isFinance || isService || isTechnik || isVertrieb;
  const canDelete = isSuperAdmin;

  const allowedCategory = (cat: string | null): boolean => {
    if (isAdmin || isGF) return true;
    const c = (cat ?? '').toLowerCase();
    if (isMarketing && ['marketing', 'newsletter'].includes(c)) return true;
    if (isFinance && c === 'finance') return true;
    if ((isService || isTechnik) && ['service', 'repair'].includes(c)) return true;
    if (isVertrieb && ['order', 'custom'].includes(c)) return true;
    return false;
  };

  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Tpl> | null>(null);
  const [saving, setSaving] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTpl, setPreviewTpl] = useState<Tpl | Partial<Tpl> | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const htmlRef = useRef<HTMLTextAreaElement | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mail_templates')
      .select('id,name,subject,body_html,body_text,category,department,language,is_active,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) toast.error('Vorlagen konnten nicht geladen werden');
    setRows((data ?? []) as Tpl[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== 'all' && (r.category ?? '') !== category) return false;
      if (!q) return true;
      return (r.name + ' ' + r.subject + ' ' + (r.department ?? '')).toLowerCase().includes(q);
    });
  }, [rows, query, category]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(emptyTpl());
    setEditorOpen(true);
  };
  const openEdit = (t: Tpl) => {
    if (!allowedCategory(t.category) && !isAdmin && !isGF) {
      toast.error('Keine Berechtigung für diese Kategorie');
      return;
    }
    setEditing({ ...t });
    setEditorOpen(true);
  };

  const insertAtCursor = (snippet: string) => {
    const el = htmlRef.current;
    const current = (editing?.body_html ?? '') as string;
    if (!el) {
      setEditing((e) => ({ ...(e ?? {}), body_html: current + snippet }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    setEditing((e) => ({ ...(e ?? {}), body_html: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const wrapSelection = (before: string, after: string) => {
    const el = htmlRef.current;
    const current = (editing?.body_html ?? '') as string;
    if (!el) return insertAtCursor(before + after);
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = current.slice(start, end) || 'Text';
    const next = current.slice(0, start) + before + selected + after + current.slice(end);
    setEditing((e) => ({ ...(e ?? {}), body_html: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.subject) {
      toast.error('Name und Betreff sind erforderlich');
      return;
    }
    if (!allowedCategory(editing.category ?? null) && !isAdmin && !isGF) {
      toast.error('Keine Berechtigung für diese Kategorie');
      return;
    }
    setSaving(true);
    const payload = {
      name: editing.name,
      subject: editing.subject,
      body_html: editing.body_html ?? '',
      body_text: editing.body_text ?? '',
      category: editing.category ?? null,
      department: editing.department ?? null,
      language: editing.language ?? 'de',
      is_active: editing.is_active ?? true,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from('mail_templates').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('mail_templates').insert(payload));
    }
    setSaving(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success(editing.id ? 'Vorlage aktualisiert' : 'Vorlage erstellt');
    setEditorOpen(false);
    setEditing(null);
    reload();
  };

  const duplicate = async (t: Tpl) => {
    if (!canCreate) return;
    const { error } = await supabase.from('mail_templates').insert({
      name: t.name + ' (Kopie)',
      subject: t.subject,
      body_html: t.body_html,
      body_text: t.body_text,
      category: t.category,
      department: t.department,
      language: t.language,
      is_active: true,
    });
    if (error) return toast.error('Duplizieren fehlgeschlagen: ' + error.message);
    toast.success('Vorlage dupliziert');
    reload();
  };

  const toggleActive = async (t: Tpl) => {
    const { error } = await supabase
      .from('mail_templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id);
    if (error) return toast.error('Status konnte nicht geändert werden');
    toast.success(!t.is_active ? 'Vorlage aktiviert' : 'Vorlage deaktiviert');
    reload();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('mail_templates').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) return toast.error('Löschen fehlgeschlagen: ' + error.message);
    toast.success('Vorlage gelöscht');
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Vorlagen</h2>
          <p className="text-sm text-muted-foreground">
            Erstellen, bearbeiten, duplizieren und deaktivieren Sie wiederverwendbare E-Mail-Vorlagen.
          </p>
        </div>
        <Button onClick={openCreate} disabled={!canCreate || isReadOnly}>
          <Plus className="w-4 h-4 mr-2" /> Neue Vorlage
        </Button>
      </div>

      <Card className="card-glow">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Vorlagen suchen…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Abteilung</TableHead>
                  <TableHead>Sprache</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="w-56 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex justify-center py-8 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <FileText className="w-8 h-8 opacity-40 mb-2" />
                        <p className="text-sm">Keine Vorlagen gefunden.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm max-w-[260px] truncate">{t.subject}</TableCell>
                      <TableCell><Badge variant="outline">{t.category ?? '—'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.department ?? '—'}</TableCell>
                      <TableCell className="text-sm uppercase">{t.language ?? 'de'}</TableCell>
                      <TableCell>
                        {t.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30" variant="outline">Aktiv</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inaktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString('de-DE') : '—'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Anzeigen"
                          onClick={() => { setPreviewTpl(t); setPreviewOpen(true); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Bearbeiten"
                          onClick={() => openEdit(t)}
                          disabled={isReadOnly || (!isAdmin && !isGF && !allowedCategory(t.category))}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Duplizieren"
                          onClick={() => duplicate(t)} disabled={!canCreate || isReadOnly}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t.is_active ? 'Deaktivieren' : 'Aktivieren'}
                          onClick={() => toggleActive(t)}
                          disabled={isReadOnly || (!isAdmin && !isGF && !allowedCategory(t.category))}>
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Löschen"
                          onClick={() => setDeleteId(t.id)} disabled={!canDelete}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine wiederverwendbare E-Mail-Vorlage mit Platzhaltern.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={editing.name ?? ''}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Betreff</Label>
                    <Input value={editing.subject ?? ''}
                      onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                  </div>
                  <div>
                    <Label>Kategorie</Label>
                    <Select value={editing.category ?? 'custom'}
                      onValueChange={(v) => setEditing({ ...editing, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Abteilung</Label>
                    <Select value={editing.department ?? 'Kundenservice'}
                      onValueChange={(v) => setEditing({ ...editing, department: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sprache</Label>
                    <Select value={editing.language ?? 'de'}
                      onValueChange={(v) => setEditing({ ...editing, language: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch checked={!!editing.is_active}
                      onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                    <Label>Aktiv</Label>
                  </div>
                </div>

                <Tabs defaultValue="html">
                  <TabsList>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="preview">Vorschau</TabsTrigger>
                  </TabsList>

                  <TabsContent value="html" className="space-y-2">
                    <div className="flex flex-wrap gap-1 border border-border rounded-md p-1 bg-muted/30">
                      <Button type="button" size="sm" variant="ghost" onClick={() => wrapSelection('<strong>', '</strong>')}><Bold className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => wrapSelection('<em>', '</em>')}><Italic className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => wrapSelection('<h1>', '</h1>')}><Heading1 className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => wrapSelection('<h2>', '</h2>')}><Heading2 className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('\n<ul>\n  <li>Punkt 1</li>\n  <li>Punkt 2</li>\n</ul>\n')}><List className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('\n<ol>\n  <li>Schritt 1</li>\n  <li>Schritt 2</li>\n</ol>\n')}><ListOrdered className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('\n<table style="border-collapse:collapse;width:100%">\n  <tr><th style="border:1px solid #ccc;padding:6px">Spalte 1</th><th style="border:1px solid #ccc;padding:6px">Spalte 2</th></tr>\n  <tr><td style="border:1px solid #ccc;padding:6px">A</td><td style="border:1px solid #ccc;padding:6px">B</td></tr>\n</table>\n')}><TableIcon className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('<a href="https://alix-finance.de">Link</a>')}><LinkIcon className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('<a href="https://alix-finance.de" style="display:inline-block;background:#d4af37;color:#000;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Jetzt ansehen</a>')}><MousePointerSquare className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('<img src="https://alix-finance.de/logo.png" alt="Logo" style="max-width:160px;height:auto" />')}><ImageIcon className="w-4 h-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => insertAtCursor('<p style="font-size:12px;color:#777;margin-top:24px">Mit freundlichen Grüßen<br/>{{bearbeiter}}<br/>Alix Finance</p>')}><PenLine className="w-4 h-4" /></Button>
                    </div>
                    <Textarea
                      ref={htmlRef}
                      rows={16}
                      className="font-mono text-xs"
                      value={(editing.body_html ?? '') as string}
                      onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                      placeholder="<p>Hallo {{kunde}},</p>"
                    />
                  </TabsContent>

                  <TabsContent value="text">
                    <Textarea
                      rows={16}
                      value={(editing.body_text ?? '') as string}
                      onChange={(e) => setEditing({ ...editing, body_text: e.target.value })}
                      placeholder="Plain-Text Variante (optional)"
                    />
                  </TabsContent>

                  <TabsContent value="preview">
                    <div className="border border-border rounded-md p-4 bg-white text-black min-h-[300px]">
                      <div className="text-xs text-gray-500 mb-2">
                        <strong>Betreff:</strong> {renderWithSample(editing.subject ?? '')}
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderWithSample(editing.body_html ?? '')) }} />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <aside className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Platzhalter</Label>
                <div className="grid grid-cols-1 gap-1">
                  {PLACEHOLDERS.map((p) => (
                    <Button key={p} type="button" variant="outline" size="sm"
                      className="justify-start font-mono text-xs"
                      onClick={() => insertAtCursor(p)}>
                      {p}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Klick fügt den Platzhalter an der Cursor-Position im HTML-Editor ein.
                </p>
              </aside>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditorOpen(false); setEditing(null); }}>
              Abbrechen
            </Button>
            <Button variant="secondary"
              onClick={() => { if (editing) { setPreviewTpl(editing); setPreviewOpen(true); } }}>
              <Eye className="w-4 h-4 mr-2" /> Vorschau
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vorschau</DialogTitle>
            <DialogDescription>Mit Beispieldaten gerendert.</DialogDescription>
          </DialogHeader>
          {previewTpl && (
            <div className="space-y-3">
              <div className="text-sm">
                <div><span className="text-muted-foreground">Name:</span> {previewTpl.name}</div>
                <div><span className="text-muted-foreground">Betreff:</span> {renderWithSample(previewTpl.subject ?? '')}</div>
              </div>
              <div className="border border-border rounded-md p-4 bg-white text-black">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderWithSample(previewTpl.body_html ?? '')) }} />
              </div>
              {previewTpl.body_text && (
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Text-Variante</Label>
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md">
                    {renderWithSample(previewTpl.body_text ?? '')}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Tipp: Deaktivieren statt löschen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
