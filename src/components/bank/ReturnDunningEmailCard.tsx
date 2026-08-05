import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { RETURN_DUNNING_PLACEHOLDERS } from '@/lib/bank/returnDunningLetter';
import {
  loadReturnDunningEmail, saveReturnDunningEmail,
  DEFAULT_RETURN_DUNNING_EMAIL, type ReturnDunningEmail,
} from '@/lib/bank/returnDunningEmail';

/** Editor für die Texte der Rücklastschrift-Mahn-E-Mail. */
export default function ReturnDunningEmailCard() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('Super Admin') || hasRole('Admin');
  const [cfg, setCfg] = useState<ReturnDunningEmail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadReturnDunningEmail().then(setCfg).catch(() => {}); }, []);
  if (!cfg) return null;

  const set = (patch: Partial<ReturnDunningEmail>) => setCfg({ ...cfg, ...patch });

  const save = async () => {
    setBusy(true);
    try { await saveReturnDunningEmail(cfg); toast.success('E-Mail-Mahntext gespeichert'); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />E-Mail-Mahntext (Rücklastschrift &amp; Sperrankündigung)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Diese Texte werden beim manuellen Versand und bei der automatischen Mahn-Eskalation verwendet.
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

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Betreff</label>
          <Input value={cfg.subject} disabled={!canEdit} onChange={e => set({ subject: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Überschrift</label>
          <Input value={cfg.headline} disabled={!canEdit} onChange={e => set({ headline: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Einleitung</label>
          <Textarea rows={4} value={cfg.intro} disabled={!canEdit} onChange={e => set({ intro: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Titel Sperrankündigung</label>
          <Input value={cfg.warnTitle} disabled={!canEdit} onChange={e => set({ warnTitle: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sperrankündigung – Absatz 1</label>
          <Textarea rows={4} value={cfg.warnBody} disabled={!canEdit} onChange={e => set({ warnBody: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sperrankündigung – Absatz 2</label>
          <Textarea rows={3} value={cfg.warnBody2} disabled={!canEdit} onChange={e => set({ warnBody2: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Schlusstext</label>
          <Textarea rows={3} value={cfg.closing} disabled={!canEdit} onChange={e => set({ closing: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Absender</label>
          <Input value={cfg.senderName} disabled={!canEdit} onChange={e => set({ senderName: e.target.value })} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={!canEdit || busy}>Text speichern</Button>
          <Button size="sm" variant="ghost" disabled={!canEdit}
            onClick={() => setCfg({ ...DEFAULT_RETURN_DUNNING_EMAIL })}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Standardtext
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
