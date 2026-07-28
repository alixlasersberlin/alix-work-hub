import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, Bold, Italic, List, ListOrdered, Heading2, Quote, Undo, Redo } from 'lucide-react';

export default function AlixDocs2Editor() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: () => setDirty(true),
  });

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data } = await supabase
        .from('alixdocs2_documents')
        .select('id,title,editor_html,doc_type,updated_at')
        .eq('id', id)
        .maybeSingle();
      setDoc(data);
      if (editor && data?.editor_html) editor.commands.setContent(data.editor_html);
    })();
  }, [id, editor]);

  async function save() {
    if (!id || !editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();
      const { error } = await supabase
        .from('alixdocs2_documents')
        .update({ editor_html: html, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      // Snapshot als Version
      const { data: last } = await supabase
        .from('alixdocs2_versions').select('version').eq('document_id', id).order('version', { ascending: false }).limit(1);
      const nextV = ((last?.[0]?.version as number | undefined) ?? 0) + 1;
      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from('alixdocs2_versions').insert({
        document_id: id, version: nextV, note: html.replace(/<[^>]+>/g, ' ').slice(0, 4000), created_by: userRes.user?.id ?? null,
      } as any);
      setDirty(false);
      toast.success(`Gespeichert (v${nextV})`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  // Autosave nach 3s Inaktivität
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void save(); }, 3000);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  if (!editor) return null;

  const btn = "p-1.5 rounded hover:bg-muted text-muted-foreground";
  const active = "bg-muted text-foreground";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" asChild>
          <Link to={`/alixdocs2/dokument/${id}`}><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</Link>
        </Button>
        <h1 className="text-xl font-semibold flex-1 truncate">{doc?.title ?? 'Editor'}</h1>
        {dirty && <Badge variant="outline">ungespeichert</Badge>}
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Speichern
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <button className={`${btn} ${editor.isActive('bold') ? active : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></button>
            <button className={`${btn} ${editor.isActive('italic') ? active : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></button>
            <button className={`${btn} ${editor.isActive('heading', { level: 2 }) ? active : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></button>
            <button className={`${btn} ${editor.isActive('bulletList') ? active : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></button>
            <button className={`${btn} ${editor.isActive('orderedList') ? active : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></button>
            <button className={`${btn} ${editor.isActive('blockquote') ? active : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></button>
            <span className="mx-1 h-4 w-px bg-border" />
            <button className={btn} onClick={() => editor.chain().focus().undo().run()}><Undo className="w-4 h-4" /></button>
            <button className={btn} onClick={() => editor.chain().focus().redo().run()}><Redo className="w-4 h-4" /></button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditorContent
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none [&_.ProseMirror]:min-h-[380px] [&_.ProseMirror]:outline-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
