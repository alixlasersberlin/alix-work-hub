import { useEffect, useMemo, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Megaphone, Plus, Send, Eye, Trash2, AlertTriangle, RefreshCw, Users,
} from 'lucide-react';

const SENDERS = [
  { email: 'news@alixwork.de', name: 'Alix Newsletter' },
  { email: 'vertrieb@alixwork.de', name: 'Alix Vertrieb' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Alle Kunden' },
  { value: 'active', label: 'Aktive Kunden (mit Bestellung)' },
  { value: 'prospects', label: 'Interessenten (ohne Bestellung)' },
  { value: 'open_invoice', label: 'Offene Zahlungen' },
  { value: 'with_repair', label: 'Kunden mit Reparatur' },
  { value: 'by_country', label: 'Kunden nach Land' },
  { value: 'by_language', label: 'Kunden nach Sprache' },
];

const CATEGORIES = ['marketing', 'newsletter', 'kampagne', 'vertrieb', 'aktion'];

type Campaign = any;

const STATUS_COLORS: Record<string, string> = {
  'Entwurf': 'bg-muted text-muted-foreground',
  'Geplant': 'bg-blue-500/15 text-blue-500',
  'Wird gesendet': 'bg-amber-500/15 text-amber-500',
  'Gesendet': 'bg-emerald-500/15 text-emerald-500',
  'Pausiert': 'bg-orange-500/15 text-orange-500',
  'Fehler': 'bg-destructive/15 text-destructive',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_COLORS[status] ?? 'bg-muted'}>
      {status}
    </Badge>
  );
}

export default function MailCenterKampagnen() {
  const { toast } = useToast();
  const { hasRole, hasAnyRole, isAdmin } = useAuth();
  const canManage = isAdmin || hasAnyRole(['Marketing', 'Vertrieb']);
  const canDelete = hasRole('Super Admin');

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<{ rows: any[]; total: number } | null>(null);
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // form state
  const [form, setForm] = useState({
    name: '', subject: '', sender_email: SENDERS[0].email,
    sender_name: SENDERS[0].name, template_id: '', audience: 'all',
    audience_value: '', scheduled_at: '', language: 'de',
    category: 'newsletter', description: '',
  });

  const loadCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mail_campaigns')
      .select('*, mail_recipients(count)')
      .order('created_at', { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('mail_templates').select('id,name,subject,category,language')
      .eq('is_active', true).order('name');
    setTemplates(data ?? []);
  };

  useEffect(() => { loadCampaigns(); loadTemplates(); }, []);

  const buildAudienceQuery = async (audience: string, value: string) => {
    // returns list of customer records
    let q = supabase.from('customers').select('id,company_name,contact_name,email,phone,external_customer_id,raw_data').not('email','is',null).limit(5000);

    if (audience === 'by_country' && value) {
      // billing_address->>country
      q = q.filter('billing_address->>country', 'ilike', `%${value}%`);
    } else if (audience === 'by_language' && value) {
      q = q.filter('raw_data->>language_code', 'ilike', `%${value}%`);
    }
    const { data: customers } = await q;
    let rows = customers ?? [];

    if (audience === 'active' || audience === 'prospects' || audience === 'open_invoice') {
      const { data: orders } = await supabase.from('orders').select('customer_id,order_status').limit(20000);
      const idsWithOrders = new Set((orders ?? []).map((o: any) => o.customer_id));
      if (audience === 'active') {
        rows = rows.filter(r => idsWithOrders.has(r.id));
      } else if (audience === 'prospects') {
        rows = rows.filter(r => !idsWithOrders.has(r.id));
      } else if (audience === 'open_invoice') {
        const open = new Set((orders ?? []).filter((o: any) =>
          ['offen', 'pending', 'unpaid', 'unbezahlt'].includes(String(o.order_status ?? '').toLowerCase())
        ).map((o: any) => o.customer_id));
        rows = rows.filter(r => open.has(r.id));
      }
    } else if (audience === 'with_repair') {
      const { data: reps } = await supabase.from('repair_orders').select('customer_id').limit(20000);
      const ids = new Set((reps ?? []).map((r: any) => r.customer_id));
      rows = rows.filter(r => ids.has(r.id));
    }
    return rows.filter(r => r.email);
  };

  const previewRecipients = async () => {
    const rows = await buildAudienceQuery(form.audience, form.audience_value);
    const emails = rows.map(r => String(r.email).toLowerCase());
    const { data: unsubs } = emails.length
      ? await supabase.from('mail_unsubscribes').select('email').in('email', emails)
      : { data: [] as any[] };
    const unsubSet = new Set((unsubs ?? []).map((u: any) => String(u.email).toLowerCase()));
    const enriched = rows.map(r => ({
      ...r,
      unsubscribed: unsubSet.has(String(r.email).toLowerCase()),
    }));
    setRecipientPreview({ rows: enriched.slice(0, 200), total: enriched.length });
    return enriched;
  };

  const createCampaign = async () => {
    if (!form.name || !form.subject || !form.template_id) {
      toast({ title: 'Felder fehlen', description: 'Name, Betreff und Vorlage sind Pflicht.', variant: 'destructive' });
      return;
    }
    const enriched = await previewRecipients();
    const eligible = enriched.filter(r => !r.unsubscribed);

    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      name: form.name,
      subject: form.subject,
      sender_email: form.sender_email,
      sender_name: form.sender_name,
      template_id: form.template_id,
      status: form.scheduled_at ? 'Geplant' : 'Entwurf',
      scheduled_at: form.scheduled_at || null,
      language: form.language,
      category: form.category,
      description: form.description,
      target_filter: { audience: form.audience, value: form.audience_value },
      audience_label: AUDIENCE_OPTIONS.find(a => a.value === form.audience)?.label,
      recipient_count: eligible.length,
      created_by: user?.id,
    };
    const { data: campaign, error } = await supabase
      .from('mail_campaigns').insert(payload).select().single();
    if (error || !campaign) {
      toast({ title: 'Fehler', description: error?.message, variant: 'destructive' });
      return;
    }
    if (eligible.length) {
      const chunks: any[] = [];
      for (let i = 0; i < eligible.length; i += 500) {
        chunks.push(eligible.slice(i, i + 500).map(r => ({
          campaign_id: campaign.id,
          customer_id: r.id,
          email: r.email,
          name: r.contact_name ?? null,
          company: r.company_name ?? null,
          status: 'pending',
          created_by: user?.id,
        })));
      }
      for (const c of chunks) {
        await supabase.from('mail_recipients').insert(c);
      }
    }
    toast({ title: 'Kampagne angelegt', description: `${eligible.length} Empfänger` });
    setCreating(false);
    setRecipientPreview(null);
    setForm({
      name: '', subject: '', sender_email: SENDERS[0].email,
      sender_name: SENDERS[0].name, template_id: '', audience: 'all',
      audience_value: '', scheduled_at: '', language: 'de',
      category: 'newsletter', description: '',
    });
    loadCampaigns();
  };

  const sendCampaign = async (id: string) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-campaign', {
        body: { campaign_id: id },
      });
      if (error) throw error;
      toast({
        title: 'Kampagne versendet',
        description: `Gesendet: ${data?.sent ?? 0}, Übersprungen: ${data?.skipped ?? 0}, Fehler: ${data?.failed ?? 0}`,
      });
      setConfirmSendId(null);
      loadCampaigns();
    } catch (e: any) {
      toast({ title: 'Versandfehler', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Kampagne wirklich löschen?')) return;
    await supabase.from('mail_recipients').delete().eq('campaign_id', id);
    const { error } = await supabase.from('mail_campaigns').delete().eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Gelöscht' }); loadCampaigns(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Kampagnen</h2>
          <p className="text-sm text-muted-foreground">
            Newsletter, Aktionen und Marketing-Mails verwalten.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCampaigns}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
          </Button>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4 mr-2" /> Neue Kampagne
            </Button>
          )}
        </div>
      </div>

      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Kampagnenliste
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Lade…</p>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Megaphone className="w-10 h-10 opacity-40 mb-3" />
              <p className="text-sm">Noch keine Kampagnen angelegt.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead>Zielgruppe</TableHead>
                  <TableHead>Absender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Empfänger</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">
                      {c.subject}
                    </TableCell>
                    <TableCell className="text-xs">{c.audience_label ?? '—'}</TableCell>
                    <TableCell className="text-xs">{c.sender_email}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right">{c.recipient_count ?? 0}</TableCell>
                    <TableCell className="text-xs">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setDetailId(c.id)} title="Details">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canManage && (c.status === 'Entwurf' || c.status === 'Geplant' || c.status === 'Pausiert' || c.status === 'Fehler') && (
                          <Button size="icon" variant="ghost" onClick={() => setConfirmSendId(c.id)} title="Senden">
                            <Send className="w-4 h-4 text-primary" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="icon" variant="ghost" onClick={() => deleteCampaign(c.id)} title="Löschen">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* CREATE DIALOG */}
      <Dialog open={creating} onOpenChange={(o) => { setCreating(o); if (!o) setRecipientPreview(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Kampagne</DialogTitle>
            <DialogDescription>
              Newsletter oder Aktion erstellen. Abgemeldete Empfänger werden ausgeschlossen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Kampagnenname *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Betreff *</Label>
              <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Absender</Label>
              <Select
                value={form.sender_email}
                onValueChange={(v) => {
                  const s = SENDERS.find(x => x.email === v)!;
                  setForm({ ...form, sender_email: v, sender_name: s.name });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SENDERS.map(s => <SelectItem key={s.email} value={s.email}>{s.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vorlage *</Label>
              <Select value={form.template_id} onValueChange={v => setForm({ ...form, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Vorlage wählen" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Zielgruppe</Label>
              <Select value={form.audience} onValueChange={v => setForm({ ...form, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.audience === 'by_country' || form.audience === 'by_language') && (
              <div className="space-y-2">
                <Label>{form.audience === 'by_country' ? 'Land' : 'Sprache (z.B. de)'}</Label>
                <Input value={form.audience_value} onChange={e => setForm({ ...form, audience_value: e.target.value })} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Sprache</Label>
              <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Versandzeitpunkt (optional)</Label>
              <Input type="datetime-local" value={form.scheduled_at}
                onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Beschreibung (intern)</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2"><Users className="w-4 h-4" /> Empfängervorschau</Label>
              <Button size="sm" variant="outline" onClick={previewRecipients}>Vorschau laden</Button>
            </div>
            {recipientPreview && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {recipientPreview.total} Empfänger gefunden.
                  Abgemeldete: {recipientPreview.rows.filter(r => r.unsubscribed).length} (werden ausgeschlossen)
                </p>
                <div className="max-h-48 overflow-y-auto border border-border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Firma</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead>Abgemeldet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipientPreview.rows.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{r.company_name}</TableCell>
                          <TableCell className="text-xs">{r.contact_name}</TableCell>
                          <TableCell className="text-xs">{r.email}</TableCell>
                          <TableCell>
                            {r.unsubscribed
                              ? <Badge variant="outline" className="bg-destructive/15 text-destructive">Ja</Badge>
                              : <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500">Nein</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Abbrechen</Button>
            <Button onClick={createCampaign}>Kampagne anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEND CONFIRM */}
      <Dialog open={!!confirmSendId} onOpenChange={(o) => !o && setConfirmSendId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Kampagne versenden
            </DialogTitle>
            <DialogDescription>
              Diese Kampagne wird an{' '}
              <strong>{campaigns.find(c => c.id === confirmSendId)?.recipient_count ?? 0}</strong>{' '}
              Empfänger gesendet. Abgemeldete Empfänger werden automatisch ausgeschlossen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendId(null)} disabled={sending}>
              Abbrechen
            </Button>
            <Button onClick={() => confirmSendId && sendCampaign(confirmSendId)} disabled={sending}>
              {sending ? 'Sende…' : 'Kampagne endgültig senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAIL */}
      {detailId && (
        <CampaignDetail
          campaignId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

function CampaignDetail({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from('mail_campaigns').select('*').eq('id', campaignId).single();
      setCampaign(c);
      if (c?.template_id) {
        const { data: t } = await supabase.from('mail_templates').select('*').eq('id', c.template_id).single();
        setTemplate(t);
      }
      const { data: r } = await supabase.from('mail_recipients').select('*').eq('campaign_id', campaignId).order('created_at');
      setRecipients(r ?? []);
    })();
  }, [campaignId]);

  const stats = useMemo(() => {
    const total = recipients.length;
    const sent = recipients.filter(r => r.sent_at).length;
    const delivered = recipients.filter(r => r.delivered_at).length;
    const opened = recipients.filter(r => r.opened_at).length;
    const clicked = recipients.filter(r => r.clicked_at).length;
    const bounced = recipients.filter(r => r.bounced_at).length;
    const unsubscribed = recipients.filter(r => r.unsubscribed_at || r.status === 'skipped_unsubscribed').length;
    const failed = recipients.filter(r => r.status === 'failed').length;
    return { total, sent, delivered, opened, clicked, bounced, unsubscribed, failed };
  }, [recipients]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign?.name ?? 'Kampagne'}</DialogTitle>
          <DialogDescription>{campaign?.subject}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="recipients">Empfänger</TabsTrigger>
            <TabsTrigger value="content">E-Mail Inhalt</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
            <TabsTrigger value="errors">Fehler</TabsTrigger>
            <TabsTrigger value="unsubs">Abmeldungen</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-2 text-sm">
            <div><b>Status:</b> <StatusBadge status={campaign?.status ?? '—'} /></div>
            <div><b>Absender:</b> {campaign?.sender_name} &lt;{campaign?.sender_email}&gt;</div>
            <div><b>Zielgruppe:</b> {campaign?.audience_label}</div>
            <div><b>Kategorie:</b> {campaign?.category} • <b>Sprache:</b> {campaign?.language}</div>
            <div><b>Geplant:</b> {campaign?.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('de-DE') : '—'}</div>
            <div><b>Gesendet am:</b> {campaign?.sent_at ? new Date(campaign.sent_at).toLocaleString('de-DE') : '—'}</div>
            <div><b>Beschreibung:</b> {campaign?.description || '—'}</div>
          </TabsContent>

          <TabsContent value="recipients">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gesendet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.company}</TableCell>
                      <TableCell className="text-xs">{r.name}</TableCell>
                      <TableCell className="text-xs">{r.email}</TableCell>
                      <TableCell className="text-xs">{r.status}</TableCell>
                      <TableCell className="text-xs">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString('de-DE') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="content">
            <div className="space-y-2">
              <p className="text-sm"><b>Betreff:</b> {campaign?.subject}</p>
              <div className="border border-border rounded p-3 max-h-96 overflow-y-auto bg-background"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(template?.body_html ?? '<em>Keine Vorlage</em>') }} />
            </div>
          </TabsContent>

          <TabsContent value="tracking">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Versendet', stats.sent], ['Zugestellt', stats.delivered],
                ['Geöffnet', stats.opened], ['Geklickt', stats.clicked],
                ['Bounces', stats.bounced], ['Abmeldungen', stats.unsubscribed],
                ['Fehler', stats.failed], ['Gesamt', stats.total],
              ].map(([label, val]) => (
                <Card key={label as string}>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{val as number}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="errors">
            <Table>
              <TableHeader><TableRow><TableHead>E-Mail</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {recipients.filter(r => r.status === 'failed' || r.bounced_at).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell className="text-xs">{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="unsubs">
            <Table>
              <TableHeader><TableRow><TableHead>E-Mail</TableHead><TableHead>Datum</TableHead></TableRow></TableHeader>
              <TableBody>
                {recipients.filter(r => r.unsubscribed_at || r.status === 'skipped_unsubscribed').map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell className="text-xs">
                      {r.unsubscribed_at ? new Date(r.unsubscribed_at).toLocaleString('de-DE') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
