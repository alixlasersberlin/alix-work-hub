import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { EmptyState } from '@/components/infinity/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Users, UserPlus } from 'lucide-react';
import { EMPLOYEE_ROLES, TAX_TREATMENTS, PAYMENT_METHODS, fmtDate } from '@/lib/commission/constants';
import { useCommissionPermissions } from '@/hooks/useCommissionPermissions';

export default function ProvisionZuordnung() {
  const perms = useCommissionPermissions();
  const [orders, setOrders] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [empSettings, setEmpSettings] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [assignOrder, setAssignOrder] = useState<any | null>(null);
  const [assignForm, setAssignForm] = useState({ employee_id: '', employee_role: 'verkaeufer', share_percent: '100', rule_id: '', note: '' });
  const [empOpen, setEmpOpen] = useState<any | null>(null);
  const [empForm, setEmpForm] = useState<any>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkForm, setBulkForm] = useState({ employee_id: '', employee_role: 'verkaeufer', share_percent: '100', rule_id: '', note: '' });


  const [aliases, setAliases] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data: o }, { data: a }, { data: p }, { data: r }, { data: es }, { data: al }] = await Promise.all([
      supabase.from('orders').select('id, order_number, customer_id, order_date, order_status, salesperson_name, total_amount').order('order_date', { ascending: false }).limit(500),
      supabase.from('commission_assignments').select('*'),
      supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name'),
      supabase.from('commission_rules').select('id, name, is_active'),
      supabase.from('commission_employees').select('*'),
      supabase.from('app_settings').select('value').eq('key', 'commission_salesperson_aliases').maybeSingle(),
    ]);
    setOrders(o ?? []); setAssignments(a ?? []); setProfiles(p ?? []); setRules(r ?? []); setEmpSettings(es ?? []);
    try { setAliases(JSON.parse(al?.value ?? '{}')); } catch { setAliases({}); }
  };
  useEffect(() => { load(); }, []);

  const salespersonNames = useMemo(() => {
    const set = new Map<string, number>();
    orders.forEach((o) => {
      const n = (o.salesperson_name ?? '').trim();
      if (n) set.set(n, (set.get(n) ?? 0) + 1);
    });
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);

  const saveAliases = async (next: Record<string, string>) => {
    setAliases(next);
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'commission_salesperson_aliases', value: JSON.stringify(next) },
      { onConflict: 'key' },
    );
    if (error) return toast.error(error.message);
    toast.success('Verkäufer-Zuordnung gespeichert');
  };

  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name || profiles.find((p) => p.id === id)?.email || id;
  const assignedOrderIds = useMemo(() => new Set(assignments.map((a) => a.order_id)), [assignments]);


  const unassigned = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders
      .filter((o) => !assignedOrderIds.has(o.id))
      .filter((o) => !s || [o.order_number, o.salesperson_name].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)));
  }, [orders, assignedOrderIds, search]);

  const saveAssignment = async () => {
    if (!assignForm.employee_id) return toast.error('Bitte Mitarbeiter wählen');
    const share = Number(assignForm.share_percent);
    if (!(share >= 0 && share <= 100)) return toast.error('Anteil muss zwischen 0 und 100 % liegen');
    const existing = assignments.filter((a) => a.order_id === assignOrder.id).reduce((s, a) => s + Number(a.share_percent), 0);
    if (existing + share > 100) return toast.error('Die Summe der Anteile darf 100 % nicht überschreiten');

    const { error } = await supabase.from('commission_assignments').insert({
      order_id: assignOrder.id,
      employee_id: assignForm.employee_id,
      employee_role: assignForm.employee_role as any,
      share_percent: share,
      rule_id: assignForm.rule_id || null,
      note: assignForm.note || null,
      source: 'manual',
    });
    if (error) return toast.error(error.message);
    await supabase.from('commission_audit_logs').insert({
      action: 'Mitarbeiter zugeordnet', object_type: 'assignment', order_id: assignOrder.id,
      employee_id: assignForm.employee_id, new_value: assignForm as any,
    });
    toast.success('Mitarbeiter zugeordnet');
    setAssignOrder(null);
    setAssignForm({ employee_id: '', employee_role: 'verkaeufer', share_percent: '100', rule_id: '', note: '' });
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const saveBulkAssignment = async () => {
    if (!bulkForm.employee_id) return toast.error('Bitte Mitarbeiter wählen');
    const share = Number(bulkForm.share_percent);
    if (!(share >= 0 && share <= 100)) return toast.error('Anteil muss zwischen 0 und 100 % liegen');
    const ids = [...selected];
    if (ids.length === 0) return toast.error('Keine Aufträge markiert');
    setBulkBusy(true);
    const rows = ids.map((order_id) => ({
      order_id,
      employee_id: bulkForm.employee_id,
      employee_role: bulkForm.employee_role as any,
      share_percent: share,
      rule_id: bulkForm.rule_id || null,
      note: bulkForm.note || null,
      source: 'manual',
    }));
    const { error } = await supabase.from('commission_assignments').insert(rows);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    await supabase.from('commission_audit_logs').insert(
      ids.map((order_id) => ({
        action: 'Mitarbeiter zugeordnet (Sammelzuordnung)', object_type: 'assignment', order_id,
        employee_id: bulkForm.employee_id, new_value: bulkForm as any,
      })),
    );
    toast.success(`${ids.length} Aufträge zugeordnet`);
    setBulkOpen(false);
    setSelected(new Set());
    setBulkForm({ employee_id: '', employee_role: 'verkaeufer', share_percent: '100', rule_id: '', note: '' });
    load();
  };



  const saveEmployee = async () => {
    const payload = { ...empForm, employee_id: empOpen.id };
    const existing = empSettings.find((e) => e.employee_id === empOpen.id);
    const { error } = existing
      ? await supabase.from('commission_employees').update(payload).eq('id', existing.id)
      : await supabase.from('commission_employees').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Provisionsstammdaten gespeichert');
    setEmpOpen(null); load();
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Mitarbeiter-Zuordnung" subtitle="Provisionsberechtigte Mitarbeiter je Auftrag zuweisen und Stammdaten pflegen" icon={Users} />

      <Tabs defaultValue="unassigned">
        <TabsList>
          <TabsTrigger value="unassigned">Aufträge ohne Provisionszuordnung ({unassigned.length})</TabsTrigger>
          <TabsTrigger value="assigned">Zuordnungen ({assignments.length})</TabsTrigger>
          <TabsTrigger value="employees">Mitarbeiter-Stammdaten</TabsTrigger>
          <TabsTrigger value="aliases">Verkäufer-Aliase ({salespersonNames.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="aliases" className="mt-4">
          <DataCard className="p-0">
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Verkäufernamen aus Zoho einem AlixWork-Mitarbeiter zuordnen. Die Provisions-Engine erkennt Aufträge dann automatisch.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 text-left">Verkäufer laut Auftrag</th>
                      <th className="p-3 text-right">Aufträge</th>
                      <th className="p-3 text-left">Mitarbeiter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salespersonNames.map(([name, count]) => (
                      <tr key={name} className="border-t border-border">
                        <td className="p-3">{name}</td>
                        <td className="p-3 text-right">{count}</td>
                        <td className="p-3">
                          <Select
                            value={aliases[name] ?? '__none__'}
                            onValueChange={(v) => {
                              const next = { ...aliases };
                              if (v === '__none__') delete next[name]; else next[name] = v;
                              saveAliases(next);
                            }}
                            disabled={!perms.canManage}
                          >
                            <SelectTrigger className="max-w-xs"><SelectValue placeholder="nicht zugeordnet" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">nicht zugeordnet</SelectItem>
                              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DataCard>
        </TabsContent>


        <TabsContent value="unassigned" className="mt-4 space-y-3">
          <Input placeholder="Auftrag oder Verkäufer suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <DataCard className="p-0">
            <div className="p-5">
              {unassigned.length === 0 ? (
                <EmptyState icon={Users} title="Alle Aufträge zugeordnet" description="Es gibt keine Aufträge ohne Provisionszuordnung." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left">Auftrag</th>
                        <th className="p-3 text-left">Datum</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Verkäufer laut Auftrag</th>
                        <th className="p-3 text-right">Betrag</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {unassigned.slice(0, 300).map((o) => (
                        <tr key={o.id} className="border-t border-border">
                          <td className="p-3">{o.order_number}</td>
                          <td className="p-3">{fmtDate(o.order_date)}</td>
                          <td className="p-3">{o.order_status ?? '–'}</td>
                          <td className="p-3">{o.salesperson_name ?? '–'}</td>
                          <td className="p-3 text-right">{Number(o.total_amount ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                          <td className="p-3 text-right">
                            {perms.canManage && (
                              <Button size="sm" variant="outline" onClick={() => setAssignOrder(o)}>
                                <UserPlus className="h-4 w-4 mr-2" />Zuweisen
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="assigned" className="mt-4">
          <DataCard className="p-0">
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Auftrag</th>
                    <th className="p-3 text-left">Mitarbeiter</th>
                    <th className="p-3 text-left">Rolle</th>
                    <th className="p-3 text-right">Anteil</th>
                    <th className="p-3 text-left">Quelle</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="p-3">{orders.find((o) => o.id === a.order_id)?.order_number ?? a.order_id.slice(0, 8)}</td>
                      <td className="p-3">{nameOf(a.employee_id)}</td>
                      <td className="p-3">{EMPLOYEE_ROLES.find((r) => r.value === a.employee_role)?.label}</td>
                      <td className="p-3 text-right">{Number(a.share_percent).toFixed(2)} %</td>
                      <td className="p-3">{a.source}</td>
                      <td className="p-3 text-right">
                        {perms.canManage && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            await supabase.from('commission_assignments').delete().eq('id', a.id);
                            await supabase.from('commission_audit_logs').insert({ action: 'Mitarbeiter entfernt', object_type: 'assignment', object_id: a.id, order_id: a.order_id, employee_id: a.employee_id });
                            toast.success('Zuordnung entfernt'); load();
                          }}>Entfernen</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        </TabsContent>

        <TabsContent value="employees" className="mt-4">
          <DataCard className="p-0">
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Mitarbeiter</th>
                    <th className="p-3 text-left">Personalnr.</th>
                    <th className="p-3 text-left">Abteilung</th>
                    <th className="p-3 text-left">Provisionsberechtigt</th>
                    <th className="p-3 text-left">Standardregel</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const s = empSettings.find((e) => e.employee_id === p.id);
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-3">{p.full_name || p.email}</td>
                        <td className="p-3">{s?.personnel_number ?? '–'}</td>
                        <td className="p-3">{s?.department ?? '–'}</td>
                        <td className="p-3">{s ? (s.commission_active ? 'aktiv' : 'inaktiv') : '–'}</td>
                        <td className="p-3">{rules.find((r) => r.id === s?.default_rule_id)?.name ?? '–'}</td>
                        <td className="p-3 text-right">
                          {perms.canManage && (
                            <Button size="sm" variant="outline" onClick={() => { setEmpOpen(p); setEmpForm(s ?? { commission_active: true }); }}>Bearbeiten</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DataCard>
        </TabsContent>
      </Tabs>

      {/* Zuordnungsdialog */}
      <Dialog open={!!assignOrder} onOpenChange={(o) => !o && setAssignOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mitarbeiter zuordnen · {assignOrder?.order_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mitarbeiter</Label>
              <NativeSelect value={assignForm.employee_id} onChange={(v) => setAssignForm({ ...assignForm, employee_id: v })} placeholder="Mitarbeiter wählen">
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Rolle</Label>
              <NativeSelect value={assignForm.employee_role} onChange={(v) => setAssignForm({ ...assignForm, employee_role: v })}>
                {EMPLOYEE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Anteil in %</Label>
              <Input type="number" min={0} max={100} step="0.01" value={assignForm.share_percent} onChange={(e) => setAssignForm({ ...assignForm, share_percent: e.target.value })} />
            </div>
            <div>
              <Label>Provisionsregel (optional)</Label>
              <NativeSelect value={assignForm.rule_id} onChange={(v) => setAssignForm({ ...assignForm, rule_id: v })} placeholder="Automatisch">
                {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </NativeSelect>
            </div>

            <div><Label>Notiz</Label><Textarea value={assignForm.note} onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOrder(null)}>Abbrechen</Button>
            <Button onClick={saveAssignment}>Zuordnen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mitarbeiter-Stammdaten */}
      <Dialog open={!!empOpen} onOpenChange={(o) => !o && setEmpOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Provisionsstammdaten · {empOpen?.full_name || empOpen?.email}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['personnel_number', 'Personalnummer'], ['department', 'Abteilung'], ['employment_type', 'Beschäftigungsart'],
              ['cost_center', 'Kostenstelle'], ['account_number', 'Buchhaltungskonto'], ['commission_group', 'Provisionsgruppe'],
              ['bank_iban', 'IBAN'], ['bank_name', 'Bank'],
            ].map(([k, label]) => (
              <div key={k}><Label>{label}</Label><Input value={empForm[k] ?? ''} onChange={(e) => setEmpForm({ ...empForm, [k]: e.target.value })} /></div>
            ))}
            {[
              ['hire_date', 'Eintrittsdatum'], ['exit_date', 'Austrittsdatum'], ['contract_start', 'Vertragsbeginn'], ['contract_end', 'Vertragsende'],
            ].map(([k, label]) => (
              <div key={k}><Label>{label}</Label><Input type="date" value={empForm[k] ?? ''} onChange={(e) => setEmpForm({ ...empForm, [k]: e.target.value || null })} /></div>
            ))}
            <div><Label>Individuelle Provision %</Label><Input type="number" step="0.01" min={0} max={100} value={empForm.individual_percent ?? ''} onChange={(e) => setEmpForm({ ...empForm, individual_percent: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div><Label>Individueller Festbetrag</Label><Input type="number" step="0.01" value={empForm.individual_fixed ?? ''} onChange={(e) => setEmpForm({ ...empForm, individual_fixed: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div>
              <Label>Auszahlungsart</Label>
              <NativeSelect value={empForm.payout_method ?? ''} onChange={(v) => setEmpForm({ ...empForm, payout_method: v })} placeholder="wählen">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Steuerliche Behandlung</Label>
              <NativeSelect value={empForm.tax_treatment ?? ''} onChange={(v) => setEmpForm({ ...empForm, tax_treatment: v })} placeholder="wählen">
                {TAX_TREATMENTS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Standard-Provisionsregel</Label>
              <NativeSelect value={empForm.default_rule_id ?? ''} onChange={(v) => setEmpForm({ ...empForm, default_rule_id: v || null })} placeholder="keine">
                {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <Label>Vorgesetzter</Label>
              <NativeSelect value={empForm.supervisor_id ?? ''} onChange={(v) => setEmpForm({ ...empForm, supervisor_id: v || null })} placeholder="keiner">
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </NativeSelect>
            </div>

            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={empForm.commission_active ?? true} onCheckedChange={(v) => setEmpForm({ ...empForm, commission_active: v })} />
              <Label>Provisionsberechtigung aktiv</Label>
            </div>
            <div className="col-span-2"><Label>Interne Notizen</Label><Textarea value={empForm.internal_notes ?? ''} onChange={(e) => setEmpForm({ ...empForm, internal_notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmpOpen(null)}>Abbrechen</Button>
            <Button onClick={saveEmployee}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
