import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, UserRound, Building2, Phone, Mail, Hash, Paperclip, Upload,
  Bold, Italic, Underline as UnderlineIcon, List, Table as TableIcon, Link as LinkIcon,
  Image as ImageIcon, MousePointer, Eye, Beaker, Save, Send, Loader2, Package,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

const SENDERS: Record<string, { label: string; email: string }> = {
  finance: { label: 'Finance', email: 'finance@alixwork.de' },
  vertrieb: { label: 'Vertrieb', email: 'vertrieb@alixwork.de' },
  service: { label: 'Service', email: 'service@alixwork.de' },
  marketing: { label: 'Marketing', email: 'news@alixwork.de' },
};

type SenderKey = keyof typeof SENDERS;

const ACCEPTED_TYPES = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip';

type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  external_customer_id: string | null;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  order_status: string | null;
  raw_data: any;
};

type TemplateRow = {
  id: string;
  name: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  category: string | null;
  department: string | null;
};

function ToolbarButton({ icon: Icon, label }: { icon: typeof Bold; label: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" title={label} className="h-8 w-8 p-0" disabled>
      <Icon className="w-4 h-4" />
    </Button>
  );
}

function categoryToSender(cat?: string | null, dept?: string | null): SenderKey | null {
  const v = `${cat ?? ''} ${dept ?? ''}`.toLowerCase();
  if (/(finance|finanz|rechnung|mahnung)/.test(v)) return 'finance';
  if (/(market|news|newsletter)/.test(v)) return 'marketing';
  if (/(service|repair|reparatur|support|technik)/.test(v)) return 'service';
  if (/(order|sales|vertrieb|auftrag|angebot)/.test(v)) return 'vertrieb';
  return null;
}

function applyVars(input: string, vars: Record<string, string>): string {
  if (!input) return '';
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const k = String(key).toLowerCase();
    return vars[k] ?? `{{${key}}}`;
  });
}

export default function MailCenterCompose() {
  const [sender, setSender] = useState<SenderKey>('finance');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [showCustomerResults, setShowCustomerResults] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [order, setOrder] = useState<OrderRow | null>(null);

  // Templates
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const senderEmail = useMemo(() => SENDERS[sender]?.email ?? '', [sender]);

  // Load templates
  useEffect(() => {
    let alive = true;
    setTemplatesLoading(true);
    supabase
      .from('mail_templates')
      .select('id,name,subject,body_html,body_text,category,department')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        setTemplatesLoading(false);
        if (error) {
          toast.error('Vorlagen konnten nicht geladen werden');
          return;
        }
        setTemplates((data ?? []) as TemplateRow[]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Live customer search (debounced)
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = customerQuery.trim();
    if (q.length < 2) {
      setCustomerResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setCustomerLoading(true);
      const like = `%${q}%`;
      const { data, error } = await supabase
        .from('customers')
        .select('id,company_name,contact_name,email,phone,external_customer_id')
        .or(
          [
            `company_name.ilike.${like}`,
            `contact_name.ilike.${like}`,
            `email.ilike.${like}`,
            `phone.ilike.${like}`,
            `external_customer_id.ilike.${like}`,
          ].join(','),
        )
        .limit(20);
      setCustomerLoading(false);
      if (error) {
        toast.error('Kundensuche fehlgeschlagen');
        return;
      }
      setCustomerResults((data ?? []) as CustomerRow[]);
      setShowCustomerResults(true);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [customerQuery]);

  // Load orders for selected customer
  useEffect(() => {
    setOrders([]);
    setOrder(null);
    if (!customer) return;
    supabase
      .from('orders')
      .select('id,order_number,order_status,raw_data')
      .eq('customer_id', customer.id)
      .order('order_date', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) return;
        setOrders((data ?? []) as OrderRow[]);
      });
  }, [customer]);

  function selectCustomer(c: CustomerRow) {
    setCustomer(c);
    setCustomerQuery(c.company_name || c.contact_name || c.email || '');
    setShowCustomerResults(false);
  }

  function clearCustomer() {
    setCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
  }

  // Extract device/product label from order raw_data heuristically
  function extractGeraet(o: OrderRow | null): string {
    if (!o?.raw_data) return '';
    const r = o.raw_data;
    const items = r.line_items || r.items;
    if (Array.isArray(items) && items.length > 0) {
      return items.map((it: any) => it?.name || it?.item_name || it?.description).filter(Boolean).join(', ');
    }
    return '';
  }

  function buildVars(): Record<string, string> {
    return {
      kunde: customer?.contact_name || customer?.company_name || '',
      firma: customer?.company_name || '',
      kundennummer: customer?.external_customer_id || '',
      email: customer?.email || '',
      telefon: customer?.phone || '',
      auftragsnummer: order?.order_number || '',
      geraet: extractGeraet(order),
      betrag: '',
      bearbeiter: SENDERS[sender]?.label || '',
    };
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const vars = buildVars();
    setSubject(applyVars(t.subject || '', vars));
    setBodyHtml(applyVars(t.body_html || '', vars));
    setBody(applyVars(t.body_text || '', vars));
    const suggested = categoryToSender(t.category, t.department);
    if (suggested) setSender(suggested);
  }

  // Re-apply variables when customer/order changes and a template is active
  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const vars = buildVars();
    setSubject(applyVars(t.subject || '', vars));
    setBodyHtml(applyVars(t.body_html || '', vars));
    setBody(applyVars(t.body_text || '', vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id, order?.id]);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = '';
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        customer_id: customer?.id ?? null,
        order_id: order?.id ?? null,
        template_id: templateId || null,
        to_email: customer?.email ?? '',
        to_name: customer?.contact_name || customer?.company_name || null,
        from_email: senderEmail,
        from_name: SENDERS[sender]?.label || null,
        subject,
        body_html: bodyHtml,
        body_text: body,
        status: 'draft',
        created_by: userData.user?.id ?? null,
      };
      const { error } = await supabase.from('mail_messages').insert(payload);
      if (error) throw error;
      toast.success('Entwurf wurde gespeichert');
    } catch (e: any) {
      console.error(e);
      toast.error('Entwurf konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }

  function validateForSend(toEmailOverride?: string): string | null {
    const toMail = toEmailOverride ?? customer?.email ?? '';
    if (!toMail) return 'Empfänger-E-Mail fehlt';
    if (!senderEmail) return 'Absender-E-Mail fehlt';
    if (!subject.trim()) return 'Betreff fehlt';
    if (!body.trim() && !bodyHtml.trim()) return 'E-Mail-Inhalt fehlt';
    return null;
  }

  function buildSendPayload(opts?: { toEmail?: string; toName?: string | null; isTest?: boolean }) {
    const vars = buildVars();
    return {
      template_id: templateId || null,
      customer_id: customer?.id ?? null,
      order_id: order?.id ?? null,
      invoice_id: null,
      ticket_id: null,
      repair_id: null,
      to_email: opts?.toEmail ?? customer?.email ?? '',
      to_name: opts?.toName ?? (customer?.contact_name || customer?.company_name || null),
      from_email: senderEmail,
      from_name: SENDERS[sender]?.label || null,
      subject_variables: vars,
      body_variables: vars,
      subject,
      body_html: bodyHtml || body,
      body_text: body,
      is_test: !!opts?.isTest,
    };
  }

  async function sendMail() {
    const err = validateForSend();
    if (err) {
      toast.error(err);
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mail', {
        body: buildSendPayload(),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      toast.success('E-Mail wurde erfolgreich versendet');
      // optional reset of subject/body
      setSubject('');
      setBody('');
      setBodyHtml('');
      setTemplateId('');
    } catch (e: any) {
      console.error('send-mail failed', e);
      toast.error('E-Mail konnte nicht versendet werden');
    } finally {
      setSending(false);
    }
  }

  async function sendTestMail() {
    const { data: userData } = await supabase.auth.getUser();
    const myEmail = userData.user?.email;
    if (!myEmail) {
      toast.error('Keine Benutzer-E-Mail gefunden');
      return;
    }
    const err = validateForSend(myEmail);
    if (err) {
      toast.error(err);
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mail', {
        body: buildSendPayload({ toEmail: myEmail, toName: userData.user?.user_metadata?.full_name || null, isTest: true }),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
      toast.success(`Testmail wurde an ${myEmail} gesendet`);
    } catch (e: any) {
      console.error('test send-mail failed', e);
      toast.error('Testmail konnte nicht versendet werden');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Empfänger */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <UserRound className="w-4 h-4 text-primary" /> Empfänger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Kunde suchen… (Firma, Ansprechpartner, E-Mail, Telefon, Kundennr.)"
              className="pl-9"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                if (customer) setCustomer(null);
              }}
              onFocus={() => customerResults.length > 0 && setShowCustomerResults(true)}
            />
            {customerLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
            {showCustomerResults && customerQuery.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-72 overflow-auto">
                {customerResults.length === 0 && !customerLoading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Kein Kunde gefunden</div>
                ) : (
                  customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0"
                    >
                      <div className="font-medium">{c.company_name || c.contact_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.contact_name, c.email, c.external_customer_id].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Firma</Label>
              <Input value={customer?.company_name ?? ''} readOnly placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><UserRound className="w-3.5 h-3.5" /> Ansprechpartner</Label>
              <Input value={customer?.contact_name ?? ''} readOnly placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-Mail</Label>
              <Input value={customer?.email ?? ''} readOnly placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Telefon</Label>
              <Input value={customer?.phone ?? ''} readOnly placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Kundennummer</Label>
              <Input value={customer?.external_customer_id ?? ''} readOnly placeholder="—" />
            </div>
            {customer && (
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={clearCustomer}>Auswahl aufheben</Button>
              </div>
            )}
          </div>

          {customer && orders.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Auftrag (optional)</Label>
              <Select value={order?.id ?? ''} onValueChange={(v) => setOrder(orders.find((o) => o.id === v) ?? null)}>
                <SelectTrigger><SelectValue placeholder="Auftrag wählen…" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number || o.id.slice(0, 8)} {o.order_status ? `· ${o.order_status}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Absender + Vorlage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" /> Absender
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={sender} onValueChange={(v) => setSender(v as SenderKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SENDERS).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Absenderadresse: </span>
              <span className="font-mono text-foreground">{senderEmail}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-glow">
          <CardHeader>
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Beaker className="w-4 h-4 text-primary" /> Vorlage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Lade Vorlagen…
              </div>
            ) : templates.length === 0 ? (
              <div className="text-sm text-muted-foreground">Keine aktiven Vorlagen vorhanden</div>
            ) : (
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger><SelectValue placeholder="Vorlage wählen…" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Betreff */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display">Betreff</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Betreff der E-Mail…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-base"
          />
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display">E-Mail Inhalt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
            <ToolbarButton icon={Bold} label="Fett" />
            <ToolbarButton icon={Italic} label="Kursiv" />
            <ToolbarButton icon={UnderlineIcon} label="Unterstrichen" />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton icon={List} label="Listen" />
            <ToolbarButton icon={TableIcon} label="Tabelle" />
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarButton icon={LinkIcon} label="Link" />
            <ToolbarButton icon={ImageIcon} label="Bild" />
            <ToolbarButton icon={MousePointer} label="Button" />
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Inhalt der E-Mail…"
            className="min-h-[300px] font-mono text-sm"
          />
          {bodyHtml && (
            <p className="text-xs text-muted-foreground">
              HTML-Version aus Vorlage geladen ({bodyHtml.length} Zeichen) – wird mitgespeichert.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Anhänge */}
      <Card className="card-glow">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-primary" /> Anhänge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-sm text-foreground">Dateien auswählen oder hierher ziehen</span>
            <span className="text-xs text-muted-foreground">Erlaubt: PDF, DOCX, XLSX, PNG, JPG, ZIP</span>
            <input type="file" multiple accept={ACCEPTED_TYPES} onChange={onFiles} className="hidden" />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1 text-sm">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5">
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground ml-3">{(f.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Aktionen */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="w-4 h-4 mr-2" /> Vorschau
        </Button>
        <Button variant="outline" onClick={sendTestMail} disabled={testing || sending}>
          {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Beaker className="w-4 h-4 mr-2" />} Testmail
        </Button>
        <Button variant="outline" onClick={saveDraft} disabled={saving || sending}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Speichern
        </Button>
        <Button onClick={sendMail} disabled={sending || testing}>
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {sending ? 'E-Mail wird gesendet…' : 'Senden'}
        </Button>
      </div>

      {/* Vorschau Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vorschau</DialogTitle>
            <DialogDescription>So sieht die E-Mail aus – sie wird noch nicht gesendet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <span className="text-muted-foreground">Absender:</span>
              <span className="font-mono">{SENDERS[sender]?.label} &lt;{senderEmail}&gt;</span>
              <span className="text-muted-foreground">Empfänger:</span>
              <span className="font-mono">
                {customer?.contact_name || customer?.company_name || '—'} &lt;{customer?.email || '—'}&gt;
              </span>
              <span className="text-muted-foreground">Betreff:</span>
              <span className="font-medium">{subject || '—'}</span>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 max-h-[300px] overflow-auto">
              {bodyHtml ? (
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-sans">{body || '—'}</pre>
              )}
            </div>
            {files.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Anhänge:</div>
                <ul className="text-xs space-y-0.5">
                  {files.map((f, i) => <li key={i}>· {f.name}</li>)}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
