import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Wallet, TrendingDown, Archive, Edit2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const CATEGORIES = ['Fuhrpark', 'IT', 'Werkstattausstattung', 'Geräte', 'Software', 'Büroausstattung', 'Sonstiges'];
const METHODS = [
  { v: 'linear', l: 'Linear' },
  { v: 'gwg_sofort', l: 'GWG Sofort (≤ 800 €)' },
  { v: 'gwg_pool', l: 'GWG-Pool (5 Jahre)' },
  { v: 'degressiv', l: 'Degressiv' },
];

const fmtEUR = (n: any) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));

export default function FinanceAnlagen() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('Finance');
  const isSuperAdmin = roles.includes('Super Admin');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('alle');
  const [statusFilter, setStatusFilter] = useState('aktiv');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('finance_assets' as any).select('*').order('acquisition_date', { ascending: false }).limit(1000);
    if (catFilter !== 'alle') q = q.eq('category', catFilter);
    if (statusFilter !== 'alle') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setItems((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [catFilter, statusFilter]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i =>
      (i.name || '').toLowerCase().includes(s) ||
      (i.inventory_number || '').toLowerCase().includes(s) ||
      (i.location || '').toLowerCase().includes(s),
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const active = items.filter(i => i.status === 'aktiv');
    return {
      count: active.length,
      ahk: active.reduce((s, i) => s + Number(i.acquisition_value || 0), 0),
      book: active.reduce((s, i) => s + Number(i.book_value || 0), 0),
      depr: active.reduce((s, i) => s + Number(i.accumulated_depreciation || 0), 0),
    };
  }, [items]);

  const openNew = () => { setEditing({ category: 'Geräte', depreciation_method: 'linear', useful_life_months: 36, acquisition_date: new Date().toISOString().slice(0, 10), status: 'aktiv' }); setDialogOpen(true); };
  const openEdit = (row: any) => { setEditing({ ...row }); setDialogOpen(true); };

  const save = async () => {
    if (!editing?.name || !editing?.acquisition_value || !editing?.acquisition_date) {
      toast({ title: 'Bitte Pflichtfelder ausfüllen', variant: 'destructive' });
      return;
    }
    const payload: any = {
      name: editing.name,
      description: editing.description ?? null,
      category: editing.category,
      acquisition_date: editing.acquisition_date,
      acquisition_value: Number(editing.acquisition_value),
      useful_life_months: Number(editing.useful_life_months || 36),
      depreciation_method: editing.depreciation_method,
      degressive_rate: editing.depreciation_method === 'degressiv' ? Number(editing.degressive_rate ?? 20) : null,
      location: editing.location ?? null,
      supplier_name: editing.supplier_name ?? null,
      datev_account: editing.datev_account ?? null,
      status: editing.status ?? 'aktiv',
      disposal_date: editing.disposal_date || null,
      disposal_reason: editing.disposal_reason || null,
      disposal_value: editing.disposal_value ? Number(editing.disposal_value) : null,
      notes: editing.notes ?? null,
    };
    let res;
    if (editing.id) {
      res = await supabase.from('finance_assets' as any).update(payload).eq('id', editing.id);
    } else {
      res = await supabase.from('finance_assets' as any).insert(payload);
    }
    if (res.error) { toast({ title: 'Fehler', description: res.error.message, variant: 'destructive' }); return; }
    toast({ title: editing.id ? 'Anlage aktualisiert' : 'Anlage angelegt' });
    setDialogOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!isSuperAdmin) return;
    if (!confirm('Anlagegut wirklich löschen?')) return;
    const { error } = await supabase.from('finance_assets' as any).delete().eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Gelöscht' }); load();
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anlagenbuchhaltung"
        description="Anlagevermögen, AfA und Restbuchwerte"
        actions={canEdit ? <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Neue Anlage</Button> : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard title="Aktive Anlagen" value={String(stats.count)} icon={Archive} />
        <DataCard title="Anschaffungswerte" value={fmtEUR(stats.ahk)} icon={Wallet} />
        <DataCard title="Restbuchwert gesamt" value={fmtEUR(stats.book)} icon={Wallet} />
        <DataCard title="Kumulierte AfA" value={fmtEUR(stats.depr)} icon={TrendingDown} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche Inv.-Nr., Name, Standort…" className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kategorien</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="abgegangen">Abgegangen</SelectItem>
            <SelectItem value="verkauft">Verkauft</SelectItem>
            <SelectItem value="verschrottet">Verschrottet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Inv.-Nr.</th>
                <th className="p-3 text-left">Bezeichnung</th>
                <th className="p-3 text-left">Kategorie</th>
                <th className="p-3 text-left">Angeschafft</th>
                <th className="p-3 text-right">AHK</th>
                <th className="p-3 text-right">Restbuchwert</th>
                <th className="p-3 text-left">Methode</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 font-mono text-xs">{row.inventory_number}</td>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3"><Badge variant="outline">{row.category}</Badge></td>
                  <td className="p-3">{new Date(row.acquisition_date).toLocaleDateString('de-DE')}</td>
                  <td className="p-3 text-right">{fmtEUR(row.acquisition_value)}</td>
                  <td className="p-3 text-right font-medium">{fmtEUR(row.book_value)}</td>
                  <td className="p-3 text-xs">{METHODS.find(m => m.v === row.depreciation_method)?.l ?? row.depreciation_method}</td>
                  <td className="p-3">
                    <Badge variant={row.status === 'aktiv' ? 'default' : 'secondary'}>{row.status}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => remove(row.id)}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Keine Anlagegüter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Bearbeiten – ${editing.inventory_number ?? ''}` : 'Neue Anlage'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Bezeichnung *</Label><Input value={editing.name ?? ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Kategorie</Label>
                <Select value={editing.category} onValueChange={v => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Standort</Label><Input value={editing.location ?? ''} onChange={e => setEditing({ ...editing, location: e.target.value })} /></div>
              <div><Label>Anschaffungsdatum *</Label><Input type="date" value={editing.acquisition_date ?? ''} onChange={e => setEditing({ ...editing, acquisition_date: e.target.value })} /></div>
              <div><Label>Anschaffungswert (netto) *</Label><Input type="number" step="0.01" value={editing.acquisition_value ?? ''} onChange={e => setEditing({ ...editing, acquisition_value: e.target.value })} /></div>
              <div><Label>AfA-Methode</Label>
                <Select value={editing.depreciation_method} onValueChange={v => setEditing({ ...editing, depreciation_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nutzungsdauer (Monate)</Label><Input type="number" value={editing.useful_life_months ?? 36} onChange={e => setEditing({ ...editing, useful_life_months: e.target.value })} /></div>
              {editing.depreciation_method === 'degressiv' && (
                <div><Label>Degressiv-Satz (%)</Label><Input type="number" step="0.01" value={editing.degressive_rate ?? 20} onChange={e => setEditing({ ...editing, degressive_rate: e.target.value })} /></div>
              )}
              <div><Label>Lieferant</Label><Input value={editing.supplier_name ?? ''} onChange={e => setEditing({ ...editing, supplier_name: e.target.value })} /></div>
              <div><Label>DATEV-Konto</Label><Input value={editing.datev_account ?? ''} onChange={e => setEditing({ ...editing, datev_account: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="abgegangen">Abgegangen</SelectItem>
                    <SelectItem value="verkauft">Verkauft</SelectItem>
                    <SelectItem value="verschrottet">Verschrottet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.status !== 'aktiv' && (
                <>
                  <div><Label>Abgangsdatum</Label><Input type="date" value={editing.disposal_date ?? ''} onChange={e => setEditing({ ...editing, disposal_date: e.target.value })} /></div>
                  <div><Label>Abgangs­wert</Label><Input type="number" step="0.01" value={editing.disposal_value ?? ''} onChange={e => setEditing({ ...editing, disposal_value: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Abgangsgrund</Label><Input value={editing.disposal_reason ?? ''} onChange={e => setEditing({ ...editing, disposal_reason: e.target.value })} /></div>
                </>
              )}
              <div className="col-span-2"><Label>Notizen</Label><Textarea value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
