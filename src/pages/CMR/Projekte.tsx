import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Plus, Briefcase, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';

type Project = {
  id: string; code: string | null; name: string; customer_id: string | null; customer_name: string | null;
  status: string; start_date: string | null; end_date: string | null; budget: number; currency: string;
  description: string | null; notes: string | null;
};

const STATUS = ['geplant', 'laufend', 'pausiert', 'abgeschlossen', 'storniert'];

const EMPTY = {
  code: '', name: '', customer_id: '', customer_name: '', status: 'geplant',
  start_date: '', end_date: '', budget: 0, description: '', notes: '',
};

export default function CmrProjekte() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [rows, setRows] = useState<Project[]>([]);
  const [busy, setBusy] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);

  const cur = settings?.default_currency || 'AED';

  const [revenue, setRevenue] = useState<Record<string, number>>({});

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data }, { data: docs }] = await Promise.all([
      supabase.from('cmr_projects' as any).select('*').eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('cmr_documents' as any).select('project_id, doc_type, gross_total')
        .eq('tenant_id', tenantId).not('project_id', 'is', null).limit(2000),
    ]);
    const rev: Record<string, number> = {};
    (((docs as any) || []) as any[]).forEach((d) => {
      if (d.doc_type !== 'rechnung' && d.doc_type !== 'gutschrift') return;
      const sign = d.doc_type === 'gutschrift' ? -1 : 1;
      rev[d.project_id] = (rev[d.project_id] || 0) + sign * Number(d.gross_total || 0);
    });
    setRevenue(rev);
    setRows(((data as any) || []) as Project[]);
    setBusy(false);
  };


  useEffect(() => { load(); }, [tenantId]);

  useEffect(() => {
    if (custQuery.trim().length < 2) { setCustResults([]); return; }
    const t = setTimeout(async () => {
      const q = custQuery.trim();
      const { data } = await supabase.from('customers')
        .select('id, company_name, contact_name, email')
        .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`).limit(10);
      setCustResults((data as any) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [custQuery]);

  const startNew = () => { setEditId(null); setForm(EMPTY); setCustQuery(''); setOpen(true); };
  const startEdit = (p: Project) => {
    setEditId(p.id);
    setForm({
      code: p.code ?? '', name: p.name, customer_id: p.customer_id ?? '', customer_name: p.customer_name ?? '',
      status: p.status, start_date: p.start_date ?? '', end_date: p.end_date ?? '',
      budget: p.budget, description: p.description ?? '', notes: p.notes ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!tenantId) return;
    if (!form.name.trim()) { toast.error('Bitte einen Projektnamen angeben.'); return; }
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId, code: form.code || null, name: form.name,
      customer_id: form.customer_id || null, customer_name: form.customer_name || null,
      status: form.status, start_date: form.start_date || null, end_date: form.end_date || null,
      budget: Number(form.budget) || 0, currency: cur,
      description: form.description || null, notes: form.notes || null,
    };
    const { error } = editId
      ? await supabase.from('cmr_projects' as any).update(payload).eq('id', editId)
      : await supabase.from('cmr_projects' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Projekt aktualisiert' : 'Projekt angelegt');
    setOpen(false); load();
  };

  const remove = async (p: Project) => {
    const { error } = await supabase.from('cmr_projects' as any).delete().eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Projekt gelöscht');
    load();
  };

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const list = rows.filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <div className="space-y-4">
      <PageHeader title="CMR Projekte" subtitle="Projekte der Cloud Marketing Research – Budget, Laufzeit und Status." />

      <div className="flex flex-wrap gap-2 items-center">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Alle Status</option>
          {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button className="ml-auto" onClick={startNew}><Plus className="w-4 h-4 mr-1.5" /> Neues Projekt</Button>
      </div>

      <Card className="divide-y">
        {list.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Briefcase className="w-5 h-5" /> Noch keine Projekte angelegt.
          </div>
        )}
        {list.map((p) => (
          <div key={p.id} className="p-3 flex items-center gap-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => startEdit(p)}>
              <div className="font-medium truncate">{p.code ? `${p.code} · ` : ''}{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.customer_name ?? 'Ohne Kunde'}
                {p.start_date ? ` · ab ${new Date(p.start_date).toLocaleDateString('de-DE')}` : ''}
                {p.end_date ? ` bis ${new Date(p.end_date).toLocaleDateString('de-DE')}` : ''}
              </div>
            </button>
            <Badge variant="outline" className="capitalize">{p.status}</Badge>
            <div className="text-sm font-semibold whitespace-nowrap">{cmrMoney(p.budget, p.currency || cur)}</div>
            <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Projekt bearbeiten' : 'Neues Projekt'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>Kürzel</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div className="md:col-span-3"><Label>Projektname</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Ende</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <Label>Kunde (gemeinsamer Kundenstamm)</Label>
              <Input placeholder="Kunde suchen…" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
              {custResults.length > 0 && (
                <Card className="divide-y max-h-44 overflow-y-auto">
                  {custResults.map((c) => (
                    <button key={c.id} className="w-full text-left p-2 text-sm hover:bg-muted/50"
                      onClick={() => {
                        setForm({ ...form, customer_id: c.id, customer_name: c.company_name || c.contact_name || '' });
                        setCustQuery(''); setCustResults([]);
                      }}>
                      {c.company_name || c.contact_name} <span className="text-muted-foreground">{c.email}</span>
                    </button>
                  ))}
                </Card>
              )}
              <Input value={form.customer_name} placeholder="Kundenname"
                onChange={(e) => setForm({ ...form, customer_name: e.target.value, customer_id: '' })} />
            </div>

            <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Interne Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
