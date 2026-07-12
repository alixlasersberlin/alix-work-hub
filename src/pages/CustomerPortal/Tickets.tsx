import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare, Loader2, Send, Paperclip, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { PortalTicketDetail } from '@/components/CustomerPortal/PortalTicketDetail';
import { validateTicketAttachment, TICKET_ATTACHMENT_ACCEPT } from '@/lib/ticketAttachments';

type Ctx = { customerId: string };

type Anliegen = {
  key: string;
  label: string;
  hint: string;
  category: string;
  department: string;
  priority: string;
};

// Feste Anliegen-Liste laut Kommunikationsarchitektur (Phase 1)
const ANLIEGEN: Anliegen[] = [
  { key: 'reparatur',     label: 'Reparatur anfragen',            hint: 'Gerät ist defekt oder eingeschränkt nutzbar',      category: 'Reparatur',   department: 'Service',   priority: 'Hoch' },
  { key: 'wartung',       label: 'Wartung buchen',                hint: 'Regelmäßige oder anstehende Wartung',              category: 'Wartung',     department: 'Service',   priority: 'Normal' },
  { key: 'ersatzteil',    label: 'Ersatzteil bestellen',          hint: 'Verbrauchsmaterial, Zubehör oder Ersatzteile',     category: 'Ersatzteil',  department: 'Service',   priority: 'Normal' },
  { key: 'anwendung',     label: 'Anwendungshilfe / Nutzungsfrage', hint: 'Frage zur Bedienung, Behandlung oder Parameter',category: 'Support',     department: 'Anwendung', priority: 'Normal' },
  { key: 'schulung',      label: 'Schulung / Einweisung',         hint: 'Neue Mitarbeiter schulen, Auffrischung',           category: 'Schulung',    department: 'Vertrieb',  priority: 'Niedrig' },
  { key: 'termin',        label: 'Termin vereinbaren',            hint: 'Vor-Ort-Termin, Video- oder Telefontermin',        category: 'Termin',      department: 'Service',   priority: 'Normal' },
  { key: 'reklamation',   label: 'Reklamation',                   hint: 'Beanstandung zu Gerät, Behandlung oder Ablauf',    category: 'Reklamation', department: 'QM',        priority: 'Hoch' },
  { key: 'software',      label: 'Software / Update-Problem',     hint: 'Fehlermeldung, Update, Verbindung',                category: 'Support',     department: 'Technik',   priority: 'Hoch' },
  { key: 'kaufmaennisch', label: 'Angebot / kaufmännische Frage', hint: 'Angebot, Rechnung, Vertrag, Finanzierung',         category: 'Vertrieb',    department: 'Vertrieb',  priority: 'Normal' },
  { key: 'sonstiges',     label: 'Sonstiges',                     hint: 'Ich weiß nicht genau, wohin es gehört',            category: 'Sonstiges',   department: 'Service',   priority: 'Normal' },
];

export default function CustomerPortalTickets() {
  const ctx = useOutletContext<Ctx>();
  const [own, setOwn] = useState<any[]>([]);
  const [external, setExternal] = useState<any[]>([]);
  const [cust, setCust] = useState<{ email: string | null; contact_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('reparatur');
  const [subject, setSubject] = useState('');
  const [desiredResponse, setDesiredResponse] = useState('');
  const [desiredAppointment, setDesiredAppointment] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});

  const anl = ANLIEGEN.find(a => a.key === selected) ?? ANLIEGEN[0];

  const computeUnread = async (ticketIds: string[]) => {
    if (!ticketIds.length) return setUnread({});
    const { data: reads } = await supabase
      .from('portal_ticket_reads')
      .select('ticket_id, last_viewed_at')
      .in('ticket_id', ticketIds);
    const readMap = new Map<string, string>((reads ?? []).map((r: any) => [r.ticket_id, r.last_viewed_at]));
    const { data: msgs } = await supabase
      .from('ticket_messages')
      .select('ticket_id, created_at, sender_type')
      .in('ticket_id', ticketIds)
      .eq('is_internal', false)
      .neq('sender_type', 'customer')
      .order('created_at', { ascending: false });
    const counts: Record<string, number> = {};
    (msgs ?? []).forEach((m: any) => {
      const seen = readMap.get(m.ticket_id);
      if (!seen || new Date(m.created_at) > new Date(seen)) {
        counts[m.ticket_id] = (counts[m.ticket_id] ?? 0) + 1;
      }
    });
    setUnread(counts);
  };

  const load = async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from('customer_portal_tickets')
        .select('id, subject, category, status, priority, created_at, closed_at')
        .eq('customer_id', ctx.customerId)
        .order('created_at', { ascending: false }),
      supabase.from('tickets')
        .select('id, title, subject, status, priority, comm_status, created_at, device_name, serial_number, ticket_number, category')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('customers')
        .select('email, contact_name')
        .eq('id', ctx.customerId).maybeSingle(),
    ]);
    setOwn(a.data ?? []);
    setExternal(b.data ?? []);
    setCust(c.data ?? null);
    setLoading(false);
    await computeUnread((b.data ?? []).map((t: any) => t.id));
  };

  useEffect(() => {
    load();
    // Realtime: neue Team-Nachrichten aktualisieren die Ungelesen-Zähler
    const ch = supabase
      .channel(`portal-tickets-${ctx.customerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, () => {
        setExternal((prev) => {
          computeUnread(prev.map((t: any) => t.id));
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.customerId]);

  const addFiles = (fs: FileList | null) => {
    if (!fs) return;
    const list = Array.from(fs).slice(0, 10 - files.length);
    for (const f of list) {
      const v = validateTicketAttachment(f);
      if (v.ok === false) { toast.error(v.reason); return; }
    }
    setFiles(prev => [...prev, ...list].slice(0, 10));
  };
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const uploadAttachments = async (): Promise<{ file_url: string; file_name: string; file_type: string; file_size: number }[]> => {
    if (!files.length) return [];
    const stamp = Date.now();
    const out: { file_url: string; file_name: string; file_type: string; file_size: number }[] = [];
    for (const f of files) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const path = `portal/${ctx.customerId}/${stamp}-${safe}`;
      const { error } = await supabase.storage.from('ticket-attachments').upload(path, f, { upsert: false });
      if (error) throw error;
      const { data } = await supabase.storage.from('ticket-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      out.push({ file_url: data?.signedUrl ?? path, file_name: f.name, file_type: f.type || 'application/octet-stream', file_size: f.size });
    }
    return out;
  };

  const create = async () => {
    if (!subject.trim()) return toast.error('Bitte einen kurzen Betreff angeben');
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cust } = await supabase.from('customers')
        .select('email, contact_name, company_name, phone')
        .eq('id', ctx.customerId).maybeSingle();

      let attachments: any[] = [];
      try { attachments = await uploadAttachments(); }
      catch (e: any) { toast.error('Datei-Upload fehlgeschlagen: ' + e.message); setSending(false); return; }

      const fullMessage = [
        `Anliegen: ${anl.label}`,
        subject.trim() ? `Betreff: ${subject.trim()}` : '',
        body ? `\n${body}` : '',
        desiredResponse ? `\nGewünschte Rückmeldung: ${desiredResponse}` : '',
        desiredAppointment ? `Gewünschter Termin: ${new Date(desiredAppointment).toLocaleString('de-DE')}` : '',
      ].filter(Boolean).join('\n');

      const { error: fnErr } = await supabase.functions.invoke('public-book-ticket', {
        body: {
          firstName: (cust?.contact_name ?? '').split(' ')[0] || 'Kunde',
          lastName: (cust?.contact_name ?? '').split(' ').slice(1).join(' '),
          email: cust?.email ?? '',
          phone: cust?.phone ?? '',
          company: cust?.company_name ?? '',
          service: anl.category,
          department: anl.department,
          priority: anl.priority,
          message: fullMessage,
          attachments,
          bookingNumber: null,
        },
      });

      await supabase.from('customer_portal_tickets').insert({
        customer_id: ctx.customerId,
        subject: subject.trim(),
        category: anl.category,
        status: 'offen',
        priority: anl.priority.toLowerCase(),
        created_by: user?.id ?? null,
      });

      if (fnErr) throw fnErr;
      toast.success('Ticket erstellt — die zuständige Abteilung wurde benachrichtigt.');
      setSubject(''); setBody(''); setDesiredResponse(''); setDesiredAppointment(''); setFiles([]); setSelected('reparatur');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler beim Absenden');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Neue Anfrage stellen</CardTitle>
          <p className="text-sm text-muted-foreground">Wählen Sie Ihr Anliegen — wir leiten es automatisch an die richtige Abteilung weiter.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Ihr Anliegen</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ANLIEGEN.map(a => {
                const active = a.key === selected;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setSelected(a.key)}
                    className={`text-left rounded-lg border p-3 transition ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'border-border hover:bg-muted/40'}`}
                  >
                    <div className="font-medium text-sm">{a.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Kurzer Betreff</Label>
              <Input placeholder="z. B. Fehlermeldung E-42 nach Update" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Gewünschter Termin (optional)</Label>
              <Input type="datetime-local" value={desiredAppointment} onChange={e => setDesiredAppointment(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Beschreibung</Label>
            <Textarea placeholder="Bitte beschreiben Sie Ihr Anliegen so genau wie möglich." value={body} onChange={e => setBody(e.target.value)} rows={4} />
          </div>

          <div>
            <Label>Gewünschte Rückmeldung (optional)</Label>
            <Input placeholder="z. B. Anruf am Vormittag, E-Mail-Antwort" value={desiredResponse} onChange={e => setDesiredResponse(e.target.value)} />
          </div>

          <div>
            <Label>Anhänge (max. 10 Dateien, je 20 MB)</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md cursor-pointer hover:bg-muted/40 text-sm">
                <Paperclip className="w-4 h-4" />
                Dateien auswählen
                <input type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
              </label>
              {files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                  {f.name} <button type="button" onClick={() => removeFile(i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="text-xs text-muted-foreground">
              Ihre Anfrage wird als <b>{anl.label}</b> mit Priorität <b>{anl.priority}</b> an die Abteilung <b>{anl.department}</b> weitergeleitet.
            </div>
            <Button onClick={create} disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Anfrage absenden
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Meine Anfragen</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (own.length === 0 && external.length === 0) ? (
            <p className="text-center py-6 text-muted-foreground">Keine Anfragen.</p>
          ) : (
            <div className="space-y-2">
              {own.map((t) => (
                <div key={`o-${t.id}`} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div>
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <Badge variant={t.status === 'offen' ? 'default' : 'outline'}>{t.status}</Badge>
                </div>
              ))}
              {external.map((t) => {
                const u = unread[t.id] ?? 0;
                return (
                  <button
                    key={`e-${t.id}`}
                    type="button"
                    onClick={() => setDetailId(t.id)}
                    className={`w-full flex items-center justify-between p-3 border rounded-md text-left transition ${u > 0 ? 'border-primary/40 bg-primary/5 hover:bg-primary/10' : 'border-border hover:bg-muted/40'}`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate ${u > 0 ? 'font-semibold' : 'font-medium'}`}>
                        {t.subject ?? t.title ?? t.ticket_number}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.category ?? ''} {t.device_name ? `· ${t.device_name}` : ''}{t.serial_number ? ` · ${t.serial_number}` : ''} · {new Date(t.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u > 0 && (
                        <Badge className="bg-primary text-primary-foreground">{u} neu</Badge>
                      )}
                      <Badge variant="outline">{t.status ?? '—'}</Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PortalTicketDetail
        ticketId={detailId}
        customerId={ctx.customerId}
        customerName={cust?.contact_name ?? null}
        customerEmail={cust?.email ?? null}
        onClose={() => { setDetailId(null); load(); }}
      />
    </div>
  );
}
