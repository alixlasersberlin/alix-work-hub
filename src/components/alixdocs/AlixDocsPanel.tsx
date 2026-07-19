import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Files, Upload, Search, Grid3x3, List as ListIcon, Loader2, Eye, Trash2, RotateCcw,
  Plus, FileText, Image as ImageIcon, ShieldAlert, Download, CheckCircle2, Archive, Sparkles,
} from 'lucide-react';

import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DocActionsMenu from './DocActionsMenu';
import PdfPreview from './PdfPreview';

const ALLOWED = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const ALLOWED_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);
const MAX_MB = 50;

type Doc = {
  id: string;
  title: string;
  description: string | null;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  current_version: number;
  status: string;
  confidentiality_level: string;
  category_id: string | null;
  serial_number: string | null;
  document_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  uploaded_by: string | null;
  ocr_status?: string | null;
  ai_summary?: string | null;
  ai_category_suggestion?: string | null;
  ai_serial_numbers?: string[] | null;
  ai_order_numbers?: string[] | null;
  expiry_date?: string | null;
  duplicate_of?: string | null;
  tags?: string[] | null;
};

type Cat = { id: string; code: string; name: string; sort_order: number };

interface Props {
  orderId?: string | null;
  customerId?: string | null;
  orderNumber?: string;
  scope?: 'order' | 'customer';
}

export default function AlixDocsPanel({ orderId, customerId, orderNumber, scope }: Props) {
  const effectiveScope: 'order' | 'customer' = scope ?? (orderId ? 'order' : 'customer');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<'list' | 'gallery'>('list');
  const [showDeleted, setShowDeleted] = useState(false);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newVersionForId, setNewVersionForId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('sonstiges');
  const [confLevel, setConfLevel] = useState('normal');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState<string>('');
  const [serial, setSerial] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('alixdocs_documents').select('*');
    if (effectiveScope === 'order' && orderId) q = q.eq('order_id', orderId);
    else if (effectiveScope === 'customer' && customerId) q = q.eq('customer_id', customerId);
    else { setDocs([]); setLoading(false); return; }
    const [{ data: d }, { data: c }] = await Promise.all([
      q.order('created_at', { ascending: false }),
      supabase.from('alixdocs_categories').select('id, code, name, sort_order').order('sort_order'),
    ]);
    setDocs((d ?? []) as Doc[]);
    setCats((c ?? []) as Cat[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId, customerId, effectiveScope]);

  const catMap = useMemo(() => Object.fromEntries(cats.map(c => [c.id, c])), [cats]);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (showDeleted ? !d.deleted_at : !!d.deleted_at) return false;
      if (catFilter !== 'all' && catMap[d.category_id ?? '']?.code !== catFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        if (![d.title, d.description, d.original_filename, d.serial_number].some(x => x?.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [docs, showDeleted, catFilter, q, catMap]);

  const isImage = (m: string) => m.startsWith('image/');

  const resetUploadForm = () => {
    setFile(null); setTitle(''); setCategory('sonstiges'); setConfLevel('normal');
    setDescription(''); setDocumentDate(''); setSerial(''); setChangeNote('');
    setTagsInput('');
    setNewVersionForId(null);
  };

  const openUpload = (existingId?: string) => {
    resetUploadForm();
    setNewVersionForId(existingId ?? null);
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!file) { toast.error('Bitte Datei auswählen'); return; }
    if (!ALLOWED_MIME.has(file.type)) { toast.error(`Dateityp nicht erlaubt (${file.type})`); return; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Datei zu groß (max ${MAX_MB} MB)`); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (orderId) fd.append('order_id', orderId);
      if (customerId) fd.append('customer_id', customerId);
      fd.append('category_code', category);
      fd.append('title', title || file.name);
      if (description) fd.append('description', description);
      if (documentDate) fd.append('document_date', documentDate);
      if (serial) fd.append('serial_number', serial);
      fd.append('confidentiality_level', confLevel);
      if (newVersionForId) {
        fd.append('existing_document_id', newVersionForId);
        if (changeNote) fd.append('change_note', changeNote);
      }
      const { data, error } = await supabase.functions.invoke('alixdocs-upload', { body: fd });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // Tags nach dem Upload speichern (falls angegeben)
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const newDocId = (data as any)?.document_id ?? (data as any)?.id;
      if (!newVersionForId && tags.length > 0 && newDocId) {
        await supabase.from('alixdocs_documents').update({ tags }).eq('id', newDocId);
      }

      toast.success(newVersionForId ? 'Neue Version gespeichert' : 'Dokument hochgeladen');
      setUploadOpen(false);
      resetUploadForm();
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  // Drag & Drop Upload
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    resetUploadForm();
    setFile(f);
    setTitle(f.name);
    setUploadOpen(true);
  };

  const openPreview = async (d: Doc, version?: number) => {
    setPreviewDoc(d);
    setPreviewUrl(null);
    setPreviewMime(d.mime_type);
    const { data, error } = await supabase.functions.invoke('alixdocs-signed-url', {
      body: { document_id: d.id, version_number: version ?? d.current_version },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Öffnen fehlgeschlagen');
      setPreviewDoc(null);
      return;
    }
    setPreviewUrl((data as any).url);
    setPreviewMime((data as any).mime_type);
  };

  const softDelete = async (d: Doc) => {
    if (!confirm(`"${d.title}" in den Papierkorb verschieben?`)) return;
    const { data, error } = await supabase.functions.invoke('alixdocs-delete', {
      body: { document_id: d.id, action: 'soft_delete' },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('In Papierkorb verschoben');
    load();
  };

  const restore = async (d: Doc) => {
    const { data, error } = await supabase.functions.invoke('alixdocs-delete', {
      body: { document_id: d.id, action: 'restore' },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Wiederhergestellt');
    load();
  };

  const setStatus = async (d: Doc, status: string) => {
    const { error } = await supabase.from('alixdocs_documents').update({ status }).eq('id', d.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status: ${status}`);
    load();
  };

  const analyze = async (d: Doc) => {
    toast.info('KI-Analyse gestartet …');
    const { data, error } = await supabase.functions.invoke('alixdocs-ai-process', {
      body: { document_id: d.id },
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Analyse fertig${data?.category_suggestion ? ` – Kategorie: ${data.category_suggestion}` : ''}`);
    load();
  };


  const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

  const catBadge = (id: string | null) => {
    const c = catMap[id ?? ''];
    return c ? <Badge variant="outline">{c.name}</Badge> : <Badge variant="outline">—</Badge>;
  };

  const confBadge = (level: string) => {
    if (level === 'streng_vertraulich') return <Badge className="bg-red-500/15 text-red-400"><ShieldAlert className="w-3 h-3 mr-1" />streng vertraulich</Badge>;
    if (level === 'vertraulich') return <Badge className="bg-amber-500/15 text-amber-400">vertraulich</Badge>;
    return null;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      entwurf: 'bg-muted text-foreground',
      geprueft: 'bg-blue-500/15 text-blue-400',
      freigegeben: 'bg-emerald-500/15 text-emerald-400',
      archiviert: 'bg-zinc-500/15 text-zinc-400',
    };
    return <Badge className={map[s] ?? ''}>{s}</Badge>;
  };

  return (
    <div
      className={`space-y-4 relative rounded-lg transition-colors ${isDragOver ? 'ring-2 ring-primary/60 bg-primary/5' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg">
          <div className="text-center">
            <Upload className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="font-medium">Datei hier ablegen zum Hochladen</p>
          </div>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-auto">
          <Files className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">AlixDocs — Dokumente</h2>
            <p className="text-xs text-muted-foreground">
              {effectiveScope === 'order' ? `Auftrag ${orderNumber ?? ''}` : 'Kunde'} · privat · max {MAX_MB} MB · PDF/JPG/PNG/WEBP/HEIC · Drag & Drop
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-[220px]" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {cats.map(c => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex border border-border rounded-md overflow-hidden">
          <button className={`px-2.5 py-2 ${view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} onClick={() => setView('list')} title="Liste"><ListIcon className="w-4 h-4" /></button>
          <button className={`px-2.5 py-2 ${view === 'gallery' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`} onClick={() => setView('gallery')} title="Galerie"><Grid3x3 className="w-4 h-4" /></button>
        </div>
        <Button variant={showDeleted ? 'default' : 'outline'} size="sm" onClick={() => setShowDeleted(v => !v)}>
          <Trash2 className="w-4 h-4 mr-1" /> Papierkorb
        </Button>
        <Button onClick={() => openUpload()}><Upload className="w-4 h-4 mr-1" /> Hochladen</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Dokumente…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          {showDeleted ? 'Papierkorb ist leer.' : 'Noch keine Dokumente zu diesem Auftrag. Klicke „Hochladen".'}
        </Card>
      ) : view === 'list' ? (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Dokument</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Version</th>
                <th className="p-3">Datum</th>
                <th className="p-3">Größe</th>
                <th className="p-3">Status</th>
                <th className="p-3">Vertraul.</th>
                <th className="p-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {isImage(d.mime_type) ? <ImageIcon className="w-4 h-4 text-blue-400" /> : <FileText className="w-4 h-4 text-primary" />}
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {d.title}
                          {d.duplicate_of && <Badge variant="outline" className="text-amber-400 border-amber-500/40">Dublette</Badge>}
                          {d.expiry_date && <Badge variant="outline" className="text-red-400 border-red-500/40">läuft ab {d.expiry_date}</Badge>}
                          {d.ocr_status === 'pending' && <Badge variant="outline" className="text-muted-foreground"><Loader2 className="w-3 h-3 mr-1 animate-spin" />KI …</Badge>}
                        </div>
                        {d.original_filename && <div className="text-xs text-muted-foreground font-mono">{d.original_filename}</div>}
                        {d.tags && d.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {d.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                          </div>
                        )}
                        {d.ai_summary && <div className="text-xs text-muted-foreground italic mt-1 line-clamp-2 max-w-lg">💡 {d.ai_summary}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{catBadge(d.category_id)}</td>
                  <td className="p-3">v{d.current_version}</td>
                  <td className="p-3 text-xs">{new Date(d.updated_at).toLocaleDateString('de-DE')}</td>
                  <td className="p-3 text-xs">{fmtSize(d.file_size)}</td>
                  <td className="p-3">{statusBadge(d.status)}</td>
                  <td className="p-3">{confBadge(d.confidentiality_level)}</td>
                  <td className="p-3 text-right">
                    {showDeleted ? (
                      <Button size="sm" variant="ghost" onClick={() => restore(d)}><RotateCcw className="w-4 h-4" /></Button>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openPreview(d)} title="Öffnen"><Eye className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => analyze(d)} title="KI-Analyse"><Sparkles className="w-4 h-4 text-primary" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openUpload(d.id)} title="Neue Version"><Plus className="w-4 h-4" /></Button>
                        {d.status === 'entwurf' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => setStatus(d, 'freigegeben')}
                            title="Intern freigeben"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Freigeben
                          </Button>
                        )}


                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" title="Status"><CheckCircle2 className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setStatus(d, 'entwurf')}>Entwurf</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus(d, 'geprueft')}>Geprüft</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus(d, 'freigegeben')}>Freigegeben ✓</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStatus(d, 'archiviert')}><Archive className="w-3 h-3 mr-2" />Archivieren</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DocActionsMenu doc={{ id: d.id, title: d.title, mime_type: d.mime_type, customer_id: customerId ?? null }} onChanged={load} />
                        <Button size="sm" variant="ghost" onClick={() => softDelete(d)} title="Papierkorb"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(d => (
            <Card key={d.id} className="p-3 group cursor-pointer hover:border-primary/50" onClick={() => openPreview(d)}>
              <div className="aspect-square bg-muted/40 rounded flex items-center justify-center mb-2">
                {isImage(d.mime_type) ? <ImageIcon className="w-10 h-10 text-blue-400" /> : <FileText className="w-10 h-10 text-primary" />}
              </div>
              <div className="text-sm font-medium truncate" title={d.title}>{d.title}</div>
              <div className="flex items-center gap-1 flex-wrap mt-1">
                {catBadge(d.category_id)}
                <span className="text-[10px] text-muted-foreground">v{d.current_version}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!o) resetUploadForm(); setUploadOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{newVersionForId ? 'Neue Version hochladen' : 'Dokument hochladen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Datei</label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED.join(',')}
                onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name); }}
                className="block w-full text-sm mt-1"
              />
              {file && <p className="text-xs text-muted-foreground mt-1">{file.name} · {fmtSize(file.size)}</p>}
            </div>
            {!newVersionForId && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Titel</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Kaufvertrag" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Kategorie</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Vertraulichkeit</label>
                    <Select value={confLevel} onValueChange={setConfLevel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="vertraulich">Vertraulich</SelectItem>
                        <SelectItem value="streng_vertraulich">Streng vertraulich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Dokumentdatum</label>
                    <Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Seriennummer (optional)</label>
                    <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tags (Komma-getrennt)</label>
                  <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="z.B. dringend, projekt-x" />
                </div>
              </>
            )}
            {newVersionForId && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Änderungshinweis</label>
                <Input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="z.B. Korrektur Preis" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Abbrechen</Button>
            <Button onClick={submitUpload} disabled={uploading || !file}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              {newVersionForId ? 'Version speichern' : 'Hochladen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) { setPreviewDoc(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDoc?.title}
              {previewDoc && <span className="text-xs text-muted-foreground">v{previewDoc.current_version}</span>}
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener" download={previewDoc?.original_filename ?? undefined}
                   className="ml-auto text-xs text-primary inline-flex items-center gap-1 hover:underline">
                  <Download className="w-3.5 h-3.5" /> Herunterladen
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-black/40 rounded overflow-hidden">
            {!previewUrl ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Wird geladen…
              </div>
            ) : previewMime?.startsWith('image/') ? (
              <div className="h-full flex items-center justify-center overflow-auto">
                <img src={previewUrl} alt={previewDoc?.title} className="max-w-full max-h-full object-contain" />
              </div>
            ) : previewMime === 'application/pdf' ? (
              <PdfPreview url={previewUrl} />
            ) : (
              <iframe src={previewUrl} className="w-full h-full border-0 bg-white" title={previewDoc?.title} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
