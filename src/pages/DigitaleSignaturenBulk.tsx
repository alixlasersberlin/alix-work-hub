import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, Users, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BulkJobsProgress } from '@/components/signaturen/BulkJobsProgress';

const DOC_TYPES = ['angebot','auftrag','rechnung','servicevertrag','nda','sonstiges'];

type Recipient = { name: string; email: string; phone?: string; status?: 'pending' | 'ok' | 'error'; message?: string; sign_url?: string };

function parseRecipients(text: string): Recipient[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    // Accept "Name;Email;Phone" or "Name,Email,Phone" or just "Email"
    const parts = line.split(/[;,\t]/).map((p) => p.trim());
    if (parts.length === 1) return { name: '', email: parts[0] };
    return { name: parts[0] || '', email: parts[1] || '', phone: parts[2] || '' };
  }).filter((r) => /@/.test(r.email));
}

export default function DigitaleSignaturenBulk() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('nda');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [otp, setOtp] = useState(false);
  const [expiresDays, setExpiresDays] = useState(21);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const parse = () => {
    const list = parseRecipients(rawText);
    if (!list.length) return toast.error('Keine gültigen E-Mail-Adressen erkannt');
    setRecipients(list);
    toast.success(`${list.length} Empfänger erkannt`);
  };

  const send = async () => {
    if (!title || !file || recipients.length === 0) return toast.error('Titel, PDF und Empfänger erforderlich');
    setRunning(true); setDone(false);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1] || '');
        r.onerror = rej; r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('sig-bulk-create', {
        body: {
          title, document_type: docType, pdf_base64: b64,
          recipients: recipients.map((r) => ({ name: r.name, email: r.email, phone: r.phone })),
          otp_required: otp, expires_days: expiresDays,
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      toast.success(`Bulk-Job gestartet (${recipients.length} Empfänger) – Fortschritt oben.`);
      setRecipients(recipients.map((r) => ({ ...r, status: 'pending' })));
      setDone(true);
      console.log('bulk job', data);
    } catch (e: any) {
      toast.error('Bulk-Job fehlgeschlagen: ' + (e.message ?? e));
    } finally {
      setRunning(false);
    }
  };

  const okCount = recipients.filter((r) => r.status === 'ok').length;
  const errCount = recipients.filter((r) => r.status === 'error').length;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/signaturen')}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Serien-Versand</h1>
        </div>
      </div>

      <BulkJobsProgress />

      <Card>
        <CardHeader><CardTitle className="text-base">Dokument</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Titel-Präfix</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. NDA 2026" /></div>
            <div>
              <Label>Dokumenttyp</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>PDF-Datei (identisch für alle Empfänger)</Label>
            <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg border">
              <Switch checked={otp} onCheckedChange={setOtp} />
              <span className="text-sm">E-Mail-OTP vor Signatur</span>
            </div>
            <div><Label>Gültig für (Tage)</Label>
              <Input type="number" min={1} max={60} value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Empfänger</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ein Empfänger pro Zeile. Format: <code className="px-1 py-0.5 bg-muted rounded">Name;E-Mail;Telefon</code> oder <code className="px-1 py-0.5 bg-muted rounded">E-Mail</code>.
            Trennzeichen: Semikolon, Komma oder Tab.
          </p>
          <Textarea rows={8} value={rawText} onChange={(e) => setRawText(e.target.value)}
            placeholder={"Max Muster;max@firma.de;+49 30 123\nErika Beispiel;erika@firma.de"} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={parse}>Empfänger einlesen</Button>
            {recipients.length > 0 && <Badge variant="secondary">{recipients.length} Empfänger</Badge>}
            {done && (
              <>
                <Badge className="bg-emerald-500/20 text-emerald-600">{okCount} ok</Badge>
                {errCount > 0 && <Badge className="bg-red-500/20 text-red-600">{errCount} Fehler</Badge>}
              </>
            )}
          </div>

          {recipients.length > 0 && (
            <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2">E-Mail</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{r.name || '—'}</td>
                      <td className="px-3 py-1.5">{r.email}</td>
                      <td className="px-3 py-1.5">
                        {r.status === 'pending' && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        {r.status === 'ok' && <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />versendet</span>}
                        {r.status === 'error' && <span className="inline-flex items-center gap-1 text-red-600 text-xs" title={r.message}><XCircle className="w-3.5 h-3.5" />Fehler</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={send} disabled={running || !file || !title || recipients.length === 0}>
              <Send className="w-4 h-4 mr-2" />
              {running ? `Sende… (${recipients.filter((r) => r.status).length}/${recipients.length})` : `An ${recipients.length} Empfänger senden`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
