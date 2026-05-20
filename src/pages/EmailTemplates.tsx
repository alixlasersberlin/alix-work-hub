import { useEffect, useMemo, useState } from 'react';
import { Mail, Loader2, Save, Send, UserRound, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sendCustomerShippingNotice } from '@/lib/send-customer-shipping-notice';
import { toast } from 'sonner';

interface OrderSearchResult {
  id: string;
  order_number: string | null;
  internal_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
}


interface TemplateRow {
  id: string;
  template_key: string;
  display_name: string;
  subject: string;
  body: string;
  placeholders: string[];
  updated_at: string;
}

// Mapping Vorlage → zugeordneter Geräte-/Auftragsstatus
const STATUS_BY_KEY: Record<string, string> = {
  customer_warehouse_received: 'Lagereingang',
  customer_warehouse_prepared: 'Shell Warehouse',
  customer_in_production: 'Produktion',
  customer_in_transit: 'Unterwegs',
  customer_shipping_notice: 'Teillieferung',
};

// Vorlagen, die per Bulk-Versand erneut an Kunden gesendet werden können.
// Mapping Vorlage → erforderlicher Status im lager_devices.notes ("[Status: ...]")
const BULK_DEVICE_STATUS_BY_KEY: Record<string, string> = {
  customer_warehouse_received: 'Lagereingang',
  customer_warehouse_prepared: 'Shell Warehouse',
  customer_in_production: 'Produktion',
  customer_in_transit: 'Transfer',
};

export default function EmailTemplates() {
  const { roles } = useAuth();
  const canEdit = roles.some(r => ['Admin', 'Super Admin'].includes(r));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('display_name');
    if (error) toast.error('Fehler beim Laden: ' + error.message);
    setTemplates((data as TemplateRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: 'subject' | 'body', value: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const save = async (t: TemplateRow) => {
    setSaving(t.id);
    const { error } = await supabase
      .from('email_templates')
      .update({ subject: t.subject, body: t.body })
      .eq('id', t.id);
    setSaving(null);
    if (error) toast.error('Speichern fehlgeschlagen: ' + error.message);
    else toast.success('Vorlage gespeichert');
  };

  const bulkResend = async (t: TemplateRow) => {
    const deviceStatus = BULK_DEVICE_STATUS_BY_KEY[t.template_key];
    if (!deviceStatus) return;
    setBulkSending(t.id);
    try {
      // 'Lagereingang' = Default-Status 'Bestand' (kein expliziter [Status:]-Tag oder explizit Bestand)
      const isLagereingang = deviceStatus === 'Lagereingang';
      let query = supabase
        .from('lager_devices')
        .select('id, reserved_order_id, notes')
        .not('reserved_order_id', 'is', null);
      if (!isLagereingang) {
        query = query.like('notes', `%[Status: ${deviceStatus}]%`);
      }
      const { data: devices, error } = await query;
      if (error) throw error;
      let list = (devices || []).filter((d) => d.reserved_order_id);
      if (isLagereingang) {
        // Nur Geräte ohne anderen Status (Default = Bestand)
        list = list.filter((d) => {
          const m = /\[Status:\s*([^\]]+)\]/.exec(d.notes ?? '');
          const s = m?.[1]?.trim();
          return !s || s === 'Bestand';
        });
      }
      if (list.length === 0) {
        toast.info('Keine passenden Geräte gefunden.');
        return;
      }

      let ok = 0, fail = 0;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const isRateLimited = (msg?: string) => !!msg && /429|rate.?limit|high demand/i.test(msg);

      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        let res = await sendCustomerShippingNotice(
          d.reserved_order_id as string,
          d.id,
          'manuell',
          t.template_key as any,
        );
        // Retry mit Backoff bei Rate-Limit (bis zu 3x)
        let attempt = 0;
        while (!res.ok && isRateLimited(res.message) && attempt < 3) {
          attempt++;
          await sleep(2000 * attempt);
          res = await sendCustomerShippingNotice(
            d.reserved_order_id as string,
            d.id,
            'manuell',
            t.template_key as any,
          );
        }
        if (res.ok) ok++; else { fail++; console.warn('Bulk-Versand Fehler', d, res.message); }
        // Drossel zwischen Sends, um 429 zu vermeiden (~1.2s zwischen Calls)
        if (i < list.length - 1) await sleep(1200);
      }
      toast.success(`Versendet: ${ok} · Fehler: ${fail}`);
    } catch (e: any) {
      toast.error('Bulk-Versand fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setBulkSending(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">E-Mail Vorlagen</h1>
          <p className="text-muted-foreground text-sm">Inhalte der automatisch versendeten E-Mails bearbeiten.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Keine Vorlagen vorhanden.</CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {templates.map(t => {
            const status = STATUS_BY_KEY[t.template_key];
            return (
              <AccordionItem key={t.id} value={t.id} className="border rounded-lg bg-card">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="font-medium">{t.display_name}</span>
                    {status && <StatusBadge status={status} />}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <CardDescription className="mb-3">
                    Schlüssel: <code>{t.template_key}</code>
                    {t.placeholders?.length > 0 && (
                      <> · Platzhalter: {t.placeholders.map(p => <code key={p} className="mx-1">{`{{${p}}}`}</code>)}</>
                    )}
                  </CardDescription>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Betreff</Label>
                      <Input value={t.subject} disabled={!canEdit} onChange={e => updateField(t.id, 'subject', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Inhalt</Label>
                      <Textarea value={t.body} disabled={!canEdit} rows={12} onChange={e => updateField(t.id, 'body', e.target.value)} />
                    </div>
                    {canEdit && (
                      <div className="flex justify-between gap-2 flex-wrap">
                        <div className="flex gap-2 flex-wrap">
                          {BULK_DEVICE_STATUS_BY_KEY[t.template_key] && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={bulkSending === t.id}>
                                  {bulkSending === t.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                  Erneut an alle senden
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>E-Mail erneut an alle Kunden senden?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Versendet diese Vorlage manuell an alle Kunden, deren reservierte Geräte aktuell den Status
                                    <strong> "{BULK_DEVICE_STATUS_BY_KEY[t.template_key]}"</strong> haben.
                                    Aktion kann nicht rückgängig gemacht werden.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => bulkResend(t)}>Jetzt versenden</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <SingleSendDialog template={t} />
                        </div>
                        <Button onClick={() => save(t)} disabled={saving === t.id}>
                          {saving === t.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Speichern
                        </Button>
                      </div>
                    )}

                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function SingleSendDialog({ template }: { template: TemplateRow }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<OrderSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<OrderSearchResult | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch(''); setResults([]); setSelected(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, internal_number, customers(contact_name, company_name, email)')
        .or(`order_number.ilike.%${q}%,internal_number.ilike.%${q}%`)
        .limit(15);
      if (cancelled) return;
      setSearching(false);
      if (error) { toast.error('Suche fehlgeschlagen: ' + error.message); return; }
      const mapped: OrderSearchResult[] = (data || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        internal_number: o.internal_number,
        customer_name: o.customers?.contact_name || o.customers?.company_name || null,
        customer_email: o.customers?.email || null,
      }));
      setResults(mapped);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, open]);

  const send = async () => {
    if (!selected) return;
    setSending(true);
    const res = await sendCustomerShippingNotice(
      selected.id,
      undefined,
      'manuell',
      template.template_key as any,
    );
    setSending(false);
    if (res.ok) { toast.success(res.message); setOpen(false); }
    else toast.error('Versand fehlgeschlagen: ' + res.message);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserRound className="w-4 h-4 mr-2" />
          An einen Kunden senden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{template.display_name} – an einen Kunden senden</DialogTitle>
          <DialogDescription>
            Auftrag suchen (Auftrags-Nr. oder interne Nummer). Die E-Mail wird an die hinterlegte Kunden-Adresse versendet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Auftrags-Nr. suchen…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              className="pl-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {searching && <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Suche…</div>}
            {!searching && search.trim().length >= 2 && results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Keine Treffer.</div>
            )}
            {!searching && search.trim().length < 2 && (
              <div className="p-3 text-sm text-muted-foreground">Mindestens 2 Zeichen eingeben.</div>
            )}
            {results.map((r) => {
              const active = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${active ? 'bg-accent' : ''}`}
                >
                  <div className="font-medium">
                    {r.order_number || r.internal_number || '—'}
                    {r.internal_number && r.order_number && r.internal_number !== r.order_number && (
                      <span className="text-muted-foreground"> · {r.internal_number}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.customer_name || 'Unbekannter Kunde'}
                    {r.customer_email ? ` · ${r.customer_email}` : ' · keine E-Mail'}
                  </div>
                </button>
              );
            })}
          </div>
          {selected && !selected.customer_email && (
            <p className="text-xs text-destructive">Dieser Kunde hat keine E-Mail-Adresse hinterlegt.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={send} disabled={!selected || !selected.customer_email || sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Jetzt versenden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

