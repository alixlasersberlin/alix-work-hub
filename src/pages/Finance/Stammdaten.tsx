import { useEffect, useState } from 'react';
import { Database, Plus, Lock, LockOpen, RefreshCw, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useAuth } from '@/hooks/useAuth';

type COA = {
  id: string; account_number: string; name: string;
  account_class: 'AKTIV'|'PASSIV'|'AUFWAND'|'ERTRAG'|'ABSCHLUSS';
  account_type: string|null; default_vat_rate: number|null;
  chart_framework: string; is_active: boolean;
};
type CC = { id: string; code: string; name: string; description: string|null; is_active: boolean; parent_id: string|null };
type CU = { id: string; code: string; name: string; description: string|null; is_active: boolean };
type PER = { id: string; fiscal_year: number; period_month: number; status: 'open'|'soft_closed'|'hard_locked'; note: string|null; closed_at: string|null };
type OB = { id: string; fiscal_year: number; account_number: string; debit: number; credit: number; currency: string; note: string|null };

const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

export default function Stammdaten() {
  const { region } = useAccountingRegion();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Super Admin') || hasRole('Admin') || hasRole('Buchhaltung Admin');
  const isSuperAdmin = hasRole('Super Admin');

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        title={`Finance Stammdaten · ${region === 'CH' ? '🇨🇭 Schweiz' : '🇪🇺 EU'}`}
        subtitle="Kontenrahmen · Kostenstellen · Kostenträger · Perioden · Saldovorträge"
        icon={Database}
      />

      <Tabs defaultValue="coa" className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-1">
          <TabsTrigger value="coa">Kontenrahmen</TabsTrigger>
          <TabsTrigger value="tax">Steuern</TabsTrigger>
          <TabsTrigger value="cc">Kostenstellen</TabsTrigger>
          <TabsTrigger value="cu">Kostenträger</TabsTrigger>
          <TabsTrigger value="per">Perioden</TabsTrigger>
          <TabsTrigger value="ob">Saldovortrag</TabsTrigger>
        </TabsList>

        <TabsContent value="coa"><CoaTab region={region} canWrite={isAdmin} canDelete={isSuperAdmin} /></TabsContent>
        <TabsContent value="tax"><TaxTab region={region} canWrite={isAdmin} canDelete={isSuperAdmin} /></TabsContent>
        <TabsContent value="cc"><CcTab region={region} canWrite={isAdmin} canDelete={isSuperAdmin} /></TabsContent>
        <TabsContent value="cu"><CuTab region={region} canWrite={isAdmin} canDelete={isSuperAdmin} /></TabsContent>
        <TabsContent value="per"><PerTab region={region} canWrite={isAdmin} canDelete={isSuperAdmin} /></TabsContent>
        <TabsContent value="ob"><ObTab region={region} canWrite={isAdmin} canDelete={isSuperAdmin} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== KONTENRAHMEN ============================= */
function CoaTab({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<COA[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cls, setCls] = useState<string>('all');
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<Partial<COA>>({
    account_number:'', name:'', account_class:'AKTIV', account_type:'', default_vat_rate: null, chart_framework: region==='CH'?'KMU_CH':'SKR03', is_active: true,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('finance_chart_of_accounts')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region])
      .order('account_number', { ascending: true }).limit(2000);
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const filtered = rows.filter(r =>
    (cls==='all' || r.account_class===cls) &&
    (!q || `${r.account_number} ${r.name}`.toLowerCase().includes(q.toLowerCase()))
  );

  const save = async () => {
    if (!form.account_number || !form.name) return toast.error('Kontonummer & Name erforderlich');
    const { error } = await supabase.from('finance_chart_of_accounts').insert({
      ...form, accounting_region: region,
    } as any);
    if (error) return toast.error(error.message);
    toast.success('Konto angelegt');
    setOpenNew(false); load();
  };

  const toggle = async (r: COA) => {
    const { error } = await supabase.from('finance_chart_of_accounts')
      .update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) return toast.error(error.message);
    load();
  };
  const del = async (r: COA) => {
    if (!confirm(`Konto ${r.account_number} löschen?`)) return;
    const { error } = await supabase.from('finance_chart_of_accounts').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Kontenrahmen ({filtered.length}/{rows.length})</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4"/></Button>
          {canWrite && <Button size="sm" onClick={()=>setOpenNew(true)}><Plus className="w-4 h-4 mr-1"/>Neu</Button>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Suche…" value={q} onChange={e=>setQ(e.target.value)} className="w-56"/>
          <Select value={cls} onValueChange={setCls}>
            <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Klassen</SelectItem>
              <SelectItem value="AKTIV">Aktiv</SelectItem>
              <SelectItem value="PASSIV">Passiv</SelectItem>
              <SelectItem value="AUFWAND">Aufwand</SelectItem>
              <SelectItem value="ERTRAG">Ertrag</SelectItem>
              <SelectItem value="ABSCHLUSS">Abschluss</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Konto-Nr.</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Klasse</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">MwSt.</TableHead>
                <TableHead>Framework</TableHead>
                <TableHead className="w-32 text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Lädt…</TableCell></TableRow>
              : filtered.length===0 ? <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Keine Konten</TableCell></TableRow>
              : filtered.map(r=>(
                <TableRow key={r.id} className={!r.is_active?'opacity-50':''}>
                  <TableCell className="font-mono">{r.account_number}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell><Badge variant="outline">{r.account_class}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.account_type}</TableCell>
                  <TableCell className="text-right">{r.default_vat_rate!=null?`${r.default_vat_rate}%`:'—'}</TableCell>
                  <TableCell className="text-xs">{r.chart_framework}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canWrite && <Switch checked={r.is_active} onCheckedChange={()=>toggle(r)} />}
                      {canDelete && <Button variant="ghost" size="icon" onClick={()=>del(r)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Konto ({region})</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Kontonummer *</Label><Input value={form.account_number||''} onChange={e=>setForm({...form,account_number:e.target.value})}/></div>
            <div><Label>Klasse</Label>
              <Select value={form.account_class} onValueChange={(v:any)=>setForm({...form,account_class:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {['AKTIV','PASSIV','AUFWAND','ERTRAG','ABSCHLUSS'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Bezeichnung *</Label><Input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><Label>Typ</Label><Input value={form.account_type||''} onChange={e=>setForm({...form,account_type:e.target.value})}/></div>
            <div><Label>MwSt. %</Label><Input type="number" step="0.1" value={form.default_vat_rate??''} onChange={e=>setForm({...form,default_vat_rate:e.target.value===''?null:parseFloat(e.target.value)})}/></div>
            <div><Label>Framework</Label>
              <Select value={form.chart_framework} onValueChange={(v)=>setForm({...form,chart_framework:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {['KMU_CH','SKR03','SKR04','CUSTOM'].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenNew(false)}>Abbrechen</Button>
            <Button onClick={save}><Save className="w-4 h-4 mr-1"/>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================ KOSTENSTELLEN ============================= */
function CcTab({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<CC[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<Partial<CC>>({ code:'', name:'', description:'', is_active: true, parent_id: null });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('finance_cost_centers')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).order('code');
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const save = async () => {
    if (!form.code || !form.name) return toast.error('Code & Name erforderlich');
    const { error } = await supabase.from('finance_cost_centers').insert({ ...form, accounting_region: region } as any);
    if (error) return toast.error(error.message);
    toast.success('Kostenstelle angelegt'); setOpenNew(false); load();
  };
  const del = async (r: CC) => {
    if (!confirm(`Kostenstelle ${r.code} löschen?`)) return;
    const { error } = await supabase.from('finance_cost_centers').delete().eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Kostenstellen ({rows.length})</CardTitle>
        {canWrite && <Button size="sm" onClick={()=>setOpenNew(true)}><Plus className="w-4 h-4 mr-1"/>Neu</Button>}
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Parent</TableHead><TableHead>Beschreibung</TableHead><TableHead>Status</TableHead><TableHead/>
            </TableRow></TableHeader>
            <TableBody>
              {loading?<TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Lädt…</TableCell></TableRow>
              : rows.length===0?<TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Keine Kostenstellen</TableCell></TableRow>
              : rows.map(r=>(
                <TableRow key={r.id} className={!r.is_active?'opacity-50':''}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rows.find(x=>x.id===r.parent_id)?.code||'—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.description||'—'}</TableCell>
                  <TableCell><Badge variant={r.is_active?'default':'secondary'}>{r.is_active?'aktiv':'inaktiv'}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canDelete && <Button variant="ghost" size="icon" onClick={()=>del(r)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Kostenstelle ({region})</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={form.code||''} onChange={e=>setForm({...form,code:e.target.value})}/></div>
            <div><Label>Parent</Label>
              <Select value={form.parent_id||'none'} onValueChange={v=>setForm({...form,parent_id: v==='none'?null:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="none">— Keine —</SelectItem>{rows.map(r=><SelectItem key={r.id} value={r.id}>{r.code} · {r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div className="col-span-2"><Label>Beschreibung</Label><Input value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenNew(false)}>Abbrechen</Button>
            <Button onClick={save}><Save className="w-4 h-4 mr-1"/>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================ KOSTENTRÄGER ============================== */
function CuTab({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<CU[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<Partial<CU>>({ code:'', name:'', description:'', is_active: true });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('finance_cost_units')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).order('code');
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const save = async () => {
    if (!form.code || !form.name) return toast.error('Code & Name erforderlich');
    const { error } = await supabase.from('finance_cost_units').insert({ ...form, accounting_region: region } as any);
    if (error) return toast.error(error.message);
    toast.success('Kostenträger angelegt'); setOpenNew(false); load();
  };
  const del = async (r: CU) => {
    if (!confirm(`Kostenträger ${r.code} löschen?`)) return;
    const { error } = await supabase.from('finance_cost_units').delete().eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Kostenträger ({rows.length})</CardTitle>
        {canWrite && <Button size="sm" onClick={()=>setOpenNew(true)}><Plus className="w-4 h-4 mr-1"/>Neu</Button>}
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Beschreibung</TableHead><TableHead>Status</TableHead><TableHead/>
            </TableRow></TableHeader>
            <TableBody>
              {loading?<TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Lädt…</TableCell></TableRow>
              : rows.length===0?<TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine Kostenträger</TableCell></TableRow>
              : rows.map(r=>(
                <TableRow key={r.id} className={!r.is_active?'opacity-50':''}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.description||'—'}</TableCell>
                  <TableCell><Badge variant={r.is_active?'default':'secondary'}>{r.is_active?'aktiv':'inaktiv'}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canDelete && <Button variant="ghost" size="icon" onClick={()=>del(r)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Kostenträger ({region})</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={form.code||''} onChange={e=>setForm({...form,code:e.target.value})}/></div>
            <div><Label>Name *</Label><Input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div className="col-span-2"><Label>Beschreibung</Label><Input value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenNew(false)}>Abbrechen</Button>
            <Button onClick={save}><Save className="w-4 h-4 mr-1"/>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ================================ PERIODEN ============================== */
function PerTab({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<PER[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('finance_periods')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).eq('fiscal_year', year)
      .order('period_month');
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [region, year]);

  const ensureAll = async () => {
    const existing = new Set(rows.map(r=>r.period_month));
    const toCreate = [] as any[];
    for (let m=1; m<=12; m++) if (!existing.has(m)) toCreate.push({ accounting_region: region, fiscal_year: year, period_month: m, status: 'open' });
    if (toCreate.length===0) return toast.info('Alle Perioden bereits angelegt');
    const { error } = await supabase.from('finance_periods').insert(toCreate);
    if (error) return toast.error(error.message);
    toast.success(`${toCreate.length} Perioden angelegt`); load();
  };

  const setStatus = async (r: PER|null, month: number, status: PER['status']) => {
    if (r) {
      const { error } = await supabase.from('finance_periods')
        .update({ status, closed_at: status!=='open'?new Date().toISOString():null }).eq('id', r.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('finance_periods').insert({
        accounting_region: region, fiscal_year: year, period_month: month, status,
        closed_at: status!=='open'?new Date().toISOString():null,
      } as any);
      if (error) return toast.error(error.message);
    }
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Perioden {region} · Geschäftsjahr {year}</CardTitle>
        <div className="flex gap-2">
          <Input type="number" value={year} onChange={e=>setYear(parseInt(e.target.value)||year)} className="w-24"/>
          {canWrite && <Button size="sm" variant="outline" onClick={ensureAll}><Plus className="w-4 h-4 mr-1"/>Jahr initialisieren</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {Array.from({length:12},(_,i)=>i+1).map(m=>{
            const r = rows.find(x=>x.period_month===m) || null;
            const status = r?.status || 'open';
            const color = status==='open'?'bg-emerald-500/10 border-emerald-500/40':status==='soft_closed'?'bg-yellow-500/10 border-yellow-500/40':'bg-red-500/10 border-red-500/40';
            return (
              <div key={m} className={`border rounded-md p-3 ${color}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{MONTHS[m-1]} {year}</span>
                  {status==='hard_locked'?<Lock className="w-4 h-4 text-red-600"/>:status==='soft_closed'?<Lock className="w-4 h-4 text-yellow-600"/>:<LockOpen className="w-4 h-4 text-emerald-600"/>}
                </div>
                <Badge variant="outline" className="text-[10px] mb-2">{status.replace('_',' ')}</Badge>
                {canWrite && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={()=>setStatus(r,m,'open')}>Offen</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={()=>setStatus(r,m,'soft_closed')}>Soft</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-red-600" onClick={()=>{if(confirm(`${MONTHS[m-1]} ${year} HART sperren? Keinerlei Buchung mehr möglich.`))setStatus(r,m,'hard_locked')}}>Hart</Button>
                  </div>
                )}
                {r?.closed_at && <p className="text-[10px] text-muted-foreground mt-1">seit {new Date(r.closed_at).toLocaleDateString('de-DE')}</p>}
              </div>
            );
          })}
        </div>
        {loading && <p className="text-center text-muted-foreground text-sm mt-3">Lädt…</p>}
      </CardContent>
    </Card>
  );
}

/* ============================= SALDOVORTRAG ============================= */
function ObTab({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<OB[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<Partial<OB>>({ account_number:'', debit:0, credit:0, currency: region==='CH'?'CHF':'EUR', note:'' });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('finance_opening_balances')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).eq('fiscal_year', year).order('account_number');
    if (error) toast.error(error.message); else setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [region, year]);

  const save = async () => {
    if (!form.account_number) return toast.error('Kontonummer erforderlich');
    const { error } = await supabase.from('finance_opening_balances').insert({ ...form, accounting_region: region, fiscal_year: year } as any);
    if (error) return toast.error(error.message);
    toast.success('Saldovortrag gespeichert'); setOpenNew(false); setForm({account_number:'',debit:0,credit:0,currency:region==='CH'?'CHF':'EUR',note:''}); load();
  };
  const del = async (r: OB) => {
    if (!canDelete) return;
    if (!confirm(`Saldovortrag für ${r.account_number} löschen?`)) return;
    const { error } = await supabase.from('finance_opening_balances').delete().eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };

  const totalDebit = rows.reduce((s,r)=>s+Number(r.debit||0),0);
  const totalCredit = rows.reduce((s,r)=>s+Number(r.credit||0),0);
  const cur = region==='CH'?'CHF':'EUR';
  const fmt = (n:number) => n.toLocaleString('de-DE',{style:'currency',currency:cur});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Saldovortrag / Eröffnungsbilanz {region} · {year}</CardTitle>
        <div className="flex gap-2">
          <Input type="number" value={year} onChange={e=>setYear(parseInt(e.target.value)||year)} className="w-24"/>
          {canWrite && <Button size="sm" onClick={()=>setOpenNew(true)}><Plus className="w-4 h-4 mr-1"/>Neu</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Konto</TableHead><TableHead className="text-right">Soll</TableHead><TableHead className="text-right">Haben</TableHead><TableHead>Notiz</TableHead><TableHead/>
            </TableRow></TableHeader>
            <TableBody>
              {loading?<TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Lädt…</TableCell></TableRow>
              : rows.length===0?<TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine Saldovorträge</TableCell></TableRow>
              : rows.map(r=>(
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.account_number}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(r.debit))}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(r.credit))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.note||'—'}</TableCell>
                  <TableCell className="text-right">
                    {canDelete && <Button variant="ghost" size="icon" onClick={()=>del(r)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length>0 && (
                <TableRow className="font-bold bg-muted/40">
                  <TableCell>Summe</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(totalCredit)}</TableCell>
                  <TableCell colSpan={2} className={Math.abs(totalDebit-totalCredit)<0.01?'text-emerald-600':'text-red-600'}>
                    {Math.abs(totalDebit-totalCredit)<0.01?'✓ ausgeglichen':`Differenz ${fmt(totalDebit-totalCredit)}`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Saldovortrag ({region} · {year})</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Kontonummer *</Label><Input value={form.account_number||''} onChange={e=>setForm({...form,account_number:e.target.value})}/></div>
            <div><Label>Soll</Label><Input type="number" step="0.01" value={form.debit??0} onChange={e=>setForm({...form,debit:parseFloat(e.target.value)||0})}/></div>
            <div><Label>Haben</Label><Input type="number" step="0.01" value={form.credit??0} onChange={e=>setForm({...form,credit:parseFloat(e.target.value)||0})}/></div>
            <div><Label>Währung</Label><Input value={form.currency||cur} onChange={e=>setForm({...form,currency:e.target.value})}/></div>
            <div className="col-span-2"><Label>Notiz</Label><Input value={form.note||''} onChange={e=>setForm({...form,note:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenNew(false)}>Abbrechen</Button>
            <Button onClick={save}><Save className="w-4 h-4 mr-1"/>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ================================ STEUERN ================================ */
type TaxCode = {
  id: string; accounting_region: 'EU'|'CH'; code: string; name: string; rate: number;
  kind: string; account: string|null; valid_from: string; valid_to: string|null; is_active: boolean;
};
type WHT = {
  id: string; booking_date: string; gross_amount: number; tax_rate: number;
  tax_amount: number; net_amount: number; currency: string; counterparty: string|null;
  reference: string|null; refund_status: string; refund_requested_at: string|null; refund_received_at: string|null;
};

function TaxTab({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [codes, setCodes] = useState<TaxCode[]>([]);
  const [wht, setWht] = useState<WHT[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCode, setOpenCode] = useState(false);
  const [openWht, setOpenWht] = useState(false);
  const [codeForm, setCodeForm] = useState<Partial<TaxCode>>({ code:'', name:'', rate: 0, kind:'output', account:'', valid_from: new Date().toISOString().slice(0,10), is_active: true });
  const [whtForm, setWhtForm] = useState<Partial<WHT>>({ booking_date: new Date().toISOString().slice(0,10), gross_amount: 0, tax_rate: 35, currency: 'CHF', counterparty:'', reference:'', refund_status:'offen' });

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: w }] = await Promise.all([
      supabase.from('finance_tax_codes' as any).select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).order('code'),
      region === 'CH'
        ? supabase.from('finance_withholding_tax' as any).select('*').eq('accounting_region', 'CH').order('booking_date', { ascending: false }).limit(200)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setCodes((c as any) || []); setWht((w as any) || []); setLoading(false);
  };
  useEffect(() => { load(); }, [region]);

  const saveCode = async () => {
    if (!codeForm.code || !codeForm.name) return toast.error('Code & Name erforderlich');
    const { error } = await supabase.from('finance_tax_codes' as any).insert({ ...codeForm, accounting_region: region } as any);
    if (error) return toast.error(error.message);
    toast.success('Steuercode angelegt'); setOpenCode(false); load();
  };
  const toggleCode = async (r: TaxCode) => {
    const { error } = await supabase.from('finance_tax_codes' as any).update({ is_active: !r.is_active }).eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };
  const delCode = async (r: TaxCode) => {
    if (!confirm(`Steuercode ${r.code} löschen?`)) return;
    const { error } = await supabase.from('finance_tax_codes' as any).delete().eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };

  const saveWht = async () => {
    const gross = Number(whtForm.gross_amount || 0);
    const rate = Number(whtForm.tax_rate || 35);
    const tax = Math.round(gross * rate) / 100;
    const net = Math.round((gross - tax) * 100) / 100;
    const { error } = await supabase.from('finance_withholding_tax' as any).insert({
      ...whtForm, tax_amount: tax, net_amount: net, accounting_region: 'CH',
    } as any);
    if (error) return toast.error(error.message);
    toast.success('Verrechnungssteuer erfasst'); setOpenWht(false); load();
  };
  const updWhtStatus = async (r: WHT, status: string) => {
    const patch: any = { refund_status: status };
    if (status === 'beantragt') patch.refund_requested_at = new Date().toISOString().slice(0,10);
    if (status === 'erstattet') patch.refund_received_at = new Date().toISOString().slice(0,10);
    const { error } = await supabase.from('finance_withholding_tax' as any).update(patch).eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };
  const delWht = async (r: WHT) => {
    if (!confirm('Eintrag löschen?')) return;
    const { error } = await supabase.from('finance_withholding_tax' as any).delete().eq('id', r.id);
    if (error) return toast.error(error.message); load();
  };

  const fmt = (n: number, ccy = region==='CH'?'CHF':'EUR') => n.toLocaleString(region==='CH'?'de-CH':'de-DE', { style:'currency', currency: ccy });
  const kindLabel: Record<string,string> = { output:'Umsatzsteuer', input:'Vorsteuer', reverse_charge:'Bezugsteuer', exempt:'Steuerbefreit', withholding:'Quellensteuer' };
  const whtOffen = wht.filter(w=>w.refund_status==='offen').reduce((s,w)=>s+Number(w.tax_amount),0);
  const whtBeantragt = wht.filter(w=>w.refund_status==='beantragt').reduce((s,w)=>s+Number(w.tax_amount),0);
  const whtErstattet = wht.filter(w=>w.refund_status==='erstattet').reduce((s,w)=>s+Number(w.tax_amount),0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Steuercodes {region==='CH' ? '· 🇨🇭 MwSt./VST' : '· 🇪🇺 USt./VSt.'} ({codes.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4"/></Button>
            {canWrite && <Button size="sm" onClick={()=>setOpenCode(true)}><Plus className="w-4 h-4 mr-1"/>Neu</Button>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-32">Code</TableHead><TableHead>Bezeichnung</TableHead>
                <TableHead>Typ</TableHead><TableHead className="text-right">Satz</TableHead>
                <TableHead>Konto</TableHead><TableHead>Gültig ab</TableHead>
                <TableHead className="w-24 text-right">Aktion</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading?<TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Lädt…</TableCell></TableRow>
                : codes.length===0?<TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Keine Steuercodes</TableCell></TableRow>
                : codes.map(r=>(
                  <TableRow key={r.id} className={!r.is_active?'opacity-50':''}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="outline">{kindLabel[r.kind]||r.kind}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{Number(r.rate).toFixed(2)}%</TableCell>
                    <TableCell className="font-mono text-xs">{r.account||'—'}</TableCell>
                    <TableCell className="text-xs">{r.valid_from}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canWrite && <Switch checked={r.is_active} onCheckedChange={()=>toggleCode(r)}/>}
                        {canDelete && <Button variant="ghost" size="icon" onClick={()=>delCode(r)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {region === 'CH' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Verrechnungssteuer 35 % ({wht.length})</CardTitle>
            {canWrite && <Button size="sm" onClick={()=>setOpenWht(true)}><Plus className="w-4 h-4 mr-1"/>Erfassen</Button>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Offen</div><div className="text-lg font-semibold">{fmt(whtOffen,'CHF')}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Beantragt</div><div className="text-lg font-semibold text-amber-500">{fmt(whtBeantragt,'CHF')}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Erstattet</div><div className="text-lg font-semibold text-emerald-500">{fmt(whtErstattet,'CHF')}</div></div>
            </div>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Datum</TableHead><TableHead>Gegenpartei</TableHead><TableHead>Referenz</TableHead>
                  <TableHead className="text-right">Brutto</TableHead><TableHead className="text-right">VST</TableHead>
                  <TableHead className="text-right">Netto</TableHead><TableHead>Status</TableHead><TableHead/>
                </TableRow></TableHeader>
                <TableBody>
                  {wht.length===0?<TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Keine Einträge</TableCell></TableRow>
                  : wht.map(r=>(
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.booking_date}</TableCell>
                      <TableCell>{r.counterparty||'—'}</TableCell>
                      <TableCell className="text-xs">{r.reference||'—'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(r.gross_amount), r.currency||'CHF')}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(r.tax_amount), r.currency||'CHF')}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(r.net_amount), r.currency||'CHF')}</TableCell>
                      <TableCell>
                        {canWrite ? (
                          <Select value={r.refund_status} onValueChange={v=>updWhtStatus(r, v)}>
                            <SelectTrigger className="h-8 w-32"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offen">Offen</SelectItem>
                              <SelectItem value="beantragt">Beantragt</SelectItem>
                              <SelectItem value="erstattet">Erstattet</SelectItem>
                              <SelectItem value="verjaehrt">Verjährt</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <Badge variant="outline">{r.refund_status}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {canDelete && <Button variant="ghost" size="icon" onClick={()=>delWht(r)}><Trash2 className="w-4 h-4 text-destructive"/></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={openCode} onOpenChange={setOpenCode}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Steuercode ({region})</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code *</Label><Input value={codeForm.code||''} onChange={e=>setCodeForm({...codeForm,code:e.target.value})}/></div>
            <div><Label>Satz % *</Label><Input type="number" step="0.001" value={codeForm.rate??0} onChange={e=>setCodeForm({...codeForm,rate:parseFloat(e.target.value)})}/></div>
            <div className="col-span-2"><Label>Bezeichnung *</Label><Input value={codeForm.name||''} onChange={e=>setCodeForm({...codeForm,name:e.target.value})}/></div>
            <div><Label>Typ</Label>
              <Select value={codeForm.kind} onValueChange={v=>setCodeForm({...codeForm,kind:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="output">Umsatzsteuer</SelectItem>
                  <SelectItem value="input">Vorsteuer</SelectItem>
                  <SelectItem value="reverse_charge">Bezugsteuer</SelectItem>
                  <SelectItem value="exempt">Steuerbefreit</SelectItem>
                  <SelectItem value="withholding">Quellensteuer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Konto</Label><Input value={codeForm.account||''} onChange={e=>setCodeForm({...codeForm,account:e.target.value})}/></div>
            <div><Label>Gültig ab</Label><Input type="date" value={codeForm.valid_from||''} onChange={e=>setCodeForm({...codeForm,valid_from:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenCode(false)}>Abbrechen</Button>
            <Button onClick={saveCode}><Save className="w-4 h-4 mr-1"/>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openWht} onOpenChange={setOpenWht}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verrechnungssteuer erfassen (CH)</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Datum</Label><Input type="date" value={whtForm.booking_date||''} onChange={e=>setWhtForm({...whtForm,booking_date:e.target.value})}/></div>
            <div><Label>Währung</Label>
              <Select value={whtForm.currency} onValueChange={v=>setWhtForm({...whtForm,currency:v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="CHF">CHF</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Bruttobetrag *</Label><Input type="number" step="0.01" value={whtForm.gross_amount??0} onChange={e=>setWhtForm({...whtForm,gross_amount:parseFloat(e.target.value)})}/></div>
            <div><Label>Steuersatz %</Label><Input type="number" step="0.01" value={whtForm.tax_rate??35} onChange={e=>setWhtForm({...whtForm,tax_rate:parseFloat(e.target.value)})}/></div>
            <div className="col-span-2"><Label>Gegenpartei</Label><Input value={whtForm.counterparty||''} onChange={e=>setWhtForm({...whtForm,counterparty:e.target.value})}/></div>
            <div className="col-span-2"><Label>Referenz</Label><Input value={whtForm.reference||''} onChange={e=>setWhtForm({...whtForm,reference:e.target.value})}/></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpenWht(false)}>Abbrechen</Button>
            <Button onClick={saveWht}><Save className="w-4 h-4 mr-1"/>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
