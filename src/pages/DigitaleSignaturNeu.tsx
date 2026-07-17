import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Send, Plus, Trash2 } from 'lucide-react';
import FieldEditor, { EditorSigner, SigField } from '@/components/signaturen/FieldEditor';

const DOC_TYPES = [
  'angebot','auftrag','rechnung','lieferschein','servicebericht','arbeitsbericht',
  'wartungsprotokoll','reparaturbericht','abnahmeprotokoll','leasing','finanzierung',
  'mietvertrag','schulungsvertrag','datenschutz','nda','servicevertrag','garantie',
  'rma','retourenschein','zahlungsvereinbarung','sonstiges',
];
const SIGNER_ROLES = ['kunde','techniker','verkaeufer','geschaeftsfuehrer','zeuge','partner','lieferant','sonstiges'];

type SignerRow = { name: string; email: string; phone: string; signer_role: string; is_required: boolean };

const emptySigner = (): SignerRow => ({ name: '', email: '', phone: '', signer_role: 'kunde', is_required: true });

export default function DigitaleSignaturNeu() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('angebot');
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<SignerRow[]>([emptySigner()]);
  const [fields, setFields] = useState<SigField[]>([]);
  const [otp, setOtp] = useState(true);
  const [expiresDays, setExpiresDays] = useState(14);
  const [inPerson, setInPerson] = useState(false);
  const [entityCtx, setEntityCtx] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sig_handoff_v1');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.title) setTitle(p.title);
        if (p.document_type && DOC_TYPES.includes(p.document_type)) setDocType(p.document_type);
        setEntityCtx(p);
        sessionStorage.removeItem('sig_handoff_v1');
      }
    } catch { /* ignore */ }
  }, []);

  const editorSigners: EditorSigner[] = useMemo(
    () => signers.map((s, i) => ({ name: s.name, email: s.email, order_index: i })),
    [signers],
  );

  const canSubmit = title && file && signers.every((s) => s.email);

  const submit = async () => {
    if (!canSubmit) return toast.error('Titel, PDF und alle Empfänger-E-Mails sind erforderlich');
    setBusy(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1] || '');
        r.onerror = rej;
        r.readAsDataURL(file!);
      });
      const { data, error } = await supabase.functions.invoke('sig-create-request', {
        body: {
          title, document_type: docType,
          entity_type: entityCtx?.entity_type ?? null,
          entity_id: entityCtx?.entity_id ?? null,
          customer_id: entityCtx?.customer_id ?? null,
          pdf_base64: b64,
          signers: signers.map((s, i) => ({ ...s, order_index: i })),
          fields: fields.map(({ id, ...rest }) => rest),
          otp_required: otp,
          expires_days: expiresDays,
          base_url: window.location.origin,
        },
      });
      if (error) throw error;
      const url: string | undefined = (data as any)?.sign_url;
      if (inPerson && url) {
        toast.success('Signaturanfrage erstellt – Vor-Ort-Modus wird geöffnet');
        window.open(url, '_blank', 'noopener');
        navigate('/signaturen');
      } else {
        toast.success('Signaturanfrage versendet');
        console.log('sign_url', url);
        navigate('/signaturen');
      }
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/signaturen')}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`px-2 py-1 rounded-md border ${step === n ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'}`}>
              {n}. {n === 1 ? 'Dokument & Signer' : n === 2 ? 'Felder platzieren' : 'Prüfen & senden'}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Neue Signaturanfrage</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Servicebericht #4711" /></div>
              <div>
                <Label>Dokumenttyp</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>PDF-Datei</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0] || null); setFields([]); }} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Unterzeichner</Label>
                <Button size="sm" variant="outline" onClick={() => setSigners([...signers, emptySigner()])}>
                  <Plus className="w-3 h-3 mr-1" />Hinzufügen
                </Button>
              </div>
              {signers.map((s, i) => (
                <div key={i} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Signer #{i + 1}</span>
                    {signers.length > 1 && (
                      <Button size="sm" variant="ghost" onClick={() => setSigners(signers.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid md:grid-cols-4 gap-2">
                    <div><Label className="text-xs">Name</Label><Input value={s.name} onChange={(e) => setSigners(signers.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></div>
                    <div><Label className="text-xs">E-Mail</Label><Input type="email" value={s.email} onChange={(e) => setSigners(signers.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} /></div>
                    <div><Label className="text-xs">Telefon</Label><Input value={s.phone} onChange={(e) => setSigners(signers.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} /></div>
                    <div>
                      <Label className="text-xs">Rolle</Label>
                      <Select value={s.signer_role} onValueChange={(v) => setSigners(signers.map((x, j) => j === i ? { ...x, signer_role: v } : x))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SIGNER_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-lg border">
                <Switch checked={otp} onCheckedChange={setOtp} />
                <span className="text-sm">E-Mail-OTP-Code vor Signatur (FES)</span>
              </div>
              <div>
                <Label>Gültig für (Tage)</Label>
                <Input type="number" min={1} max={60} value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!file || !title}>Weiter: Felder platzieren</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Signaturfelder platzieren</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>Zurück</Button>
                <Button size="sm" onClick={() => setStep(3)}>Weiter: Prüfen</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldEditor file={file} signers={editorSigners} fields={fields} onChange={setFields} />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Zusammenfassung</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><strong>Titel:</strong> {title}</div>
            <div><strong>Dokumenttyp:</strong> {docType}</div>
            <div><strong>PDF:</strong> {file?.name}</div>
            <div><strong>Unterzeichner:</strong>
              <ul className="mt-1 ml-4 list-disc">
                {signers.map((s, i) => <li key={i}>{s.name || '—'} · {s.email} · {s.signer_role}</li>)}
              </ul>
            </div>
            <div><strong>Felder:</strong> {fields.length} platziert{fields.length === 0 && ' (kein Blueprint – Signer setzen Unterschrift frei)'}</div>
            <div><strong>OTP:</strong> {otp ? 'Ja (FES)' : 'Nein'} · <strong>Gültigkeit:</strong> {expiresDays} Tage</div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
              <Button onClick={submit} disabled={busy || !canSubmit}>
                <Send className="w-4 h-4 mr-2" />{busy ? 'Sende…' : 'Signaturanfrage senden'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
