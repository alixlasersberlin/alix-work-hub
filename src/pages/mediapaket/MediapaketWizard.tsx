// Mediapaket-Wizard (öffentlich, tokenbasiert)
// Route: /book/mediapaket?token=<magic-link-token>
// 13 Schritte, Auto-Save via Edge Function `mediapaket-portal`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, Trash2, Upload, X, FileText, Image as ImageIcon, Save, MessageSquare, Send } from 'lucide-react';

const FN_URL = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/mediapaket-portal`;
const ANON = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;

type MP = any;

const STEPS = [
  { id: 'prep',      label: 'Vorbereitung' },
  { id: 'services',  label: 'Leistungen' },
  { id: 'studio',    label: 'Studio & Logo' },
  { id: 'devices',   label: 'Geräte' },
  { id: 'prices',    label: 'Preisliste' },
  { id: 'contact',   label: 'Kontakt' },
  { id: 'hours',     label: 'Öffnungszeiten' },
  { id: 'treatments',label: 'Fremdbehandlungen' },
  { id: 'branding',  label: 'Über mich & Team' },
  { id: 'design',    label: 'Designwünsche' },
  { id: 'notes',     label: 'Anmerkungen & Dateien' },
  { id: 'consents',  label: 'Freigaben' },
  { id: 'summary',   label: 'Zusammenfassung' },
] as const;

const WEEKDAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
const FILE_CATS = ['Logo','Preisliste','Teamfoto','Studiofoto','Gerätefoto','Zertifikat','Designvorlage','Flyerbeispiel','Social-Media-Beispiel','Textdokument','Sonstiges'];

async function call(action: string, token: string, body: any = {}) {
  const res = await fetch(`${FN_URL}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': `Bearer ${ANON}` },
    body: JSON.stringify({ token, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Fehler ${res.status}`);
  return json;
}

export default function MediapaketWizard() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<MP | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  const loadQuestions = useCallback(async () => {
    if (!token) return;
    try {
      const q = await call('list_questions', token);
      setQuestions(q.questions || []);
    } catch { /* noop */ }
  }, [token]);

  const reload = useCallback(async () => {
    if (!token) { setErr('Kein Zugriffs-Token angegeben.'); setLoading(false); return; }
    try {
      const d = await call('get', token);
      setData(d);
      if (d.root?.status === 'submitted' || d.root?.status === 'completed') setSubmitted(true);
      await loadQuestions();
    } catch (e: any) {
      setErr(e.message || 'Fehler beim Laden');
    } finally { setLoading(false); }
  }, [token, loadQuestions]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (section: string, values: any, row_id?: string) => {
    setSaving(true);
    try {
      await call('save_section', token, { section, values, row_id });
      await reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }, [token, reload]);

  const deleteRow = useCallback(async (section: string, row_id: string) => {
    try { await call('delete_row', token, { section, row_id }); await reload(); }
    catch (e: any) { toast.error(e.message); }
  }, [token, reload]);

  const uploadFile = useCallback(async (file: File, category: string, description?: string) => {
    try {
      const sig = await call('sign_upload', token, { filename: file.name, category });
      const put = await fetch(sig.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!put.ok) throw new Error('Upload fehlgeschlagen');
      await call('register_file', token, {
        path: sig.path, category, original_filename: file.name,
        mime_type: file.type, file_size: file.size, description,
      });
      await reload();
      toast.success('Datei hochgeladen');
    } catch (e: any) { toast.error(e.message); }
  }, [token, reload]);

  if (loading) return <BookingLayout><div className="flex items-center gap-2 p-8"><Loader2 className="w-4 h-4 animate-spin" /> Wird geladen…</div></BookingLayout>;
  if (err) return <BookingLayout><Card><CardContent className="p-6 text-sm text-destructive">{err}</CardContent></Card></BookingLayout>;
  if (!data) return null;

  if (submitted) {
    return <BookingLayout>
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-xl font-semibold">Ihr Mediapaket ist eingereicht</h2>
          <p className="text-sm text-muted-foreground">
            Vielen Dank für Ihre Angaben. Ihr Mediapaket wurde erfolgreich an Alix Lasers übermittelt.
            Unsere Mitarbeiter prüfen nun Ihre Daten und melden sich bei Rückfragen bei Ihnen.
          </p>
          <div className="text-xs text-muted-foreground">Status: {data.root?.status} · Fortschritt: {data.progress}%</div>
        </CardContent>
      </Card>
    </BookingLayout>;
  }

  const step = STEPS[stepIdx];

  return (
    <BookingLayout step={stepIdx + 1} totalSteps={STEPS.length}>
      <div className="space-y-4">
        {/* Header */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">Mein Media Paket</div>
              <div className="font-semibold text-[15px]">{data.root?.studio_name || 'Ihre Angaben'}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="min-w-[140px]">
                <div className="text-muted-foreground mb-1">Fortschritt {data.progress}%</div>
                <Progress value={data.progress} className="h-1.5" />
              </div>
              {saving && <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Speichert…</Badge>}
              {!saving && <Badge variant="outline" className="gap-1"><Save className="w-3 h-3" /> Automatisch gespeichert</Badge>}
            </div>
          </div>
        </div>

        {/* Offene Rückfragen */}
        <QuestionsBanner questions={questions} token={token} onChange={loadQuestions} />

        {/* Step-Navigation */}
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => setStepIdx(i)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition ${i === stepIdx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:border-primary'}`}>
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader><CardTitle className="text-[16px]">{stepIdx + 1}. {step.label}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {step.id === 'prep' && <StepPrep introText={data.settings?.['mediapaket.customer_intro_text']} />}
            {step.id === 'services' && <StepServices data={data} save={save} />}
            {step.id === 'studio' && <StepStudio data={data} save={save} upload={uploadFile} />}
            {step.id === 'devices' && <StepDevices data={data} save={save} del={deleteRow} />}
            {step.id === 'prices' && <StepPrices data={data} save={save} del={deleteRow} upload={uploadFile} />}
            {step.id === 'contact' && <StepContact data={data} save={save} />}
            {step.id === 'hours' && <StepHours data={data} save={save} />}
            {step.id === 'treatments' && <StepTreatments data={data} save={save} del={deleteRow} />}
            {step.id === 'branding' && <StepBranding data={data} save={save} del={deleteRow} />}
            {step.id === 'design' && <StepDesign data={data} save={save} />}
            {step.id === 'notes' && <StepNotes data={data} save={save} upload={uploadFile} />}
            {step.id === 'consents' && <StepConsents data={data} save={save} />}
            {step.id === 'summary' && <StepSummary data={data} confirmText={data.settings?.['mediapaket.submit_confirm_text']} onSubmit={async () => {
              try { await call('submit', token); toast.success('Mediapaket eingereicht'); await reload(); }
              catch (e: any) { toast.error(e.message); }
            }} />}
          </CardContent>
        </Card>

        {/* Footer nav */}
        <div className="flex justify-between">
          <Button variant="outline" size="sm" disabled={stepIdx === 0} onClick={() => setStepIdx(stepIdx - 1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <Button size="sm" disabled={stepIdx === STEPS.length - 1} onClick={() => setStepIdx(stepIdx + 1)}>
            Weiter <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </BookingLayout>
  );
}

/* =============== QUESTIONS BANNER =============== */

function QuestionsBanner({ questions, token, onChange }: { questions: any[]; token: string; onChange: () => void }) {
  const open = questions.filter(q => q.author_type === 'staff' && !q.answered_at);
  const answered = questions.filter(q => q.author_type === 'staff' && q.answered_at);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const send = async (id: string) => {
    const text = (answers[id] || '').trim();
    if (!text) return;
    setSending(id);
    try {
      await call('answer_question', token, { question_id: id, answer: text, base_url: window.location.origin });
      setAnswers(a => ({ ...a, [id]: '' }));
      toast.success('Antwort gesendet');
      onChange();
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(null); }
  };

  if (open.length === 0 && answered.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="w-4 h-4 text-amber-500" />
        Rückfragen von Alix Lasers ({open.length} offen)
      </div>
      {open.map(q => (
        <div key={q.id} className="rounded-lg border border-amber-500/30 bg-card p-3 space-y-2">
          {q.subject && <div className="text-sm font-medium">{q.subject}</div>}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.comment}</p>
          <Textarea
            placeholder="Ihre Antwort..."
            value={answers[q.id] || ''}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => send(q.id)} disabled={sending === q.id || !(answers[q.id] || '').trim()}>
              {sending === q.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Antworten
            </Button>
          </div>
        </div>
      ))}
      {answered.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Beantwortete Rückfragen ({answered.length})</summary>
          <div className="mt-2 space-y-2">
            {answered.map(q => (
              <div key={q.id} className="rounded border border-border/40 p-2">
                {q.subject && <div className="font-medium">{q.subject}</div>}
                <p className="whitespace-pre-wrap">{q.comment}</p>
                <div className="text-[10px] mt-1">Beantwortet am {new Date(q.answered_at).toLocaleString('de-DE')}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* =============== STEP COMPONENTS =============== */

function StepPrep({ introText }: { introText?: string }) {
  const items = [
    'Logo und Name des Studios',
    'genauer Modellname des Alix-Lasers-Gerätes',
    'vollständige Preisliste',
    'Preise für Fremdbehandlungen',
    'Telefon, E-Mail, WhatsApp',
    'Studioadresse',
    'Instagram, TikTok, Facebook',
    'Öffnungszeiten oder „Termine nach Vereinbarung"',
    'Beschreibung der Fremdbehandlungen',
    'Kurze Beschreibung Inhaber/Team',
  ];
  return (
    <div className="space-y-3">
      {introText && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">{introText}</div>
      )}
      <p className="text-sm text-muted-foreground">Bitte prüfen Sie, ob folgende Unterlagen vollständig vorliegen. Sie können jederzeit unterbrechen und später fortsetzen.</p>
      <ul className="space-y-1.5">
        {items.map(i => <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> {i}</li>)}
      </ul>
    </div>
  );
}

function StepServices({ data, save }: any) {
  const services = ['website','flyer','social_media'] as const;
  const labels: Record<string,string> = { website: 'Kostenlose Webseite', flyer: 'Kostenloses Design & Druck von 5.000 Flyern', social_media: 'Kostenlose Posting-Vorlagen für Social Media' };
  const bySel = (t: string) => data.services?.find((s: any) => s.service_type === t);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Welche Leistungen möchten Sie in Anspruch nehmen?</p>
      {services.map(t => {
        const row = bySel(t);
        return (
          <label key={t} className="flex items-center gap-3 p-3 rounded-md border hover:border-primary cursor-pointer">
            <Checkbox checked={!!row?.selected} onCheckedChange={(v) => save('services', { service_type: t, selected: !!v }, row?.id)} />
            <span className="text-sm">{labels[t]}</span>
          </label>
        );
      })}
    </div>
  );
}

function DebouncedForm({ initial, onSave, fields }: any) {
  const [v, setV] = useState<any>(initial || {});
  useEffect(() => setV(initial || {}), [initial]);
  const timer = useRef<any>();
  const change = (k: string, val: any) => {
    const nv = { ...v, [k]: val }; setV(nv);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(nv), 700);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f: any) => (
        <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}>
          <Label className="text-xs">{f.label}{f.required && ' *'}</Label>
          {f.type === 'textarea'
            ? <Textarea value={v[f.name] || ''} onChange={(e) => change(f.name, e.target.value)} rows={f.rows || 3} />
            : f.type === 'select'
            ? <Select value={v[f.name] || ''} onValueChange={(x) => change(f.name, x)}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                <SelectContent>{f.options.map((o: any) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            : <Input type={f.type || 'text'} value={v[f.name] || ''} onChange={(e) => change(f.name, e.target.value)} />
          }
        </div>
      ))}
    </div>
  );
}

function StepStudio({ data, save, upload }: any) {
  const logo = data.files?.find((f: any) => f.category === 'Logo');
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Studio-Logo (PNG, SVG, EPS, AI, PDF, JPG)</Label>
        {logo ? (
          <div className="flex items-center gap-2 p-2 border rounded"><ImageIcon className="w-4 h-4" /> <span className="text-sm">{logo.original_filename}</span></div>
        ) : (
          <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded cursor-pointer hover:border-primary">
            <Upload className="w-4 h-4" />
            <span className="text-sm text-muted-foreground">Datei auswählen</span>
            <input type="file" className="hidden" accept=".png,.svg,.eps,.ai,.pdf,.jpg,.jpeg" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'Logo')} />
          </label>
        )}
      </div>
      <DebouncedForm initial={data.studio} onSave={(v: any) => save('studio', v)} fields={[
        { name: 'studio_name', label: 'Studioname', required: true },
        { name: 'contact_name', label: 'Ansprechpartner', required: true },
        { name: 'desired_domain', label: 'Gewünschte Domain' },
        { name: 'alternative_domain', label: 'Alternative Wunschdomain' },
        { name: 'existing_domain', label: 'Bestehende Domain' },
        { name: 'domain_registered', label: 'Domain bereits registriert?', type: 'select', options: [
          { value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nein' }, { value: 'unknown', label: 'Unbekannt' }
        ]},
        { name: 'company_name_website', label: 'Firmenname auf Webseite' },
        { name: 'company_name_print', label: 'Firmenname auf Flyern' },
      ]} />
    </div>
  );
}

function StepDevices({ data, save, del }: any) {
  const [entered, setEntered] = useState('');
  const [serial, setSerial] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Tragen Sie den genauen Modellnamen Ihres Alix-Lasers-Gerätes ein.</p>
      {(data.devices || []).map((d: any) => (
        <div key={d.id} className="flex items-center gap-2 p-2 border rounded">
          <div className="flex-1 text-sm"><b>{d.entered_model_name || 'Modell'}</b> · SN: {d.serial_number || '—'}</div>
          <Button size="sm" variant="ghost" onClick={() => del('devices', d.id)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <div className="flex gap-2 items-end">
        <div className="flex-1"><Label className="text-xs">Modellname</Label><Input value={entered} onChange={e => setEntered(e.target.value)} /></div>
        <div className="flex-1"><Label className="text-xs">Seriennummer</Label><Input value={serial} onChange={e => setSerial(e.target.value)} /></div>
        <Button size="sm" onClick={async () => {
          if (!entered) return;
          await save('devices', { entered_model_name: entered, serial_number: serial });
          setEntered(''); setSerial('');
        }}><Plus className="w-3 h-3 mr-1" /> Hinzufügen</Button>
      </div>
    </div>
  );
}

function StepPrices({ data, save, del, upload }: any) {
  const [row, setRow] = useState<any>({ category: '', treatment_name: '', regular_price: '', duration_minutes: '' });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Erfassen Sie Behandlungen einzeln oder laden Sie Ihre Preisliste als Datei hoch.</p>
      <div className="space-y-1">
        {(data.prices || []).map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 p-2 border rounded text-sm">
            <span className="text-xs text-muted-foreground w-24">{p.category || '—'}</span>
            <span className="flex-1"><b>{p.treatment_name}</b> {p.duration_minutes ? `· ${p.duration_minutes} min` : ''}</span>
            <span className="w-20 text-right">{p.regular_price ? `${p.regular_price} €` : ''}</span>
            <Button size="sm" variant="ghost" onClick={() => del('prices', p.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div><Label className="text-xs">Kategorie</Label><Input value={row.category} onChange={e => setRow({ ...row, category: e.target.value })} /></div>
        <div><Label className="text-xs">Behandlung</Label><Input value={row.treatment_name} onChange={e => setRow({ ...row, treatment_name: e.target.value })} /></div>
        <div><Label className="text-xs">Dauer (min)</Label><Input type="number" value={row.duration_minutes} onChange={e => setRow({ ...row, duration_minutes: e.target.value })} /></div>
        <div><Label className="text-xs">Preis (€)</Label><Input type="number" step="0.01" value={row.regular_price} onChange={e => setRow({ ...row, regular_price: e.target.value })} /></div>
        <div className="col-span-2 sm:col-span-4">
          <Button size="sm" onClick={async () => {
            if (!row.treatment_name) return;
            await save('prices', {
              ...row,
              duration_minutes: row.duration_minutes ? Number(row.duration_minutes) : null,
              regular_price: row.regular_price ? Number(row.regular_price) : null,
            });
            setRow({ category: '', treatment_name: '', regular_price: '', duration_minutes: '' });
          }}><Plus className="w-3 h-3 mr-1" /> Behandlung hinzufügen</Button>
        </div>
      </div>
      <div>
        <Label className="text-xs">Oder Preisliste als Datei hochladen</Label>
        <label className="flex items-center gap-2 p-3 border-2 border-dashed rounded cursor-pointer hover:border-primary">
          <Upload className="w-4 h-4" />
          <span className="text-sm text-muted-foreground">PDF, DOC, XLSX, CSV, JPG, PNG</span>
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'Preisliste')} />
        </label>
        <div className="mt-2 space-y-1">
          {(data.files || []).filter((f: any) => f.category === 'Preisliste').map((f: any) => (
            <div key={f.id} className="text-xs flex items-center gap-2"><FileText className="w-3 h-3" /> {f.original_filename}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepContact({ data, save }: any) {
  return <DebouncedForm initial={data.contact} onSave={(v: any) => save('contact', v)} fields={[
    { name: 'company_name', label: 'Firmenname' },
    { name: 'studio_name', label: 'Studioname' },
    { name: 'contact_name', label: 'Ansprechpartner' },
    { name: 'street', label: 'Straße' },
    { name: 'house_number', label: 'Hausnummer' },
    { name: 'postal_code', label: 'PLZ' },
    { name: 'city', label: 'Ort' },
    { name: 'state', label: 'Bundesland' },
    { name: 'country', label: 'Land' },
    { name: 'phone', label: 'Telefon' },
    { name: 'mobile', label: 'Mobil' },
    { name: 'whatsapp', label: 'WhatsApp' },
    { name: 'email', label: 'E-Mail', required: true, type: 'email' },
    { name: 'secondary_email', label: 'Zweit-E-Mail', type: 'email' },
    { name: 'website', label: 'Webseite' },
    { name: 'instagram', label: 'Instagram' },
    { name: 'tiktok', label: 'TikTok' },
    { name: 'facebook', label: 'Facebook' },
    { name: 'youtube', label: 'YouTube' },
    { name: 'linkedin', label: 'LinkedIn' },
    { name: 'booking_url', label: 'Buchungslink' },
    { name: 'google_business_url', label: 'Google-Unternehmensprofil' },
    { name: 'preferred_contact_channel', label: 'Hauptkontaktweg' },
  ]} />;
}

function StepHours({ data, save }: any) {
  const byDay = (w: number) => data.hours?.find((h: any) => h.weekday === w) || { weekday: w };
  return (
    <div className="space-y-2">
      {WEEKDAYS.map((label, w) => {
        const row = byDay(w);
        return (
          <div key={w} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end p-2 border rounded">
            <div className="text-sm font-medium">{label}</div>
            <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={!!row.closed} onCheckedChange={(v) => save('hours', { ...row, closed: !!v }, row.id)} /> geschlossen</label>
            <div><Label className="text-[10px]">Von</Label><Input type="time" value={row.first_start || ''} onChange={e => save('hours', { ...row, first_start: e.target.value }, row.id)} /></div>
            <div><Label className="text-[10px]">Bis</Label><Input type="time" value={row.first_end || ''} onChange={e => save('hours', { ...row, first_end: e.target.value }, row.id)} /></div>
            <div><Label className="text-[10px]">2. Von</Label><Input type="time" value={row.second_start || ''} onChange={e => save('hours', { ...row, second_start: e.target.value }, row.id)} /></div>
            <div><Label className="text-[10px]">2. Bis</Label><Input type="time" value={row.second_end || ''} onChange={e => save('hours', { ...row, second_end: e.target.value }, row.id)} /></div>
          </div>
        );
      })}
    </div>
  );
}

function StepTreatments({ data, save, del }: any) {
  const [row, setRow] = useState<any>({ treatment_name: '', category: '', price: '', duration_minutes: '' });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Beschreiben Sie zusätzlich angebotene Fremdbehandlungen.</p>
      {(data.treatments || []).map((t: any) => (
        <div key={t.id} className="flex items-center gap-2 p-2 border rounded text-sm">
          <span className="flex-1"><b>{t.treatment_name}</b> {t.category ? `· ${t.category}` : ''}</span>
          <span>{t.price ? `${t.price} €` : ''}</span>
          <Button size="sm" variant="ghost" onClick={() => del('treatments', t.id)}><Trash2 className="w-3 h-3" /></Button>
        </div>
      ))}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <div><Label className="text-xs">Behandlung</Label><Input value={row.treatment_name} onChange={e => setRow({ ...row, treatment_name: e.target.value })} /></div>
        <div><Label className="text-xs">Kategorie</Label><Input value={row.category} onChange={e => setRow({ ...row, category: e.target.value })} /></div>
        <div><Label className="text-xs">Dauer (min)</Label><Input type="number" value={row.duration_minutes} onChange={e => setRow({ ...row, duration_minutes: e.target.value })} /></div>
        <div><Label className="text-xs">Preis (€)</Label><Input type="number" step="0.01" value={row.price} onChange={e => setRow({ ...row, price: e.target.value })} /></div>
        <div className="col-span-2 sm:col-span-4">
          <Button size="sm" onClick={async () => {
            if (!row.treatment_name) return;
            await save('treatments', {
              ...row,
              duration_minutes: row.duration_minutes ? Number(row.duration_minutes) : null,
              price: row.price ? Number(row.price) : null,
            });
            setRow({ treatment_name: '', category: '', price: '', duration_minutes: '' });
          }}><Plus className="w-3 h-3 mr-1" /> Hinzufügen</Button>
        </div>
      </div>
    </div>
  );
}

function StepBranding({ data, save, del }: any) {
  const [tm, setTm] = useState<any>({ first_name: '', last_name: '', role: '' });
  return (
    <div className="space-y-4">
      <DebouncedForm initial={data.branding} onSave={(v: any) => save('branding', v)} fields={[
        { name: 'about_me', label: 'Über mich', type: 'textarea', full: true },
        { name: 'studio_description', label: 'Beschreibung des Studios', type: 'textarea', full: true },
        { name: 'company_philosophy', label: 'Unternehmensphilosophie', type: 'textarea', full: true },
        { name: 'qualifications', label: 'Qualifikationen' },
        { name: 'certificates', label: 'Zertifikate' },
        { name: 'professional_experience', label: 'Berufserfahrung' },
        { name: 'languages', label: 'Sprachen' },
        { name: 'focus_areas', label: 'Schwerpunkte' },
        { name: 'team_intro', label: 'Teamvorstellung', type: 'textarea', full: true },
        { name: 'preferred_salutation', label: 'Ansprache', type: 'select', options: [
          { value: 'du', label: 'Du' }, { value: 'sie', label: 'Sie' }
        ]},
        { name: 'preferred_writing_style', label: 'Schreibstil' },
        { name: 'preferred_tone', label: 'Tonalität' },
      ]} />
      <div>
        <h4 className="text-sm font-semibold mb-2">Teammitglieder</h4>
        {(data.team || []).map((t: any) => (
          <div key={t.id} className="flex items-center gap-2 p-2 border rounded text-sm mb-1">
            <span className="flex-1">{t.first_name} {t.last_name} · {t.role}</span>
            <Button size="sm" variant="ghost" onClick={() => del('team', t.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 items-end mt-2">
          <div><Label className="text-xs">Vorname</Label><Input value={tm.first_name} onChange={e => setTm({ ...tm, first_name: e.target.value })} /></div>
          <div><Label className="text-xs">Nachname</Label><Input value={tm.last_name} onChange={e => setTm({ ...tm, last_name: e.target.value })} /></div>
          <div><Label className="text-xs">Position</Label><Input value={tm.role} onChange={e => setTm({ ...tm, role: e.target.value })} /></div>
          <div className="col-span-3">
            <Button size="sm" onClick={async () => {
              if (!tm.first_name && !tm.last_name) return;
              await save('team', tm); setTm({ first_name: '', last_name: '', role: '' });
            }}><Plus className="w-3 h-3 mr-1" /> Teammitglied hinzufügen</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDesign({ data, save }: any) {
  return <DebouncedForm initial={data.branding} onSave={(v: any) => save('branding', v)} fields={[
    { name: 'preferred_colors', label: 'Gewünschte Farben' },
    { name: 'excluded_colors', label: 'Unerwünschte Farben' },
    { name: 'preferred_fonts', label: 'Bevorzugte Schriftarten' },
    { name: 'slogan', label: 'Slogan' },
    { name: 'claims', label: 'Claims' },
    { name: 'visual_language', label: 'Bildsprache' },
    { name: 'target_group', label: 'Zielgruppe' },
    { name: 'target_age_group', label: 'Altersgruppe' },
    { name: 'regional_focus', label: 'Regionale Ausrichtung' },
    { name: 'unique_selling_points', label: 'Alleinstellungsmerkmale', type: 'textarea', full: true },
    { name: 'main_message', label: 'Hauptbotschaft', type: 'textarea', full: true },
    { name: 'website_examples_positive', label: 'Webseiten, die gefallen', type: 'textarea', full: true },
    { name: 'website_examples_negative', label: 'Webseiten, die nicht gefallen', type: 'textarea', full: true },
    { name: 'other_requirements', label: 'Weitere Wünsche', type: 'textarea', full: true },
  ]} />;
}

function StepNotes({ data, save, upload }: any) {
  const [cat, setCat] = useState('Sonstiges');
  return (
    <div className="space-y-4">
      <DebouncedForm initial={data.branding} onSave={(v: any) => save('branding', v)} fields={[
        { name: 'other_requirements', label: 'Allgemeine Anmerkungen (Webseite, Flyer, Social Media, Fristen, Wünsche)', type: 'textarea', full: true, rows: 6 },
      ]} />
      <div>
        <Label className="text-xs">Dateien hochladen</Label>
        <div className="flex gap-2 items-end mb-2">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{FILE_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <label className="flex-1 flex items-center gap-2 p-3 border-2 border-dashed rounded cursor-pointer hover:border-primary">
            <Upload className="w-4 h-4" />
            <span className="text-sm text-muted-foreground">Datei auswählen (PDF, PNG, JPG, DOC, XLSX, ZIP…)</span>
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], cat)} />
          </label>
        </div>
        <div className="space-y-1">
          {(data.files || []).map((f: any) => (
            <div key={f.id} className="text-xs flex items-center gap-2 p-1.5 border rounded">
              <FileText className="w-3 h-3" />
              <Badge variant="outline" className="text-[10px]">{f.category}</Badge>
              <span className="flex-1">{f.original_filename}</span>
              <span className="text-muted-foreground">{(f.file_size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepConsents({ data, save }: any) {
  const consents = [
    { key: 'data_correct', label: 'Ich bestätige, dass meine Angaben vollständig und korrekt sind.', required: true },
    { key: 'file_rights', label: 'Ich bestätige, dass ich zur Nutzung der Dateien berechtigt bin.', required: true },
    { key: 'usage', label: 'Alix Lasers darf die übermittelten Inhalte für mein Mediapaket verwenden.', required: true },
    { key: 'privacy', label: 'Ich habe die Datenschutzinformationen gelesen und akzeptiert.', required: true },
    { key: 'publish_studio', label: 'Veröffentlichung der Studioinformationen' },
    { key: 'images_website', label: 'Nutzung der Bilder für Webseite' },
    { key: 'images_flyer', label: 'Nutzung der Bilder für Flyer' },
    { key: 'images_social', label: 'Nutzung der Bilder für Social Media' },
    { key: 'team_photos', label: 'Verwendung von Teamfotos' },
    { key: 'logo_usage', label: 'Verwendung des Logos' },
    { key: 'contact_publish', label: 'Veröffentlichung von Kontaktdaten' },
  ];
  const byType = (k: string) => data.consents?.find((c: any) => c.consent_type === k);
  return (
    <div className="space-y-2">
      {consents.map(c => {
        const row = byType(c.key);
        return (
          <label key={c.key} className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:border-primary">
            <Checkbox className="mt-0.5" checked={!!row?.accepted} onCheckedChange={(v) => save('consents', {
              consent_type: c.key, accepted: !!v, consent_text_version: '2026-07-11',
              accepted_at: v ? new Date().toISOString() : null,
            }, row?.id)} />
            <span className="text-sm">{c.label}{c.required && <span className="text-destructive"> *</span>}</span>
          </label>
        );
      })}
    </div>
  );
}

function StepSummary({ data, onSubmit, confirmText }: any) {
  const requiredConsents = ['data_correct','file_rights','usage','privacy'];
  const missing = requiredConsents.filter(k => !data.consents?.find((c: any) => c.consent_type === k && c.accepted));
  const canSubmit = missing.length === 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {[
          ['Leistungen', (data.services || []).filter((s: any) => s.selected).length],
          ['Geräte', (data.devices || []).length],
          ['Preise', (data.prices || []).length],
          ['Öffnungszeiten', (data.hours || []).length],
          ['Fremdbehandlungen', (data.treatments || []).length],
          ['Team', (data.team || []).length],
          ['Dateien', (data.files || []).length],
          ['Einwilligungen', (data.consents || []).filter((c: any) => c.accepted).length],
          ['Fortschritt', `${data.progress}%`],
        ].map(([l, v]) => (
          <div key={l as string} className="p-2 border rounded"><div className="text-muted-foreground">{l}</div><div className="font-semibold">{v}</div></div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
          Bitte akzeptieren Sie noch die folgenden Pflicht-Einwilligungen im Schritt „Freigaben": {missing.join(', ')}
        </div>
      )}
      {confirmText && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs whitespace-pre-wrap text-muted-foreground">{confirmText}</div>
      )}
      <Button className="w-full" size="lg" disabled={!canSubmit} onClick={onSubmit}>
        <CheckCircle2 className="w-4 h-4 mr-2" /> Mediapaket verbindlich absenden
      </Button>
    </div>
  );
}
