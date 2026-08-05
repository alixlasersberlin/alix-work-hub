import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';

interface Tenant {
  id: string; code: string; name: string;
  country: string | null; currency: string | null; flag_emoji: string | null;
  zoho_source_system: string | null; is_active: boolean; sort_order: number;
  legal_name: string | null;
  address_line1: string | null; address_line2: string | null;
  postal_code: string | null; city: string | null; country_name: string | null;
  phone: string | null; whatsapp: string | null; website: string | null; email: string | null;
  logo_url: string | null; vat_id: string | null; tax_number: string | null;
  bank_details: string | null; accent_color: string | null;
}

const FIELDS: (keyof Tenant)[] = [
  'name', 'country', 'currency', 'flag_emoji', 'zoho_source_system', 'is_active', 'sort_order',
  'legal_name', 'address_line1', 'address_line2', 'postal_code', 'city', 'country_name',
  'phone', 'whatsapp', 'website', 'email', 'logo_url', 'vat_id', 'tax_number',
  'bank_details', 'accent_color',
];

export default function Mandanten() {
  const { hasRole } = useAuth();
  const canManage = hasRole('Super Admin');
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*').order('sort_order');
    if (error) toast.error(error.message);
    setRows(((data as any) || []) as Tenant[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (idx: number, key: keyof Tenant, value: any) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const save = async (t: Tenant) => {
    setSaving(t.id);
    const payload: Record<string, any> = {};
    FIELDS.forEach(f => { payload[f as string] = (t as any)[f] === '' ? null : (t as any)[f]; });
    payload.name = t.name;
    payload.is_active = t.is_active;
    payload.sort_order = Number(t.sort_order) || 0;
    const { error } = await supabase.from('tenants').update(payload as any).eq('id', t.id);
    setSaving(null);
    if (error) toast.error(error.message); else { toast.success('Gespeichert'); load(); }
  };

  const F = ({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} disabled={!canManage} />
    </div>
  );

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <PageHeader
        icon={Building2}
        title="Mandanten"
        subtitle="Stammdaten, Adresse, Steuer, Bank und Branding je Konzerngesellschaft."
        noBreadcrumbs
      />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> lädt…</div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {rows.map((t, idx) => (
            <AccordionItem key={t.id} value={t.id} className="border-none">
              <Card className="p-0 overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <span className="text-lg" aria-hidden>{t.flag_emoji || '🏢'}</span>
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.code}{t.city ? ` · ${t.city}` : ''}{t.is_active ? '' : ' · inaktiv'}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <Tabs defaultValue="stamm">
                    <TabsList>
                      <TabsTrigger value="stamm">Stammdaten</TabsTrigger>
                      <TabsTrigger value="adresse">Adresse & Kontakt</TabsTrigger>
                      <TabsTrigger value="steuer">Steuer & Bank</TabsTrigger>
                      <TabsTrigger value="branding">Branding</TabsTrigger>
                    </TabsList>

                    <TabsContent value="stamm" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-4">
                      <div>
                        <Label className="text-xs">Code</Label>
                        <Input value={t.code} disabled />
                      </div>
                      <F label="Name" value={t.name} onChange={(v) => patch(idx, 'name', v)} />
                      <F label="Firmierung (legal)" value={t.legal_name} onChange={(v) => patch(idx, 'legal_name', v)} />
                      <F label="Land (Code)" value={t.country} onChange={(v) => patch(idx, 'country', v)} placeholder="DE" />
                      <F label="Währung" value={t.currency} onChange={(v) => patch(idx, 'currency', v)} placeholder="EUR" />
                      <F label="Flagge" value={t.flag_emoji} onChange={(v) => patch(idx, 'flag_emoji', v)} placeholder="🇩🇪" />
                      <F label="Zoho Quelle" value={t.zoho_source_system} onChange={(v) => patch(idx, 'zoho_source_system', v)} placeholder="zoho_eu_1" />
                      <div>
                        <Label className="text-xs">Sortierung</Label>
                        <Input type="number" value={t.sort_order ?? 0} onChange={(e) => patch(idx, 'sort_order', Number(e.target.value))} disabled={!canManage} />
                      </div>
                      <div className="flex items-center gap-3 pt-5">
                        <Switch checked={t.is_active} onCheckedChange={(v) => patch(idx, 'is_active', v)} disabled={!canManage} />
                        <span className="text-sm text-muted-foreground">{t.is_active ? 'aktiv' : 'inaktiv'}</span>
                      </div>
                    </TabsContent>

                    <TabsContent value="adresse" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-4">
                      <F label="Straße / Zeile 1" value={t.address_line1} onChange={(v) => patch(idx, 'address_line1', v)} />
                      <F label="Zeile 2" value={t.address_line2} onChange={(v) => patch(idx, 'address_line2', v)} />
                      <F label="PLZ" value={t.postal_code} onChange={(v) => patch(idx, 'postal_code', v)} />
                      <F label="Stadt" value={t.city} onChange={(v) => patch(idx, 'city', v)} />
                      <F label="Land (Klartext)" value={t.country_name} onChange={(v) => patch(idx, 'country_name', v)} />
                      <F label="Telefon" value={t.phone} onChange={(v) => patch(idx, 'phone', v)} />
                      <F label="WhatsApp" value={t.whatsapp} onChange={(v) => patch(idx, 'whatsapp', v)} />
                      <F label="E-Mail" value={t.email} onChange={(v) => patch(idx, 'email', v)} />
                      <F label="Website" value={t.website} onChange={(v) => patch(idx, 'website', v)} />
                    </TabsContent>

                    <TabsContent value="steuer" className="grid gap-3 sm:grid-cols-2 pt-4">
                      <F label="USt-IdNr." value={t.vat_id} onChange={(v) => patch(idx, 'vat_id', v)} />
                      <F label="Steuernummer" value={t.tax_number} onChange={(v) => patch(idx, 'tax_number', v)} />
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Bankverbindung</Label>
                        <Textarea
                          rows={4}
                          value={t.bank_details ?? ''}
                          placeholder={'Bank\nIBAN\nBIC'}
                          onChange={(e) => patch(idx, 'bank_details', e.target.value)}
                          disabled={!canManage}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="branding" className="grid gap-3 sm:grid-cols-2 pt-4">
                      <F label="Logo-URL" value={t.logo_url} onChange={(v) => patch(idx, 'logo_url', v)} placeholder="https://…" />
                      <div>
                        <Label className="text-xs">Akzentfarbe (HEX)</Label>
                        <div className="flex items-center gap-2">
                          <Input value={t.accent_color ?? ''} placeholder="#C9A227" onChange={(e) => patch(idx, 'accent_color', e.target.value)} disabled={!canManage} />
                          <span
                            className="w-9 h-9 rounded border border-border flex-shrink-0"
                            style={{ background: t.accent_color || 'transparent' }}
                            aria-hidden
                          />
                        </div>
                      </div>
                      {t.logo_url && (
                        <div className="sm:col-span-2">
                          <img src={t.logo_url} alt={`Logo ${t.name}`} loading="lazy" className="h-16 object-contain" />
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {canManage && (
                    <div className="flex justify-end pt-4">
                      <Button onClick={() => save(t)} disabled={saving === t.id} className="gold-gradient">
                        {saving === t.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Speichern
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </Card>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
