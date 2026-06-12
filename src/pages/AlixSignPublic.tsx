import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, ShieldCheck, FileSignature, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { buildSignedPdfBase64 } from '@/lib/alix-sign-pdf';
import alixLogo from '@/assets/alix-lasers-logo.png.asset.json';

const fmt = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function AlixSignPublic() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [chkOffer, setChkOffer] = useState(false);
  const [chkTerms, setChkTerms] = useState(false);
  const [chkPrivacy, setChkPrivacy] = useState(false);
  const [chkSign, setChkSign] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('alix-sign-get', {
          method: 'GET' as any,
          // supabase-js v2 invoke uses POST; fall back to fetch
        } as any);
        // Use direct fetch instead — invoke doesn't support GET cleanly
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alix-sign-get?token=${encodeURIComponent(token || '')}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
        if (json.customer_email) setEmail(json.customer_email);
      } catch (e: any) {
        setError(e?.message || 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Canvas drawing
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#0b2545'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    };
    const down = (e: PointerEvent) => {
      drawing.current = true; hasInk.current = true;
      const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing.current) return;
      const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    };
    const up = () => { drawing.current = false; };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointerleave', up);
    return () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointerleave', up);
    };
  }, [data]);

  const clearCanvas = () => {
    const c = canvasRef.current; if (!c) return;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  };

  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="max-w-md text-center space-y-3">
        <div className="text-2xl font-semibold text-slate-800">Signatur-Link ungültig</div>
        <div className="text-slate-600">{error || 'Dieser Link ist abgelaufen oder existiert nicht.'}</div>
      </div>
    </div>
  );

  if (data.status === 'unterschrieben' || done) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
          <div className="text-2xl font-semibold text-slate-800">Vielen Dank!</div>
          <div className="text-slate-600">
            Das Angebot <strong>{data.offer_number}</strong> wurde erfolgreich elektronisch unterzeichnet.
            Sie erhalten in Kürze eine Bestätigung per E-Mail.
          </div>
        </div>
      </div>
    );
  }

  const snap = data.offer_payload || {};
  const payType = snap?.payment?.type || '';
  const requiresCredit = ['Ratenzahlung', 'Leasing', 'Mietkauf', 'Alix Flex'].includes(payType);

  const onSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) return toast.error('Bitte Vor- und Nachname eingeben');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error('Bitte gültige E-Mail-Adresse eingeben');
    if (!city.trim()) return toast.error('Bitte Ort eingeben');
    if (!chkOffer || !chkSign) return toast.error('Bitte allen Zustimmungen zustimmen');
    if (!hasInk.current) return toast.error('Bitte zuerst unterschreiben');

    setSubmitting(true);
    try {
      const signatureDataUrl = canvasRef.current!.toDataURL('image/png');
      const signerName = `${firstName.trim()} ${lastName.trim()}`;
      const signedAt = new Date();
      const pdfBase64 = buildSignedPdfBase64(snap, {
        signerName,
        signerEmail: email,
        signerLocation: city,
        signedAt,
        userAgent: navigator.userAgent,
        signatureDataUrl,
        acceptedOffer: chkOffer,
        acceptedTerms: chkTerms,
        acceptedPrivacy: chkPrivacy,
        acceptedElectronicSignature: chkSign,
        acceptedCreditCheck: requiresCredit ? true : null,
        requestId: data.id,
      });

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alix-sign-submit`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        body: JSON.stringify({
          token,
          signer_name: signerName,
          signer_email: email,
          signer_location: city,
          accepted_offer: chkOffer,
          accepted_terms: chkTerms,
          accepted_privacy: chkPrivacy,
          accepted_electronic_signature: chkSign,
          accepted_credit_check: requiresCredit ? true : undefined,
          signature_image_data: signatureDataUrl,
          pdf_base64: pdfBase64,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setDone(true);
    } catch (e: any) {
      toast.error(e?.message || 'Signatur fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="pb-4 border-b border-slate-200 space-y-4">
          <div className="flex justify-center">
            <img src={alixLogo.url} alt="Alix Lasers" className="h-10 w-auto opacity-90" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#14386e] text-white grid place-items-center"><FileSignature className="w-5 h-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Alix Sign</div>
              <div className="text-xl font-semibold text-slate-900">Angebot elektronisch unterzeichnen</div>
            </div>
          </div>
        </header>


        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Angebotsnummer</span>
            <span className="font-semibold text-slate-900">{data.offer_number}</span>
          </div>
          {snap.customer && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Kunde</span>
              <span className="text-slate-900">{snap.customer.company_name || snap.customer.contact_name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Zahlungsart</span>
            <span className="text-slate-900">{payType || '—'}</span>
          </div>
          <div className="flex justify-between text-base pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Gesamtbetrag</span>
            <span className="font-bold text-[#14386e]">{fmt(Number(snap.totals?.gross || 0))}</span>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="font-semibold text-slate-900 mb-3">Positionen</div>
          <div className="space-y-2 text-sm">
            {(snap.lines || []).map((l: any, i: number) => (
              <div key={i} className="flex justify-between gap-4 py-1 border-b border-slate-100 last:border-0">
                <div className="text-slate-800">{l.name} <span className="text-slate-400">× {l.quantity}</span></div>
                <div className="text-slate-900 font-medium whitespace-nowrap">{fmt(Number(l.rate || 0) * Number(l.quantity || 1))}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-xs text-slate-600">
          <div className="flex gap-2"><ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" /><span>Mit Ihrer Unterschrift nehmen Sie das Angebot verbindlich an. Es gelten unsere AGB und Datenschutzhinweise.</span></div>
          {requiresCredit && (
            <div className="flex gap-2"><ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><span>Da Sie eine Finanzierung / Mietkauf gewählt haben, ist eine Bonitäts- und Identitätsprüfung erforderlich.</span></div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="font-semibold text-slate-900">Ihre Daten</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Vorname *</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div><Label>Nachname *</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            <div><Label>E-Mail *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Ort *</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-start gap-3 cursor-pointer"><Checkbox checked={chkOffer} onCheckedChange={v => setChkOffer(v === true)} className="mt-0.5" /><span className="text-sm text-slate-700">Ich habe das Angebot gelesen und nehme es verbindlich an.</span></label>
            <label className="flex items-start gap-3 cursor-pointer"><Checkbox checked={chkSign} onCheckedChange={v => setChkSign(v === true)} className="mt-0.5" /><span className="text-sm text-slate-700">Ich bin mit der elektronischen Signatur über Alix Sign einverstanden.</span></label>
            {requiresCredit && (
              <div className="flex items-start gap-3"><Checkbox checked disabled className="mt-0.5" /><span className="text-sm text-slate-700">Ich bin mit einer Bonitäts- und Identitätsprüfung einverstanden.</span></div>
            )}

          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label>Unterschrift *</Label>
              <Button type="button" variant="ghost" size="sm" onClick={clearCanvas} className="text-slate-500"><Eraser className="w-4 h-4 mr-1" />Leeren</Button>
            </div>
            <canvas
              ref={canvasRef}
              width={800}
              height={240}
              className="w-full h-44 bg-slate-50 border border-slate-300 rounded-md touch-none"
              style={{ touchAction: 'none' }}
            />
            <div className="text-xs text-slate-500">Datum: {new Date().toLocaleString('de-DE')}</div>
          </div>

          <Button onClick={onSubmit} disabled={submitting} className="w-full bg-[#14386e] hover:bg-[#0e2a55] text-white">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileSignature className="w-4 h-4 mr-2" />}
            Verbindlich unterschreiben
          </Button>
        </section>

        <footer className="text-center text-xs text-slate-400 py-4">
          Powered by <strong>Alix Sign</strong> · Alix Lasers GmbH
        </footer>
      </div>
    </div>
  );
}
