import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Eye, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  loadReturnDunningLetter, saveReturnDunningLetter, previewReturnDunningPdf,
  DEFAULT_RETURN_DUNNING_LETTER, RETURN_DUNNING_PLACEHOLDERS, type ReturnDunningLetter,
} from '@/lib/bank/returnDunningLetter';

export default function ReturnDunningTemplateCard() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Super Admin') || hasRole('Admin');
  const [letter, setLetter] = useState<ReturnDunningLetter | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadReturnDunningLetter().then(setLetter).catch(() => {}); }, []);
  if (!letter) return null;

  const set = (patch: Partial<ReturnDunningLetter>) => setLetter({ ...letter, ...patch });

  const save = async () => {
    setBusy(true);
    try { await saveReturnDunningLetter(letter); toast.success('Mahnschreiben-Vorlage gespeichert'); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-500" />Mahnschreiben-Vorlage (Rücklastschrift)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Diese Vorlage wird beim PDF-Export einer Rücklastschrift automatisch mit den Platzhaltern befüllt.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {RETURN_DUNNING_PLACEHOLDERS.map(p => (
            <Badge key={p.key} variant="outline" className="font-mono text-[11px] cursor-pointer"
              title={`${p.label} – klicken zum Kopieren`}
              onClick={() => { navigator.clipboard?.writeText(p.key); toast.success(`${p.key} kopiert`); }}>
              {p.key}
            </Badge>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Absender</label>
            <Input value={letter.senderName} disabled={!canEdit} onChange={e => set({ senderName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Betreff</label>
            <Input value={letter.subject} disabled={!canEdit} onChange={e => set({ subject: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Absenderzeilen</label>
          <Textarea rows={2} value={letter.senderAddress} disabled={!canEdit}
            onChange={e => set({ senderAddress: e.target.value })} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Schreiben</label>
          <Textarea rows={16} className="font-mono text-xs" value={letter.body} disabled={!canEdit}
            onChange={e => set({ body: e.target.value })} />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Fußzeile</label>
          <Input value={letter.footer} disabled={!canEdit} onChange={e => set({ footer: e.target.value })} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={!canEdit || busy}>Vorlage speichern</Button>
          <Button size="sm" variant="outline" onClick={() => previewReturnDunningPdf(letter)}>
            <Eye className="w-3.5 h-3.5 mr-1" />PDF-Vorschau
          </Button>
          <Button size="sm" variant="ghost" disabled={!canEdit}
            onClick={() => setLetter({ ...DEFAULT_RETURN_DUNNING_LETTER })}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Standardtext
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
