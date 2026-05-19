import { useEffect, useState } from 'react';
import { Mail, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TemplateRow {
  id: string;
  template_key: string;
  display_name: string;
  subject: string;
  body: string;
  placeholders: string[];
  updated_at: string;
}

export default function EmailTemplates() {
  const { roles } = useAuth();
  const canEdit = roles.some(r => ['Admin', 'Super Admin'].includes(r));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('display_name');
    if (error) toast.error('Fehler beim Laden: ' + error.message);
    setTemplates((data as TemplateRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: 'subject' | 'body', value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const save = async (t: TemplateRow) => {
    setSaving(t.id);
    const { error } = await supabase
      .from('email_templates')
      .update({ subject: t.subject, body: t.body })
      .eq('id', t.id);
    setSaving(null);
    if (error) toast.error('Speichern fehlgeschlagen: ' + error.message);
    else toast.success('Vorlage gespeichert');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">E-Mail Vorlagen</h1>
          <p className="text-muted-foreground text-sm">Inhalte der automatisch versendeten E-Mails bearbeiten.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Keine Vorlagen vorhanden.</CardContent></Card>
      ) : (
        templates.map(t => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle>{t.display_name}</CardTitle>
              <CardDescription>
                Schlüssel: <code>{t.template_key}</code>
                {t.placeholders?.length > 0 && (
                  <> · Platzhalter: {t.placeholders.map(p => <code key={p} className="mx-1">{`{{${p}}}`}</code>)}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Betreff</Label>
                <Input value={t.subject} disabled={!canEdit} onChange={e => updateField(t.id, 'subject', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Inhalt</Label>
                <Textarea value={t.body} disabled={!canEdit} rows={12} onChange={e => updateField(t.id, 'body', e.target.value)} />
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <Button onClick={() => save(t)} disabled={saving === t.id}>
                    {saving === t.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Speichern
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
