import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Send } from 'lucide-react';


const DOC_TYPES = [
  'angebot','auftrag','rechnung','lieferschein','servicebericht','arbeitsbericht',
  'wartungsprotokoll','reparaturbericht','abnahmeprotokoll','leasing','finanzierung',
  'mietvertrag','schulungsvertrag','datenschutz','nda','servicevertrag','garantie',
  'rma','retourenschein','zahlungsvereinbarung','sonstiges',
];
const SIGNER_ROLES = ['kunde','techniker','verkaeufer','geschaeftsfuehrer','zeuge','partner','lieferant','sonstiges'];

export default function DigitaleSignaturNeu() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('angebot');
  const [file, setFile] = useState<File | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerRole, setSignerRole] = useState('kunde');
  const [otp, setOtp] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title || !file || !signerEmail) return toast.error('Titel, PDF und Empfänger-E-Mail erforderlich');
    setBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1] || '');
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('sig-create-request', {
        body: {
          title, document_type: docType, pdf_base64: b64,
          signers: [{ signer_role: signerRole, name: signerName, email: signerEmail }],
          otp_required: otp,
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      toast.success('Signaturanfrage erstellt und versendet');
      navigate('/signaturen');
      console.log('sign_url', data?.sign_url);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    
      <div className="max-w-2xl mx-auto space-y-4 p-4 md:p-6">
        <Button variant="ghost" onClick={() => navigate('/signaturen')}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        <Card>
          <CardHeader><CardTitle>Neue Signaturanfrage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Servicebericht #4711" /></div>
            <div>
              <Label>Dokumenttyp</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>PDF-Datei</Label><Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>

            <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
              <div className="text-sm font-medium">Unterzeichner</div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Name</Label><Input value={signerName} onChange={(e) => setSignerName(e.target.value)} /></div>
                <div>
                  <Label>Rolle</Label>
                  <Select value={signerRole} onValueChange={setSignerRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SIGNER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>E-Mail</Label><Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} /></div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={otp} onCheckedChange={setOtp} />
              <span className="text-sm">Zusätzlicher E-Mail-OTP-Code vor Signatur (FES)</span>
            </div>

            <Button onClick={submit} disabled={busy} className="w-full">
              <Send className="w-4 h-4 mr-2" /> {busy ? 'Sende…' : 'Signaturanfrage absenden'}
            </Button>
          </CardContent>
        </Card>
      </div>
    
  );
}
