import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant } from '@/hooks/useCmrTenant';
import CmrEmailTemplates from './EmailTemplates';

const FIELDS: { key: string; label: string; type?: string }[][] = [
  [
    { key: 'company_name', label: 'Firmenname' },
    { key: 'email', label: 'E-Mail' },
    { key: 'phone', label: 'Telefon' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'website', label: 'Website' },
    { key: 'logo_url', label: 'Logo-URL' },
  ],
  [
    { key: 'address_line1', label: 'Adresse 1' },
    { key: 'address_line2', label: 'Adresse 2' },
    { key: 'address_line3', label: 'Adresse 3' },
    { key: 'city', label: 'Stadt' },
    { key: 'country', label: 'Land' },
  ],
  [
    { key: 'bank_name', label: 'Bank' },
    { key: 'bank_iban', label: 'IBAN' },
    { key: 'bank_bic', label: 'BIC / SWIFT' },
    { key: 'bank_account', label: 'Kontonummer' },
  ],
  [
    { key: 'default_currency', label: 'Währung' },
    { key: 'tax_rate', label: 'MwSt.-Satz (%)', type: 'number' },
    { key: 'color_primary', label: 'Primärfarbe' },
    { key: 'color_secondary', label: 'Sekundärfarbe' },
  ],
  [
    { key: 'email_from_name', label: 'Absendername' },
    { key: 'email_from_address', label: 'Absenderadresse' },
    { key: 'email_reply_to', label: 'Antwort an' },
    { key: 'smtp_host', label: 'SMTP Host' },
    { key: 'smtp_port', label: 'SMTP Port', type: 'number' },
    { key: 'smtp_user', label: 'SMTP Benutzer' },
  ],
];

const SECTION_TITLES = ['Unternehmen', 'Anschrift', 'Bankverbindung', 'Belege & Steuer', 'E-Mail-Versand'];

export default function CmrEinstellungen() {
  const { tenantId, settings, loading, reload } = useCmrTenant();
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setForm({ ...settings }); }, [settings]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    const payload: any = { ...form };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    payload.tenant_id = tenantId;
    payload.tax_rate = Number(payload.tax_rate) || 0;
    payload.smtp_port = payload.smtp_port ? Number(payload.smtp_port) : null;

    const { error } = settings?.id
      ? await supabase.from('cmr_settings' as any).update(payload).eq('id', settings.id)
      : await supabase.from('cmr_settings' as any).insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Einstellungen gespeichert');
    reload();
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CMR Einstellungen"
        subtitle="Branding, Bankdaten, Steuer und E-Mail-Versand – gelten ausschließlich für den Mandanten CMR."
        actions={<Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Speichern</Button>}
      />

      {FIELDS.map((group, gi) => (
        <Card key={gi} className="p-4 space-y-3">
          <div className="text-sm font-semibold">{SECTION_TITLES[gi]}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {group.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  type={f.type ?? 'text'}
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Texte</div>
        <div><Label>Steuerhinweis</Label><Textarea rows={2} value={form.tax_note ?? ''} onChange={(e) => setForm({ ...form, tax_note: e.target.value })} /></div>
        <div><Label>Zahlungsbedingungen</Label><Textarea rows={2} value={form.payment_terms ?? ''} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
        <div><Label>E-Mail-Signatur</Label><Textarea rows={3} value={form.email_signature ?? ''} onChange={(e) => setForm({ ...form, email_signature: e.target.value })} /></div>
        <div><Label>Beleg-Fußzeile (HTML)</Label><Textarea rows={3} value={form.footer_html ?? ''} onChange={(e) => setForm({ ...form, footer_html: e.target.value })} /></div>
      </Card>

      <CmrEmailTemplates tenantId={tenantId} />
    </div>
  );
}
