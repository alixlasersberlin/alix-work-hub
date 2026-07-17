import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import FieldEditor, { EditorSigner, SigField } from '@/components/signaturen/FieldEditor';

const DOC_TYPES = [
  'angebot','auftrag','rechnung','lieferschein','servicebericht','arbeitsbericht',
  'wartungsprotokoll','reparaturbericht','abnahmeprotokoll','leasing','finanzierung',
  'mietvertrag','schulungsvertrag','datenschutz','nda','servicevertrag','garantie',
  'rma','retourenschein','zahlungsvereinbarung','sonstiges',
];
const SIGNER_ROLES = ['kunde','techniker','verkaeufer','geschaeftsfuehrer','zeuge','partner','lieferant','sonstiges'];
const CATEGORIES = ['Vertrieb','Service','Finance','HR','Rechtliches','Wartung','Sonstiges'];

type TemplateSigner = { signer_role: string; name?: string; email?: string; is_required: boolean };

export default function DigitaleSignaturenTemplateEditor() {
  const { id } = useParams();
  const isNew = id === 'neu';
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const [name, setName] = useState('');
  const [docType, setDocType] = useState('angebot');
  const [category, setCategory] = useState('Sonstiges');
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState(14);
  const [isActive, setIsActive] = useState(true);
  const [signers, setSigners] = useState<TemplateSigner[]>([
    { signer_role: 'kunde', is_required: true },
  ]);
  const [samplePdf, setSamplePdf] = useState<File | null>(null);
  const [samplePath, setSamplePath] = useState<string | null>(null);
  const [fields, setFields] = useState<SigField[]>([]);
  const [tplId, setTplId] = useState<string | null>(isNew ? null : id ?? null);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from('sig_templates').select('*').eq('id', id).maybeSingle();
      if (t) {
        setName(t.name); setDocType(t.document_type);
        setCategory(t.category || 'Sonstiges');
        setMessage(t.default_message || '');
        setExpiryDays(t.default_expiry_days || 14);
        setIsActive(!!t.is_active);
        setSigners(Array.isArray(t.default_signers) && t.default_signers.length
          ? t.default_signers as TemplateSigner[]
          : [{ signer_role: 'kunde', is_required: true }]);
        setSamplePath(t.sample_pdf_path || null);
      }
      const { data: fs } = await supabase.from('sig_template_fields').select('*').eq('template_id', id);
      if (fs) {
        setFields(fs.map((r: any) => ({
          id: r.id, page: (r.page_index || 0) + 1,
          x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height),
          field_type: r.field_type, signer_index: r.signer_index || 0,
          field_key: r.label || `${r.field_type}_${r.id.slice(0, 4)}`,
        })));
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const editorSigners: EditorSigner[] = useMemo(
    () => signers.map((s, i) => ({ name: s.name || s.signer_role, order_index: i })),
    [signers],
  );

  const save = async () => {
    if (!name) return toast.error('Name erforderlich');
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;

      // Sample-PDF hochladen (optional)
      let sample_pdf_path = samplePath;
      if (samplePdf) {
        const path = `${uid}/tpl_${Date.now()}_${samplePdf.name}`;
        const { error: upErr } = await supabase.storage.from('sig-documents').upload(path, samplePdf, { upsert: true });
        if (upErr) throw upErr;
        sample_pdf_path = path;
      }

      const payload: any = {
        name, document_type: docType, category,
        default_message: message, default_expiry_days: expiryDays,
        default_signers: signers, is_active: isActive,
        sample_pdf_path,
        fields: [], // legacy jsonb column
      };

      let templateId = tplId;
      if (!templateId) {
        const { data, error } = await supabase.from('sig_templates').insert({ ...payload, created_by: uid }).select('id').single();
        if (error) throw error;
        templateId = data.id;
        setTplId(templateId);
      } else {
        const { error } = await supabase.from('sig_templates').update(payload).eq('id', templateId);
        if (error) throw error;
      }

      // Felder ersetzen
      await supabase.from('sig_template_fields').delete().eq('template_id', templateId);
      if (fields.length) {
        const rows = fields.map((f) => ({
          template_id: templateId,
          page_index: Math.max(0, (f.page || 1) - 1),
          x: f.x, y: f.y, width: f.width, height: f.height,
          field_type: f.field_type, signer_index: f.signer_index,
          required: true, label: f.field_key,
        }));
        const { error: fErr } = await supabase.from('sig_template_fields').insert(rows);
        if (fErr) throw fErr;
      }

      toast.success('Vorlage gespeichert');
      if (isNew) navigate(`/admin/signaturen/templates/${templateId}`, { replace: true });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Lade…</div>;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/admin/signaturen')}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        <Button onClick={save} disabled={busy}><Save className="w-4 h-4 mr-2" />{busy ? 'Speichere…' : 'Speichern'}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{isNew ? 'Neue Vorlage' : `Vorlage: ${name}`}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <Label>Dokumenttyp</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Standard-Gültigkeit (Tage)</Label>
              <Input type="number" min={1} max={90} value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">Aktiv</span>
            </div>
          </div>

          <div>
            <Label>Standard-Nachricht an Empfänger</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Standard-Signer-Rollen</Label>
              <Button size="sm" variant="outline" onClick={() => setSigners([...signers, { signer_role: 'kunde', is_required: true }])}>
                <Plus className="w-3 h-3 mr-1" />Signer
              </Button>
            </div>
            {signers.map((s, i) => (
              <div key={i} className="grid md:grid-cols-4 gap-2 p-2 rounded border bg-muted/20">
                <div>
                  <Label className="text-xs">Rolle</Label>
                  <Select value={s.signer_role} onValueChange={(v) => setSigners(signers.map((x, j) => j === i ? { ...x, signer_role: v } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SIGNER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Standard-Name (optional)</Label><Input value={s.name || ''} onChange={(e) => setSigners(signers.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                <div><Label className="text-xs">Standard-E-Mail (optional)</Label><Input value={s.email || ''} onChange={(e) => setSigners(signers.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} /></div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Switch checked={s.is_required} onCheckedChange={(v) => setSigners(signers.map((x, j) => j === i ? { ...x, is_required: v } : x))} />
                    <span className="text-xs">Pflicht</span>
                  </div>
                  {signers.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setSigners(signers.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label>Referenz-PDF (zum Platzieren der Felder)</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setSamplePdf(e.target.files?.[0] || null)} />
            {samplePath && !samplePdf && <p className="text-xs text-muted-foreground mt-1">Bestehende Datei: {samplePath.split('/').pop()}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Felder platzieren</CardTitle></CardHeader>
        <CardContent>
          <FieldEditor file={samplePdf} signers={editorSigners} fields={fields} onChange={setFields} />
          {!samplePdf && <p className="text-xs text-muted-foreground mt-2">Zum Platzieren eine Referenz-PDF hochladen. Bestehende Felder werden auch ohne PDF gespeichert.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
