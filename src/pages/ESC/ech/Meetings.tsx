import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Copy } from 'lucide-react';
import { generateMeetingUrl } from '@/lib/esc/ech/sender';
import { toast } from 'sonner';

export default function EchMeetings() {
  const [provider, setProvider] = useState<'teams' | 'zoom' | 'google_meet'>('teams');
  const [refId, setRefId] = useState(crypto.randomUUID());
  const [result, setResult] = useState<{ url: string; password?: string } | null>(null);

  const create = () => setResult(generateMeetingUrl(provider, refId));
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Kopiert'); };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Video className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Videokonferenzen</h1>
      </div>
      <div className="text-[11.5px] text-muted-foreground">Meeting-Links werden bei Online-Terminen automatisch erzeugt, im Termin gespeichert und in E-Mail sowie Kalender eingefügt. Provider werden in „Integrationen" freigeschaltet – bis dahin generiert der Hub Platzhalter-Links.</div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Meeting-Link erzeugen</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px]">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teams">Microsoft Teams</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="google_meet">Google Meet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px]">Referenz (Termin-ID)</Label>
            <Input value={refId} onChange={(e) => setRefId(e.target.value)} />
          </div>
          <div className="md:col-span-3 flex justify-end"><Button onClick={create}>Erzeugen</Button></div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ergebnis</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-[12.5px]">
            <div className="flex items-center gap-2"><span className="text-muted-foreground">URL:</span><code className="truncate">{result.url}</code><Button size="sm" variant="ghost" onClick={() => copy(result.url)}><Copy className="w-3.5 h-3.5" /></Button></div>
            {result.password && <div className="flex items-center gap-2"><span className="text-muted-foreground">Kennwort:</span><code>{result.password}</code><Button size="sm" variant="ghost" onClick={() => copy(result.password!)}><Copy className="w-3.5 h-3.5" /></Button></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
