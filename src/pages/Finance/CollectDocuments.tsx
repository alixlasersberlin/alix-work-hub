import { useEffect, useMemo, useState } from 'react';
import {
  Banknote, FileSignature, FileText, Landmark, Link2, MessageSquare, Send,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

const fmt = (n: any, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(Number(n ?? 0));
const dt = (v: any) => (v ? new Date(v).toLocaleString('de-DE') : '—');

const DOC_TYPES = [
  { value: 'mahnschreiben', label: 'Mahnschreiben' },
  { value: 'letzte_mahnung', label: 'Letzte Mahnung' },
  { value: 'anwaltsschreiben', label: 'Anwaltsschreiben' },
  { value: 'ratenvereinbarung', label: 'Ratenvereinbarung' },
  { value: 'saldenbestaetigung', label: 'Saldenbestätigung' },
];

export default function FinanceCollectDocuments() {
  const [cases, setCases] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [caseId, setCaseId] = useState('');
  const [docType, setDocType] = useState('mahnschreiben');
  const [deadline, setDeadline] = useState('10');
  const [note, setNote] = useState('');
  const [sendMail, setSendMail] = useState(true);
  const [busy, setBusy] = useState(false);

  const [smsChannel, setSmsChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [smsText, setSmsText] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);

  const [linkDays, setLinkDays] = useState('30');
  const [linkInstallments, setLinkInstallments] = useState(true);
  const [linkSend, setLinkSend] = useState(true);
  const [linkBusy, setLinkBusy] = useState(false);

  const [matchBusy, setMatchBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, d, l] = await Promise.all([
      supabase.from('collect_cases' as any)
        .select('id,customer_name,customer_email,customer_phone,open_amount,overdue_amount,max_days_overdue,currency')
        .neq('status', 'closed')
        .order('overdue_amount', { ascending: false }).limit(500),
      supabase.from('collect_documents' as any).select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('collect_payment_links' as any).select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (c.error) toast({ title: 'Laden fehlgeschlagen', description: c.error.message, variant: 'destructive' });
    setCases((c.data as any) ?? []);
    setDocs((d.data as any) ?? []);
    setLinks((l.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selected = useMemo(() => cases.find((c) => c.id === caseId) ?? null, [cases, caseId]);

  const generate = async () => {
    if (!caseId) { toast({ title: 'Bitte Fall wählen', variant: 'destructive' }); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('collect-document-generate', {
      body: { case_id: caseId, doc_type: docType, deadline_days: Number(deadline) || 10, note, send: sendMail },
    });
    setBusy(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    const url = (data as any)?.url;
    if (url) window.open(url, '_blank');
    toast({
      title: (data as any)?.sent ? 'Schreiben erstellt & versendet' : 'Schreiben erstellt',
      description: (data as any)?.total ? `Gesamtbetrag ${(data as any).total}` : undefined,
    });
    setNote('');
    load();
  };

  const openDoc = async (row: any) => {
    if (!row.file_path) { toast({ title: 'Keine Datei hinterlegt', variant: 'destructive' }); return; }
    const { data, error } = await supabase.storage.from('finance-documents').createSignedUrl(row.file_path, 3600);
    if (error || !data?.signedUrl) { toast({ title: 'Datei nicht verfügbar', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  };

  const sendSms = async () => {
    if (!caseId) { toast({ title: 'Bitte Fall wählen', variant: 'destructive' }); return; }
    setSmsBusy(true);
    const { data, error } = await supabase.functions.invoke('collect-send-sms', {
      body: { case_id: caseId, channel: smsChannel, message: smsText || undefined },
    });
    setSmsBusy(false);
    if (error) { toast({ title: 'Versand fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${smsChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} versendet`, description: (data as any)?.to });
    setSmsText('');
  };

  const createLink = async () => {
    if (!caseId) { toast({ title: 'Bitte Fall wählen', variant: 'destructive' }); return; }
    setLinkBusy(true);
    const { data, error } = await supabase.functions.invoke('collect-payment-link', {
      body: {
        case_id: caseId, valid_days: Number(linkDays) || 30,
        allow_installments: linkInstallments, send: linkSend,
      },
    });
    setLinkBusy(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    const url = (data as any)?.url;
    if (url) await navigator.clipboard.writeText(url).catch(() => undefined);
    toast({
      title: (data as any)?.sent ? 'Zahl-Link erstellt & versendet' : 'Zahl-Link erstellt',
      description: url ? `${url} (in Zwischenablage)` : undefined,
    });
    load();
  };

  const runBankMatch = async () => {
    setMatchBusy(true);
    const { data, error } = await supabase.functions.invoke('collect-bank-match', { body: { days: 120 } });
    setMatchBusy(false);
    if (error) { toast({ title: 'Abgleich fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    const r = data as any;
    toast({
      title: 'Bankabgleich abgeschlossen',
      description: `${r?.matched ?? 0} Zahlungen zugeordnet · ${r?.closed ?? 0} Fälle geschlossen · ${r?.unmatched ?? 0} offen`,
    });
    load();
  };

  const caseSelect = (
    <Select value={caseId} onValueChange={setCaseId}>
      <SelectTrigger className="w-80"><SelectValue placeholder="Fall wählen…" /></SelectTrigger>
      <SelectContent>
        {cases.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.customer_name} · {fmt(c.overdue_amount, c.currency)} überfällig
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schriftverkehr, Zahl-Links & Bankabgleich"
        subtitle="Mahnschreiben und Vereinbarungen erzeugen, per E-Mail, SMS oder WhatsApp eskalieren und Zahlungseingänge automatisch zuordnen"
        icon={FileSignature}
        actions={(
          <Button variant="outline" onClick={runBankMatch} disabled={matchBusy}>
            <Landmark className="mr-2 h-4 w-4" />{matchBusy ? 'Gleicht ab…' : 'Bankabgleich starten'}
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <DataCard title="Erzeugte Schreiben"><div className="text-2xl font-semibold">{docs.length}</div></DataCard>
        <DataCard title="Versendet"><div className="text-2xl font-semibold">{docs.filter((d) => d.sent_at).length}</div></DataCard>
        <DataCard title="Aktive Zahl-Links"><div className="text-2xl font-semibold">{links.filter((l) => ['open', 'sent'].includes(l.status)).length}</div></DataCard>
        <DataCard title="Kundenreaktionen"><div className="text-2xl font-semibold text-emerald-500">{links.filter((l) => l.responded_at).length}</div></DataCard>
      </div>

      <DataCard title="Vorgang wählen">
        <div className="flex flex-wrap items-center gap-3">
          {caseSelect}
          {selected && (
            <div className="text-sm text-muted-foreground">
              Offen <b className="text-foreground">{fmt(selected.open_amount, selected.currency)}</b> ·
              Verzug {selected.max_days_overdue ?? 0} Tage ·
              {selected.customer_email ? ` ${selected.customer_email}` : ' keine E-Mail'} ·
              {selected.customer_phone ? ` ${selected.customer_phone}` : ' keine Telefonnr.'}
            </div>
          )}
        </div>
      </DataCard>

      <Tabs defaultValue="brief">
        <TabsList>
          <TabsTrigger value="brief">Schriftverkehr</TabsTrigger>
          <TabsTrigger value="mobil">SMS / WhatsApp</TabsTrigger>
          <TabsTrigger value="link">Zahl-Link</TabsTrigger>
        </TabsList>

        <TabsContent value="brief" className="mt-4 space-y-4">
          <DataCard title="Dokument erzeugen">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Frist (Tage)</span>
                <Input className="w-20" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={sendMail} onCheckedChange={setSendMail} />
                <span className="text-sm">Direkt per E-Mail senden</span>
              </div>
            </div>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Individueller Zusatztext (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button className="mt-3" onClick={generate} disabled={busy}>
              <FileText className="mr-2 h-4 w-4" />{busy ? 'Erzeuge…' : sendMail ? 'Erzeugen & senden' : 'PDF erzeugen'}
            </Button>
          </DataCard>

          <DataCard title="Dokumentenarchiv">
            {loading ? <SkeletonTable rows={5} /> : docs.length === 0 ? (
              <EmptyState icon={FileText} title="Noch keine Schreiben" description="Erzeuge oben ein Mahnschreiben oder eine Vereinbarung." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3">Kunde</th>
                      <th className="py-2 pr-3">Typ</th>
                      <th className="py-2 pr-3">Betrag</th>
                      <th className="py-2 pr-3">Erstellt</th>
                      <th className="py-2 pr-3">Versand</th>
                      <th className="py-2 pr-3">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-medium">{d.customer_name ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type}</Badge>
                        </td>
                        <td className="py-2 pr-3">{fmt(d.amount, d.currency)}</td>
                        <td className="py-2 pr-3">{dt(d.created_at)}</td>
                        <td className="py-2 pr-3">
                          {d.sent_at
                            ? <span className="text-emerald-500">{dt(d.sent_at)}<div className="text-xs text-muted-foreground">{d.sent_to}</div></span>
                            : <span className="text-muted-foreground">nicht versendet</span>}
                        </td>
                        <td className="py-2 pr-3">
                          <Button size="sm" variant="outline" onClick={() => openDoc(d)}>PDF öffnen</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>

        <TabsContent value="mobil" className="mt-4">
          <DataCard title="Mobile Eskalation">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={smsChannel} onValueChange={(v) => setSmsChannel(v as any)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={sendSms} disabled={smsBusy}>
                <MessageSquare className="mr-2 h-4 w-4" />{smsBusy ? 'Sendet…' : 'Nachricht senden'}
              </Button>
            </div>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Leer lassen für den Standardtext (offener Betrag & Verzug)"
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Der Versand erfolgt über Twilio an die im Fall hinterlegte Telefonnummer und wird in der Fallhistorie protokolliert.
            </p>
          </DataCard>
        </TabsContent>

        <TabsContent value="link" className="mt-4 space-y-4">
          <DataCard title="Zahl-Link erstellen">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Gültig (Tage)</span>
                <Input className="w-20" value={linkDays} onChange={(e) => setLinkDays(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={linkInstallments} onCheckedChange={setLinkInstallments} />
                <span className="text-sm">Ratenzahlungsantrag erlauben</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={linkSend} onCheckedChange={setLinkSend} />
                <span className="text-sm">Per E-Mail senden</span>
              </div>
              <Button onClick={createLink} disabled={linkBusy}>
                <Link2 className="mr-2 h-4 w-4" />{linkBusy ? 'Erstelle…' : 'Link erstellen'}
              </Button>
            </div>
          </DataCard>

          <DataCard title="Zahl-Links">
            {loading ? <SkeletonTable rows={5} /> : links.length === 0 ? (
              <EmptyState icon={Banknote} title="Keine Zahl-Links" description="Erstelle einen Selbstbedienungs-Link für den Kunden." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3">Kunde</th>
                      <th className="py-2 pr-3">Betrag</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Geöffnet</th>
                      <th className="py-2 pr-3">Kundenreaktion</th>
                      <th className="py-2 pr-3">Gültig bis</th>
                      <th className="py-2 pr-3">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((l) => (
                      <tr key={l.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-medium">{l.customer_name ?? '—'}</td>
                        <td className="py-2 pr-3">{fmt(l.amount, l.currency)}</td>
                        <td className="py-2 pr-3"><Badge variant="outline">{l.status}</Badge></td>
                        <td className="py-2 pr-3">{l.opened_at ? dt(l.opened_at) : '—'}</td>
                        <td className="py-2 pr-3">{l.customer_response ?? '—'}</td>
                        <td className="py-2 pr-3">{l.expires_at ? new Date(l.expires_at).toLocaleDateString('de-DE') : '—'}</td>
                        <td className="py-2 pr-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const url = `${window.location.origin}/zahlung/${l.token}`;
                              navigator.clipboard.writeText(url);
                              toast({ title: 'Link kopiert', description: url });
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
