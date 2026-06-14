import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, FilePlus, UserPlus, UserCheck, Archive, Phone, CalendarPlus, Mail, Loader2, Pencil, Save, X, Send,
} from 'lucide-react';

const STATUS_OPTIONS = [
  'Importiert - Angebot offen',
  'Neu',
  'In Bearbeitung',
  'Angebot erstellt',
  'Nachfassen',
  'Gewonnen',
  'Verloren',
  'Archiviert',
];

export default function SalesLeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('Super Admin');
  const [lead, setLead] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupType, setFollowupType] = useState('Rückruf');
  const [followupTitle, setFollowupTitle] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data: l }, { data: h }, { data: f }] = await Promise.all([
      supabase.from('sales_leads').select('*').eq('id', id).maybeSingle(),
      supabase.from('sales_lead_history').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('sales_followups').select('*').eq('lead_id', id).order('due_at', { ascending: true }),
    ]);
    setLead(l);
    setHistory(h ?? []);
    setFollowups(f ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return <div className="p-10 flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-5 w-5" /> Lade …</div>;
  }
  if (!lead) {
    return (
      <div className="p-10 space-y-4">
        <p>Anfrage nicht gefunden.</p>
        <Button variant="outline" onClick={() => nav('/verkauf/anfragen')}><ArrowLeft className="h-4 w-4 mr-2" />Zurück</Button>
      </div>
    );
  }

  async function updateLead(patch: any) {
    setSaving(true);
    const { error } = await supabase.from('sales_leads').update(patch).eq('id', id!);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await load();
  }

  async function findOrLinkCustomer(): Promise<string | null> {
    if (lead.converted_customer_id) return lead.converted_customer_id;
    const filters: string[] = [];
    if (lead.email) filters.push(`email.ilike.${lead.email}`);
    if (lead.phone) filters.push(`phone.ilike.%${lead.phone}%`);
    if (lead.company) filters.push(`company_name.ilike.%${lead.company}%`);
    if (filters.length === 0) return null;
    const { data } = await supabase.from('customers').select('id').or(filters.join(',')).limit(1);
    return data?.[0]?.id ?? null;
  }

  async function linkExistingCustomer() {
    const cid = await findOrLinkCustomer();
    if (!cid) { toast.error('Kein passender Kunde gefunden. Bitte „Neuen Kunden anlegen"."'); return; }
    await updateLead({ converted_customer_id: cid });
    toast.success('Kunde verknüpft');
  }

  async function createCustomer() {
    const payload: any = {
      company_name: lead.company || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Neue Anfrage',
      contact_name: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
      email: lead.email || null,
      phone: lead.phone || null,
      billing_address: [lead.street, [lead.zip, lead.city].filter(Boolean).join(' '), lead.country].filter(Boolean).join(', ') || null,
      shipping_address: [lead.street, [lead.zip, lead.city].filter(Boolean).join(' '), lead.country].filter(Boolean).join(', ') || null,
    };
    const { data, error } = await supabase.from('customers').insert(payload).select('id').single();
    if (error) { toast.error(error.message); return; }
    await updateLead({ converted_customer_id: data.id });
    toast.success('Kunde angelegt und verknüpft');
  }

  async function createOffer() {
    let cid = lead.converted_customer_id as string | null;
    if (!cid) cid = await findOrLinkCustomer();
    const services = Array.isArray(lead.additional_services)
      ? lead.additional_services
      : (Array.isArray(lead.additional_interests) ? lead.additional_interests : []);
    const handoff = {
      customer_id: cid,
      customer_email: lead.email,
      customer_company: lead.company,
      notes: [
        lead.lead_number && `Lead: ${lead.lead_number}`,
        lead.device_category && `Geräteklasse: ${lead.device_category}`,
        services.length > 0 && `Zusatzleistungen: ${services.join(', ')}`,
        lead.customer_goal && `Kundenziel: ${lead.customer_goal}`,
        lead.implementation_period && `Umsetzungszeitraum: ${lead.implementation_period}`,
        lead.requested_products && `Produktinteresse: ${lead.requested_products}`,
        lead.message,
        lead.notes,
      ].filter(Boolean).join('\n\n'),
      source: 'sales_lead',
      lead_id: lead.id,
    };
    sessionStorage.setItem('sales_lead_handoff_v1', JSON.stringify(handoff));
    await updateLead({ lead_status: 'Angebot erstellt' });
    try {
      await supabase.from('sales_lead_history').insert({
        lead_id: lead.id,
        action: 'offer_started',
        note: 'Angebot-Erstellung gestartet via Detail',
      } as any);
    } catch { /* ignore */ }
    nav('/verkauf/angebot/neu');
  }

  async function saveFollowup() {
    if (!followupTitle.trim()) { toast.error('Titel fehlt'); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('sales_followups').insert({
      lead_id: id,
      type: followupType,
      title: followupTitle,
      description: followupNote || null,
      due_at: followupDate ? new Date(followupDate).toISOString() : null,
      created_by: u?.user?.id ?? null,
      assigned_user: u?.user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Nachfass-Aufgabe angelegt');
    setFollowupOpen(false);
    setFollowupTitle(''); setFollowupNote(''); setFollowupDate('');
    await load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/verkauf/anfragen')}><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold">{lead.company || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Anfrage'}</h1>
            {lead.lead_number && <span className="text-xs text-muted-foreground font-mono">{lead.lead_number}</span>}
          </div>
          <Badge variant="outline">{lead.lead_status}</Badge>
          {lead.converted_customer_id && (
            <Link to={`/kunden/${lead.converted_customer_id}`} className="text-xs text-primary underline">Kunde geöffnet</Link>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={createOffer}><FilePlus className="h-4 w-4 mr-1" />Angebot erstellen</Button>
          <Button variant="outline" onClick={linkExistingCustomer}><UserCheck className="h-4 w-4 mr-1" />Kunde zuordnen</Button>
          <Button variant="outline" onClick={createCustomer}><UserPlus className="h-4 w-4 mr-1" />Neuen Kunden anlegen</Button>
          <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><CalendarPlus className="h-4 w-4 mr-1" />Nachfass-Termin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nachfass-Aufgabe anlegen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Typ</Label>
                  <Select value={followupType} onValueChange={setFollowupType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rückruf">Rückruf</SelectItem>
                      <SelectItem value="Termin">Termin</SelectItem>
                      <SelectItem value="Wiedervorlage">Wiedervorlage</SelectItem>
                      <SelectItem value="Erinnerung">Erinnerung</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Titel</Label><Input value={followupTitle} onChange={(e) => setFollowupTitle(e.target.value)} /></div>
                <div><Label>Fällig am</Label><Input type="datetime-local" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} /></div>
                <div><Label>Notiz</Label><Textarea value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={saveFollowup}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          {lead.email && (
            <Button asChild variant="outline"><a href={`mailto:${lead.email}`}><Mail className="h-4 w-4 mr-1" />E-Mail</a></Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              const tid = toast.loading('Sende Benachrichtigung …');
              const { error } = await supabase.functions.invoke('send-transactional-email', {
                body: {
                  templateName: 'sales-lead-internal-notification',
                  recipientEmail: lead.email || 'homebln@icloud.com',
                  idempotencyKey: `sales-lead-resend-${lead.id}-${Date.now()}`,
                  extraCc: ['homebln@icloud.com', 'rde@alix-lasers.com'].filter((e) => e !== lead.email),
                  skipDefaultCopies: true,
                  templateData: {
                    lead_id: lead.id,
                    lead_number: lead.lead_number,
                    source: lead.source,
                    first_name: lead.first_name,
                    last_name: lead.last_name,
                    company: lead.company,
                    email: lead.email,
                    phone: lead.phone,
                    country_code: lead.country_code,
                    city: lead.city,
                    zip: lead.zip,
                    country: lead.country,
                    interests: lead.interests,
                    additional_interests: lead.additional_interests,
                    requested_products: lead.requested_products,
                    delivery_preference: lead.delivery_preference,
                    consultation_type: lead.consultation_type,
                    notes: lead.notes ?? lead.message,
                    lead_score: lead.lead_score,
                    score_category: lead.score_category,
                    ai_priority: lead.ai_priority,
                    ai_summary: lead.ai_summary,
                    app_base_url: 'https://alixwork.de',
                  },
                },
              });
              toast.dismiss(tid);
              if (error) toast.error('Senden fehlgeschlagen: ' + error.message);
              else toast.success('Benachrichtigung gesendet');
            }}
          >
            <Send className="h-4 w-4 mr-1" />Benachrichtigung senden
          </Button>
          {!lead.archived && (
            <Button variant="ghost" onClick={() => updateLead({ archived: true, lead_status: 'Archiviert' })}>
              <Archive className="h-4 w-4 mr-1" />Archivieren
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label>Status:</Label>
        <Select value={lead.lead_status} onValueChange={(v) => updateLead({ lead_status: v })} disabled={saving}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="stammdaten">
        <TabsList>
          <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
          <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
          <TabsTrigger value="notizen">Notizen</TabsTrigger>
          <TabsTrigger value="angebote">Angebote</TabsTrigger>
          <TabsTrigger value="historie">Historie</TabsTrigger>
        </TabsList>

        <TabsContent value="stammdaten" className="mt-4">
          <Card className="p-6 space-y-4">
            {canEdit && (
              <div className="flex justify-end gap-2">
                {!editMode ? (
                  <Button variant="outline" size="sm" onClick={() => { setEditForm({
                    company: lead.company ?? '', first_name: lead.first_name ?? '', last_name: lead.last_name ?? '',
                    email: lead.email ?? '', phone: lead.phone ?? '', street: lead.street ?? '',
                    zip: lead.zip ?? '', city: lead.city ?? '', country: lead.country ?? '',
                    device_category: lead.device_category ?? '', implementation_period: lead.implementation_period ?? '',
                    customer_goal: lead.customer_goal ?? '', requested_products: lead.requested_products ?? '',
                    additional_services: (Array.isArray(lead.additional_services) ? lead.additional_services : []).join(', '),
                    message: lead.message ?? '', notes: lead.notes ?? '',
                    service_rating: lead.service_rating ?? '',
                  }); setEditMode(true); }}>
                    <Pencil className="h-4 w-4 mr-1" />Bearbeiten
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} disabled={saving}>
                      <X className="h-4 w-4 mr-1" />Abbrechen
                    </Button>
                    <Button size="sm" disabled={saving} onClick={async () => {
                      const patch: any = { ...editForm };
                      patch.additional_services = String(editForm.additional_services || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      patch.service_rating = editForm.service_rating === '' || editForm.service_rating == null ? null : Number(editForm.service_rating);
                      Object.keys(patch).forEach(k => { if (patch[k] === '') patch[k] = null; });
                      await updateLead(patch);
                      try {
                        await supabase.from('sales_lead_history').insert({ lead_id: lead.id, action: 'lead_edited', note: 'Stammdaten bearbeitet (Super Admin)' } as any);
                      } catch { /* ignore */ }
                      setEditMode(false);
                      toast.success('Lead aktualisiert');
                    }}>
                      <Save className="h-4 w-4 mr-1" />Speichern
                    </Button>
                  </>
                )}
              </div>
            )}
            {editMode ? (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <EditField label="Firma" v={editForm.company} on={(v) => setEditForm({ ...editForm, company: v })} />
                <EditField label="Vorname" v={editForm.first_name} on={(v) => setEditForm({ ...editForm, first_name: v })} />
                <EditField label="Nachname" v={editForm.last_name} on={(v) => setEditForm({ ...editForm, last_name: v })} />
                <EditField label="E-Mail" v={editForm.email} on={(v) => setEditForm({ ...editForm, email: v })} />
                <EditField label="Telefon" v={editForm.phone} on={(v) => setEditForm({ ...editForm, phone: v })} />
                <EditField label="Straße" v={editForm.street} on={(v) => setEditForm({ ...editForm, street: v })} />
                <EditField label="PLZ" v={editForm.zip} on={(v) => setEditForm({ ...editForm, zip: v })} />
                <EditField label="Ort" v={editForm.city} on={(v) => setEditForm({ ...editForm, city: v })} />
                <EditField label="Land" v={editForm.country} on={(v) => setEditForm({ ...editForm, country: v })} />
                <EditField label="Geräteklasse" v={editForm.device_category} on={(v) => setEditForm({ ...editForm, device_category: v })} />
                <EditField label="Umsetzungszeitraum" v={editForm.implementation_period} on={(v) => setEditForm({ ...editForm, implementation_period: v })} />
                <EditField label="Bewertung (1-5)" v={editForm.service_rating} on={(v) => setEditForm({ ...editForm, service_rating: v })} />
                <div className="md:col-span-2"><EditField label="Kundenziel" v={editForm.customer_goal} on={(v) => setEditForm({ ...editForm, customer_goal: v })} /></div>
                <div className="md:col-span-2"><EditField label="Zusatzleistungen (Komma-getrennt)" v={editForm.additional_services} on={(v) => setEditForm({ ...editForm, additional_services: v })} /></div>
                <div className="md:col-span-2"><EditField label="Produktinteresse" v={editForm.requested_products} on={(v) => setEditForm({ ...editForm, requested_products: v })} /></div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">Nachricht</Label>
                  <Textarea rows={4} value={editForm.message} onChange={(e) => setEditForm({ ...editForm, message: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs uppercase text-muted-foreground">Notizen</Label>
                  <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <Field label="Firma" value={lead.company} />
                <Field label="Ansprechpartner" value={[lead.first_name, lead.last_name].filter(Boolean).join(' ')} />
                <Field label="E-Mail" value={lead.email} />
                <Field label="Telefon" value={lead.phone} />
                <Field label="Straße" value={lead.street} />
                <Field label="PLZ / Ort" value={[lead.zip, lead.city].filter(Boolean).join(' ')} />
                <Field label="Land" value={lead.country} />
                <Field label="Quelle / Formular" value={lead.form_name || lead.source} />
                <Field label="Externe ID" value={lead.external_id} />
                <Field label="Leadnummer" value={lead.lead_number} />
                <Field label="Importdatum" value={new Date(lead.created_at).toLocaleString('de-DE')} />
                <Field label="Geräteklasse" value={lead.device_category} />
                <Field label="Umsetzungszeitraum" value={lead.implementation_period} />
                <Field label="Bewertung" value={lead.service_rating ? `${lead.service_rating} / 5` : null} />
                <Field label="Kundenziel" value={lead.customer_goal} />
                <div className="md:col-span-2"><Field label="Zusatzleistungen" value={(Array.isArray(lead.additional_services) ? lead.additional_services : []).join(', ') || null} /></div>
                <div className="md:col-span-2"><Field label="Produktinteresse" value={lead.requested_products} /></div>
                <div className="md:col-span-2"><Field label="Nachricht" value={lead.message || lead.notes} multiline /></div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kommunikation" className="mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              {lead.email ? (
                <>E-Mail-Korrespondenz mit <a className="underline" href={`mailto:${lead.email}`}>{lead.email}</a>. Verwende die ALIX i-COM Mail-Tools für eingehende Nachrichten.</>
              ) : 'Keine Kontaktdaten hinterlegt.'}
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="notizen" className="mt-4">
          <Card className="p-6 space-y-3">
            <Textarea defaultValue={lead.metadata?.internal_note ?? ''} onBlur={(e) => updateLead({ metadata: { ...(lead.metadata ?? {}), internal_note: e.target.value } })} placeholder="Interne Vertriebsnotizen …" rows={6} />
            <p className="text-xs text-muted-foreground">Wird beim Verlassen des Feldes gespeichert.</p>
          </Card>
        </TabsContent>

        <TabsContent value="angebote" className="mt-4">
          <Card className="p-6">
            {lead.converted_offer_id ? (
              <p>Verknüpftes Angebot: <code>{lead.converted_offer_id}</code></p>
            ) : (
              <p className="text-sm text-muted-foreground">Noch kein Angebot erstellt. „Angebot erstellen" öffnet den Editor mit übernommenen Daten.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="historie" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left"><tr><th className="p-3">Datum</th><th className="p-3">Aktion</th><th className="p-3">Notiz</th></tr></thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-muted-foreground">Keine Historieneinträge.</td></tr>
                ) : history.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-3 whitespace-nowrap">{new Date(h.created_at).toLocaleString('de-DE')}</td>
                    <td className="p-3">{h.action}</td>
                    <td className="p-3">{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      {followups.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Nachfass-Aufgaben</h3>
          <ul className="space-y-2 text-sm">
            {followups.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
                <div>
                  <span className="font-medium">{f.type}:</span> {f.title}
                  {f.due_at && <span className="text-muted-foreground ml-2">→ {new Date(f.due_at).toLocaleString('de-DE')}</span>}
                </div>
                <Badge variant={f.status === 'erledigt' ? 'secondary' : 'outline'}>{f.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={multiline ? 'whitespace-pre-wrap' : ''}>{value || '—'}</div>
    </div>
  );
}

function EditField({ label, v, on }: { label: string; v: any; on: (val: string) => void }) {
  return (
    <div>
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Input value={v ?? ''} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
