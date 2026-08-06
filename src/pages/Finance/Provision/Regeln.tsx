import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { EmptyState } from '@/components/infinity/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Scale, Plus, Copy } from 'lucide-react';
import {
  COMMISSION_TYPES, BASIS_OPTIONS, EFFECTIVE_EVENTS, PAYOUT_TIMINGS,
  INSTALLMENT_MODES, RECLAIM_RULES, TAX_TREATMENTS, fmtDate, fmtMoney, fmtPercent,
} from '@/lib/commission/constants';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

const EMPTY: any = {
  name: '', description: '', is_active: true, commission_type: 'percent', percent_value: 0,
  fixed_amount: null, basis: 'net', effective_event: 'delivered', payout_timing: 'month_end',
  installment_mode: 'full_after_first_installment', reclaim_rule: 'full_on_cancellation',
  approval_required: true, auto_calculate: true, auto_prepare_payout: false,
  payout_min_wait_days: 0, payout_retention_days: 0, payout_min_amount: 0,
  payout_workdays_only: false, payout_grouped_monthly: false, currency: 'EUR',
  tiers: [], tier_period: 'month',
};

export default function ProvisionRegeln() {
  const perms = useCommissionPermissions();
  const [rules, setRules] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);

  const load = async () => {
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from('commission_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('tenants').select('id, name').order('name'),
    ]);
    setRules(r ?? []); setTenants(t ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name?.trim()) return toast.error('Name erforderlich');
    const payload = { ...form };
    delete payload.created_at; delete payload.updated_at;
    const { error } = form.id
      ? await supabase.from('commission_rules').update(payload).eq('id', form.id)
      : await supabase.from('commission_rules').insert(payload);
    if (error) return toast.error(error.message);
    await supabase.from('commission_audit_logs').insert({
      action: form.id ? 'Provisionsregel geändert' : 'Provisionsregel angelegt',
      object_type: 'rule', object_id: form.id ?? null, new_value: payload as any,
    });
    toast.success('Regel gespeichert'); setOpen(false); setForm(EMPTY); load();
  };

  const addTier = () => setForm({ ...form, tiers: [...(form.tiers ?? []), { from: 0, to: null, percent: 0 }] });

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader
        title="Provisionsregeln"
        subtitle="Berechnungsart, Bemessungsgrundlage, Wirksamkeit und Auszahlungslogik definieren"
        icon={Scale}
        actions={perms.canManage ? (
          <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Neue Regel</Button>
        ) : undefined}
      />

      <DataCard className="p-0">
        <div className="p-5">
          {rules.length === 0 ? (
            <EmptyState icon={Scale} title="Keine Provisionsregeln" description="Lege eine erste Provisionsregel an, um die automatische Berechnung zu aktivieren." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Regel</th>
                    <th className="p-3 text-left">Art</th>
                    <th className="p-3 text-left">Wert</th>
                    <th className="p-3 text-left">Basis</th>
                    <th className="p-3 text-left">Wirksam</th>
                    <th className="p-3 text-left">Auszahlung</th>
                    <th className="p-3 text-left">Gültig</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 font-medium">{r.name}</td>
                      <td className="p-3">{COMMISSION_TYPES.find((t) => t.value === r.commission_type)?.label}</td>
                      <td className="p-3">{r.commission_type === 'percent' ? fmtPercent(r.percent_value) : fmtMoney(r.fixed_amount, r.currency)}</td>
                      <td className="p-3">{BASIS_OPTIONS.find((b) => b.value === r.basis)?.label}</td>
                      <td className="p-3">{EFFECTIVE_EVENTS.find((e) => e.value === r.effective_event)?.label}</td>
                      <td className="p-3">{PAYOUT_TIMINGS.find((p) => p.value === r.payout_timing)?.label}</td>
                      <td className="p-3">{fmtDate(r.valid_from)} – {r.valid_to ? fmtDate(r.valid_to) : 'offen'}</td>
                      <td className="p-3">{r.is_active ? 'aktiv' : 'inaktiv'}</td>
                      <td className="p-3 text-right space-x-1">
                        {perms.canManage && <>
                          <Button size="sm" variant="outline" onClick={() => { setForm({ ...r, tiers: r.tiers ?? [] }); setOpen(true); }}>Bearbeiten</Button>
                          <Button size="sm" variant="ghost" onClick={() => { const { id, created_at, updated_at, ...rest } = r; setForm({ ...rest, name: `${r.name} (Kopie)`, tiers: r.tiers ?? [] }); setOpen(true); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Provisionsregel bearbeiten' : 'Neue Provisionsregel'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Beschreibung</Label><Textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

            <div>
              <Label>Provisionsart</Label>
              <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMISSION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bemessungsgrundlage</Label>
              <Select value={form.basis} onValueChange={(v) => setForm({ ...form, basis: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BASIS_OPTIONS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Prozentwert</Label><Input type="number" step="0.01" value={form.percent_value ?? ''} onChange={(e) => setForm({ ...form, percent_value: Number(e.target.value) })} /></div>
            <div><Label>Festbetrag</Label><Input type="number" step="0.01" value={form.fixed_amount ?? ''} onChange={(e) => setForm({ ...form, fixed_amount: e.target.value === '' ? null : Number(e.target.value) })} /></div>

            {(form.commission_type === 'tiered') && (
              <div className="col-span-2 space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label>Staffeln</Label>
                  <Button size="sm" variant="outline" onClick={addTier}>Stufe hinzufügen</Button>
                </div>
                {(form.tiers ?? []).map((t: any, i: number) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-end">
                    <div><Label className="text-xs">ab Umsatz</Label><Input type="number" value={t.from ?? 0} onChange={(e) => { const ts = [...form.tiers]; ts[i] = { ...t, from: Number(e.target.value) }; setForm({ ...form, tiers: ts }); }} /></div>
                    <div><Label className="text-xs">bis</Label><Input type="number" value={t.to ?? ''} onChange={(e) => { const ts = [...form.tiers]; ts[i] = { ...t, to: e.target.value === '' ? null : Number(e.target.value) }; setForm({ ...form, tiers: ts }); }} /></div>
                    <div><Label className="text-xs">Prozent</Label><Input type="number" step="0.01" value={t.percent ?? 0} onChange={(e) => { const ts = [...form.tiers]; ts[i] = { ...t, percent: Number(e.target.value) }; setForm({ ...form, tiers: ts }); }} /></div>
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, tiers: form.tiers.filter((_: any, x: number) => x !== i) })}>Entfernen</Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label>Wirksam ab Ereignis</Label>
              <Select value={form.effective_event} onValueChange={(v) => setForm({ ...form, effective_event: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EFFECTIVE_EVENTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auszahlungszeitpunkt</Label>
              <Select value={form.payout_timing} onValueChange={(v) => setForm({ ...form, payout_timing: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYOUT_TIMINGS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ratenzahlungs-Logik</Label>
              <Select value={form.installment_mode} onValueChange={(v) => setForm({ ...form, installment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INSTALLMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rückforderungsregel</Label>
              <Select value={form.reclaim_rule} onValueChange={(v) => setForm({ ...form, reclaim_rule: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECLAIM_RULES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div><Label>Wartezeit (Tage)</Label><Input type="number" value={form.payout_min_wait_days ?? 0} onChange={(e) => setForm({ ...form, payout_min_wait_days: Number(e.target.value) })} /></div>
            <div><Label>Rückbehaltsfrist (Tage)</Label><Input type="number" value={form.payout_retention_days ?? 0} onChange={(e) => setForm({ ...form, payout_retention_days: Number(e.target.value) })} /></div>
            <div><Label>Mindestauszahlungsbetrag</Label><Input type="number" step="0.01" value={form.payout_min_amount ?? 0} onChange={(e) => setForm({ ...form, payout_min_amount: Number(e.target.value) })} /></div>
            <div><Label>Freigabegrenze</Label><Input type="number" step="0.01" value={form.approval_limit_amount ?? ''} onChange={(e) => setForm({ ...form, approval_limit_amount: e.target.value === '' ? null : Number(e.target.value) })} /></div>

            <div><Label>Mindestverkaufspreis</Label><Input type="number" step="0.01" value={form.min_sales_price ?? ''} onChange={(e) => setForm({ ...form, min_sales_price: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div><Label>Max. Rabatt %</Label><Input type="number" step="0.01" value={form.max_discount_percent ?? ''} onChange={(e) => setForm({ ...form, max_discount_percent: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div><Label>Mindestmarge</Label><Input type="number" step="0.01" value={form.min_margin ?? ''} onChange={(e) => setForm({ ...form, min_margin: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div>
              <Label>Steuerliche Behandlung</Label>
              <Select value={form.tax_treatment ?? ''} onValueChange={(v) => setForm({ ...form, tax_treatment: v })}>
                <SelectTrigger><SelectValue placeholder="wählen" /></SelectTrigger>
                <SelectContent>{TAX_TREATMENTS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mandant</Label>
              <Select value={form.tenant_id ?? ''} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                <SelectTrigger><SelectValue placeholder="alle Mandanten" /></SelectTrigger>
                <SelectContent>{tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Standort</Label><Input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Gültig ab</Label><Input type="date" value={form.valid_from ?? ''} onChange={(e) => setForm({ ...form, valid_from: e.target.value || null })} /></div>
            <div><Label>Gültig bis</Label><Input type="date" value={form.valid_to ?? ''} onChange={(e) => setForm({ ...form, valid_to: e.target.value || null })} /></div>
            <div><Label>Kostenstelle</Label><Input value={form.cost_center ?? ''} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} /></div>
            <div><Label>Buchhaltungskonto</Label><Input value={form.account_number ?? ''} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>

            <div className="flex items-center gap-3"><Switch checked={!!form.approval_required} onCheckedChange={(v) => setForm({ ...form, approval_required: v })} /><Label>Freigabe erforderlich</Label></div>
            <div className="flex items-center gap-3"><Switch checked={!!form.auto_calculate} onCheckedChange={(v) => setForm({ ...form, auto_calculate: v })} /><Label>Automatisch berechnen</Label></div>
            <div className="flex items-center gap-3"><Switch checked={!!form.auto_prepare_payout} onCheckedChange={(v) => setForm({ ...form, auto_prepare_payout: v })} /><Label>Auszahlung automatisch vormerken</Label></div>
            <div className="flex items-center gap-3"><Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Regel aktiv</Label></div>
            <div className="col-span-2"><Label>Interne Notizen</Label><Textarea value={form.internal_notes ?? ''} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
