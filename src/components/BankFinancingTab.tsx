import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Landmark, Loader2, Upload, FileText, CheckCircle2, XCircle, ExternalLink, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  orderId: string;
}

type Status = 'pending' | 'in_review' | 'approved' | 'rejected';
const TERM_OPTIONS = [12, 24, 36, 48, 60, 72];

export default function BankFinancingTab({ orderId }: Props) {
  const { user, isAdmin, hasRole } = useAuth();
  const canWrite = isAdmin || hasRole('Finance');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [record, setRecord] = useState<any>(null);

  const [requestDate, setRequestDate] = useState('');
  const [hasOffer, setHasOffer] = useState(false);
  const [decisionText, setDecisionText] = useState('');
  const [decisionConfirm, setDecisionConfirm] = useState(false);
  const [decisionChoice, setDecisionChoice] = useState<Status>('pending');
  const [decisionNote, setDecisionNote] = useState('');
  const [offerUrl, setOfferUrl] = useState<string | null>(null);
  const [inProcessing, setInProcessing] = useState(false);
  const [inProcessingDate, setInProcessingDate] = useState('');
  const [inProcessingNote, setInProcessingNote] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [downPayment, setDownPayment] = useState<string>('');
  const [termMonths, setTermMonths] = useState<string>('');
  const [residualValue, setResidualValue] = useState<string>('');

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('bank_financing_requests')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    setRecord(data);
    setRequestDate(data?.request_date || '');
    setHasOffer(!!data?.has_offer);
    setDecisionText(data?.decision_text || '');
    setDecisionChoice((data?.status as Status) || 'pending');
    setDecisionNote(data?.decision_note || '');
    setDecisionConfirm(data?.status === 'approved' || data?.status === 'rejected' || data?.status === 'in_review');
    setInProcessing(!!data?.in_processing);
    setInProcessingDate(data?.in_processing_date || '');
    setInProcessingNote(data?.in_processing_note || '');
    setPurchasePrice(data?.purchase_price != null ? String(data.purchase_price) : '');
    setDownPayment(data?.down_payment != null ? String(data.down_payment) : '');
    setTermMonths(data?.term_months != null ? String(data.term_months) : '');
    setResidualValue(data?.residual_value != null ? String(data.residual_value) : '');
    if (data?.offer_file_path) {
      const { data: signed } = await supabase.storage.from('bank-offers').createSignedUrl(data.offer_file_path, 3600);
      setOfferUrl(signed?.signedUrl || null);
    } else {
      setOfferUrl(null);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [orderId]);

  async function handleUpload(file: File) {
    if (!canWrite) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${orderId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('bank-offers').upload(path, file, { upsert: true });
    if (error) { toast.error('Upload fehlgeschlagen: ' + error.message); setUploading(false); return; }
    await persist({ offer_file_path: path, has_offer: true });
    setUploading(false);
    toast.success('Angebot hochgeladen');
    load();
  }

  async function persist(patch: Record<string, any>) {
    const payload = {
      order_id: orderId,
      request_date: requestDate || null,
      has_offer: hasOffer,
      decision_text: decisionText || null,
      status: decisionChoice,
      decision_note: decisionNote || null,
      decided_at: decisionChoice !== 'pending' && decisionConfirm ? new Date().toISOString() : null,
      decided_by: decisionChoice !== 'pending' && decisionConfirm ? user?.id : null,
      in_processing: inProcessing,
      in_processing_date: inProcessingDate || null,
      in_processing_note: inProcessingNote || null,
      purchase_price: purchasePrice === '' ? null : Number(purchasePrice),
      down_payment: downPayment === '' ? null : Number(downPayment),
      term_months: termMonths === '' ? null : Number(termMonths),
      residual_value: residualValue === '' ? null : Number(residualValue),
      updated_by: user?.id,
      ...patch,
    };
    if (record) {
      const { error } = await supabase.from('bank_financing_requests').update(payload).eq('id', record.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('bank_financing_requests').insert({ ...payload, created_by: user?.id });
      if (error) throw error;
    }
  }

  async function handleSave() {
    if (!canWrite) return;
    setSaving(true);
    try {
      const finalStatus: Status = decisionConfirm ? decisionChoice : 'pending';
      await persist({ status: finalStatus });
      toast.success(
        finalStatus === 'approved' ? 'Zusage gespeichert – Auftrag in ZUSAGEN BANK' :
        finalStatus === 'rejected' ? 'Absage gespeichert – Auftrag in ABSAGEN BANK' :
        finalStatus === 'in_review' ? 'In Prüfung – Auftrag in ANFRAGEN OFFEN' :
        'Anfrage gespeichert'
      );
      load();
    } catch (e: any) {
      toast.error('Fehler: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow max-w-2xl space-y-6">
      <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
        <Landmark className="w-4 h-4 text-primary" /> Anfrage Bank
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Datum</Label>
          <Input
            type="date"
            value={requestDate}
            onChange={e => setRequestDate(e.target.value)}
            disabled={!canWrite}
            className="bg-secondary border-border mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Angebot vorhanden</Label>
          <div className="mt-2 flex gap-4 items-center h-10">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={hasOffer} onChange={() => setHasOffer(true)} disabled={!canWrite} />
              <span className="text-sm">Ja</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={!hasOffer} onChange={() => setHasOffer(false)} disabled={!canWrite} />
              <span className="text-sm">Nein</span>
            </label>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Upload Angebot (PDF)</Label>
        <div className="mt-1 flex items-center gap-3">
          <Input
            type="file"
            accept="application/pdf,image/*"
            disabled={!canWrite || uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
            className="bg-secondary border-border"
          />
          {uploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
        {record?.offer_file_path && offerUrl && (
          <a href={offerUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            <FileText className="w-3.5 h-3.5" /> Aktuelles Angebot öffnen <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 bg-background/40 space-y-3">
        <p className="text-sm font-semibold tracking-wide">FINANZIERUNGSDATEN</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Kaufpreis (€)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
              disabled={!canWrite}
              className="bg-secondary border-border mt-1"
              placeholder="0,00"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Anzahlung (€)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={downPayment}
              onChange={e => setDownPayment(e.target.value)}
              disabled={!canWrite}
              className="bg-secondary border-border mt-1"
              placeholder="0,00"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Gewünschte Laufzeit</Label>
            <Select
              value={termMonths}
              onValueChange={(v) => setTermMonths(v)}
              disabled={!canWrite}
            >
              <SelectTrigger className="bg-secondary border-border mt-1">
                <SelectValue placeholder="Laufzeit wählen…" />
              </SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map(m => (
                  <SelectItem key={m} value={String(m)}>{m} Monate</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Restwert (€)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={residualValue}
              onChange={e => setResidualValue(e.target.value)}
              disabled={!canWrite}
              className="bg-secondary border-border mt-1"
              placeholder="0,00"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 bg-background/40 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide">ANFRAGE IN BEARBEITUNG</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={inProcessing}
              onCheckedChange={(v) => setInProcessing(!!v)}
              disabled={!canWrite}
            />
            <span className="text-sm">In Bearbeitung</span>
          </label>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Datum</Label>
          <Input
            type="date"
            value={inProcessingDate}
            onChange={e => setInProcessingDate(e.target.value)}
            disabled={!canWrite || !inProcessing}
            className="bg-secondary border-border mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Bemerkung</Label>
          <Textarea
            value={inProcessingNote}
            onChange={e => setInProcessingNote(e.target.value)}
            disabled={!canWrite || !inProcessing}
            placeholder="Bemerkung zur laufenden Bearbeitung…"
            className="bg-secondary border-border mt-1 min-h-[60px]"
          />
        </div>
      </div>


      <div>
        <Label className="text-xs text-muted-foreground">Entscheidung (Freitext)</Label>
        <Textarea
          value={decisionText}
          onChange={e => setDecisionText(e.target.value)}
          disabled={!canWrite}
          placeholder="Anmerkungen zur Entscheidung…"
          className="bg-secondary border-border mt-1 min-h-[80px]"
        />
      </div>

      <div className="rounded-lg border border-border p-4 bg-background/40 space-y-3">
        <p className="text-sm font-semibold tracking-wide">ENTSCHEIDUNG DER BANK BESTÄTIGEN</p>

        <RadioGroup
          value={decisionConfirm ? (decisionChoice === 'approved' ? 'ja' : decisionChoice === 'rejected' ? 'nein' : decisionChoice === 'in_review' ? 'pruefung' : '') : ''}
          onValueChange={(v) => {
            if (v === 'ja') { setDecisionConfirm(true); setDecisionChoice('approved'); }
            else if (v === 'nein') { setDecisionConfirm(true); setDecisionChoice('rejected'); }
            else if (v === 'pruefung') { setDecisionConfirm(true); setDecisionChoice('in_review'); }
          }}
          disabled={!canWrite}
          className="flex gap-6 flex-wrap"
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="ja" id="bf-ja" />
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">Ja (Zusage)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="nein" id="bf-nein" />
            <XCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm">Nein (Absage)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="pruefung" id="bf-pruefung" />
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm">In Prüfung</span>
          </label>
        </RadioGroup>

        {decisionConfirm && decisionChoice === 'rejected' && (
          <div>
            <Label className="text-xs text-muted-foreground">Grund der Absage</Label>
            <Textarea
              value={decisionNote}
              onChange={e => setDecisionNote(e.target.value)}
              disabled={!canWrite}
              placeholder="Begründung der Bank…"
              className="bg-secondary border-border mt-1 min-h-[60px]"
            />
          </div>
        )}

        {decisionConfirm && (
          <p className="text-xs text-muted-foreground">
            {decisionChoice === 'approved'
              ? 'Bei Speichern wird der Auftrag unter "Zusagen Bank" geführt.'
              : decisionChoice === 'rejected'
              ? 'Bei Speichern wird der Auftrag unter "Absagen Bank" geführt.'
              : 'Bei Speichern wird der Auftrag unter "Anfragen offen" geführt (In Prüfung).'}
          </p>
        )}

        {record?.decided_at && (
          <p className="text-xs text-muted-foreground">
            Zuletzt entschieden: {new Date(record.decided_at).toLocaleString('de-DE')} · Status: {record.status}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Dieser Vorgang hat keinen Einfluss auf Bestellungen oder andere Auftragsabläufe.
      </p>

      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gold-gradient text-primary-foreground">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Speichern
          </Button>
        </div>
      )}
    </div>
  );
}
