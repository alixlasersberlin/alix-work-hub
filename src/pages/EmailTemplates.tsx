import { useEffect, useState } from 'react';
import { Mail, Loader2, Save, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { sendCustomerShippingNotice } from '@/lib/send-customer-shipping-notice';
import { toast } from 'sonner';

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
      for (const d of list) {
        const res = await sendCustomerShippingNotice(
          d.reserved_order_id as string,
          d.id,
          'manuell',
          t.template_key as any,
        );
        if (res.ok) ok++; else { fail++; console.warn('Bulk-Versand Fehler', d, res.message); }
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
                      <div className="flex justify-between gap-2">
                        <div>
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
