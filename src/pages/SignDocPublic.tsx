import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, Eraser, Check, PenLine } from 'lucide-react';
import { toast } from 'sonner';

type FieldBlueprint = {
  page: number; x: number; y: number; width: number; height: number;
  signer_index: number; field_type: string; field_key: string;
};

export default function SignDocPublic() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const partnerSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('p') : null;
  const [signerId, setSignerId] = useState<string>('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeFieldIdx, setActiveFieldIdx] = useState(0);
  const [collected, setCollected] = useState<Record<string, { png: string; vec: any }>>({});
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const sigRef = useRef<SignatureCanvas | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const call = async (fn: string, body: any) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j;
  };

  useEffect(() => {
    (async () => {
      try {
        const qs = new URLSearchParams({ token: token || '' });
        if (partnerSlug) qs.set('p', partnerSlug);
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sig-public-load?${qs.toString()}`, {
          headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Fehler');
        setData(j);
        const first = j.signers?.find((s: any) => !s.signed_at && !s.declined_at);
        if (first) setSignerId(first.id);
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const currentSigner = useMemo(
    () => data?.signers?.find((s: any) => s.id === signerId),
    [data, signerId],
  );

  const myFields: FieldBlueprint[] = useMemo(() => {
    const all: FieldBlueprint[] = data?.document?.fields || [];
    if (!currentSigner) return [];
    return all.filter((f) => f.signer_index === currentSigner.order_index);
  }, [data, currentSigner]);

  const activeField = myFields[activeFieldIdx];

  const sendOtp = async () => {
    setBusy(true);
    try { await call('sig-otp-send', { token, signer_id: signerId }); setOtpSent(true); toast.success('OTP-Code per E-Mail versendet'); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const verifyOtp = async () => {
    setBusy(true);
    try { await call('sig-otp-verify', { token, signer_id: signerId, code }); setOtpVerified(true); toast.success('OTP verifiziert'); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const captureField = () => {
    if (!activeField) return;
    const needsSig = activeField.field_type === 'signature' || activeField.field_type === 'initials';
    if (needsSig) {
      if (!sigRef.current || sigRef.current.isEmpty()) return toast.error('Bitte im Feld unterschreiben');
      const png = sigRef.current.getCanvas().toDataURL('image/png');
      const vec = sigRef.current.toData();
      setCollected({ ...collected, [activeField.field_key]: { png, vec } });
      sigRef.current.clear();
    }
    if (activeFieldIdx < myFields.length - 1) setActiveFieldIdx(activeFieldIdx + 1);
    else submitAll();
  };

  const submitAll = async () => {
    setBusy(true);
    try {
      const signatures: any[] = [];
      if (myFields.length > 0) {
        for (const f of myFields) {
          const c = collected[f.field_key];
          const isSigLike = f.field_type === 'signature' || f.field_type === 'initials';
          signatures.push({
            field_key: f.field_key, field_type: f.field_type, page: f.page,
            x: f.x, y: f.y, width: f.width, height: f.height,
            png_data: isSigLike ? c?.png : null,
            vector_data: isSigLike ? c?.vec : (textValues[f.field_key] ? { text: textValues[f.field_key] } : null),
          });
        }
      } else {
        // Legacy: no blueprint → single free signature
        if (!sigRef.current || sigRef.current.isEmpty()) return toast.error('Bitte unterschreiben');
        const png = sigRef.current.getCanvas().toDataURL('image/png');
        const vec = sigRef.current.toData();
        signatures.push({ field_key: 'main', field_type: 'signature', vector_data: vec, png_data: png, page: 1, x: 40, y: 40, width: 260, height: 90 });
      }
      await call('sig-submit', { token, signer_id: signerId, signatures });
      toast.success('Signatur übermittelt – vielen Dank!');
      setData({ ...data, request: { ...data.request, status: 'signiert' } });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const decline = async () => {
    const reason = prompt('Grund der Ablehnung?');
    if (!reason) return;
    setBusy(true);
    try {
      await call('sig-submit', { token, signer_id: signerId, decline_reason: reason });
      toast.success('Ablehnung übermittelt');
      setData({ ...data, request: { ...data.request, status: 'abgelehnt' } });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
      <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lädt …</div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
      Signaturanfrage nicht gefunden oder abgelaufen.
    </div>
  );

  const done = ['signiert','abgelehnt','abgelaufen'].includes(data.request.status);
  const needsOtp = data.request.otp_required && !otpVerified;

  const brand = data.branding;
  const brandStyle = brand?.primary_color ? { ['--primary' as any]: brand.primary_color } : undefined;

  return (
    <div className="min-h-screen bg-background py-6 px-4" style={brandStyle}>
      <div className="max-w-4xl mx-auto space-y-4">
        {brand && (
          <div className="flex items-center justify-between border-b pb-3 mb-2">
            <div className="flex items-center gap-3">
              {brand.logo_url && <img src={brand.logo_url} alt={brand.name} className="h-10 w-auto" />}
              <span className="text-sm font-medium">{brand.name}</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Powered by ALIX SIGN</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" style={brand?.primary_color ? { color: brand.primary_color } : undefined} />
          <div>
            <h1 className="text-xl font-semibold">{data.document.title}</h1>
            <p className="text-xs text-muted-foreground">Dokumenttyp: {data.document.document_type} · Status: {data.request.status}</p>
          </div>
        </div>


        <Card>
          <CardHeader><CardTitle className="text-base">Dokument</CardTitle></CardHeader>
          <CardContent>
            <iframe src={data.pdf_url} className="w-full h-[600px] rounded border" title="PDF" />
            <a href={data.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-2 inline-block">PDF in neuem Tab öffnen</a>
          </CardContent>
        </Card>

        {!done && (
          <>
            {needsOtp && (
              <Card>
                <CardHeader><CardTitle className="text-base">E-Mail-Verifizierung (FES)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {!otpSent ? (
                    <Button onClick={sendOtp} disabled={busy}>Code per E-Mail senden</Button>
                  ) : (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-stelliger Code" maxLength={6} /></div>
                      <Button onClick={verifyOtp} disabled={busy}>Prüfen</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!needsOtp && myFields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Feld {activeFieldIdx + 1} von {myFields.length}: {activeField?.field_type}</span>
                    <div className="flex gap-1">
                      {myFields.map((f, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full ${collected[f.field_key] || textValues[f.field_key] ? 'bg-emerald-500' : i === activeFieldIdx ? 'bg-primary' : 'bg-muted'}`} />
                      ))}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(activeField?.field_type === 'signature' || activeField?.field_type === 'initials') && (
                    <div className="rounded-md border bg-white">
                      <SignatureCanvas ref={(el) => { sigRef.current = el; }} penColor="#111" canvasProps={{ className: 'w-full h-48 rounded-md' }} />
                    </div>
                  )}
                  {activeField?.field_type === 'text' && (
                    <Input value={textValues[activeField.field_key] || ''} onChange={(e) => setTextValues({ ...textValues, [activeField.field_key]: e.target.value })} placeholder="Text eingeben" />
                  )}
                  {activeField?.field_type === 'date' && (
                    <p className="text-sm text-muted-foreground">Wird automatisch mit dem Signaturdatum gefüllt.</p>
                  )}
                  {activeField?.field_type === 'checkbox' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" onChange={(e) => setTextValues({ ...textValues, [activeField.field_key]: e.target.checked ? 'X' : '' })} />
                      Zustimmung markieren
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => sigRef.current?.clear()}><Eraser className="w-4 h-4 mr-1" />Löschen</Button>
                    <Button onClick={captureField} disabled={busy}>
                      <Check className="w-4 h-4 mr-1" />
                      {activeFieldIdx < myFields.length - 1 ? 'Weiter zum nächsten Feld' : 'Verbindlich unterzeichnen'}
                    </Button>
                    <Button variant="ghost" onClick={decline} disabled={busy}>Ablehnen</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!needsOtp && myFields.length === 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Unterschrift</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border bg-white">
                    <SignatureCanvas ref={(el) => { sigRef.current = el; }} penColor="#111" canvasProps={{ className: 'w-full h-48 rounded-md' }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => sigRef.current?.clear()}><Eraser className="w-4 h-4 mr-1" />Löschen</Button>
                    <Button onClick={submitAll} disabled={busy}><PenLine className="w-4 h-4 mr-1" />Verbindlich unterzeichnen</Button>
                    <Button variant="ghost" onClick={decline} disabled={busy}>Ablehnen</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {done && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Diese Signaturanfrage ist abgeschlossen.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
