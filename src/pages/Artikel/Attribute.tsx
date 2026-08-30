import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Cpu, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { PM_ATTR_GROUPS, PM_ATTR_TYPES, PM_CATEGORIES } from '@/lib/produktmaster/config';

const db = supabase as any;
const empty = {
  code: '', label: '', value_type: 'text', unit: '', group_name: 'Lasertechnik',
  categories: [] as string[], options: [] as string[], is_comparable: false, is_public: false,
  is_critical: false, sort_order: 0, active: true,
};

export default function ArtikelAttribute() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin', 'Produktion'].includes(r));
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await db.from('ph_attributes').select('*').order('group_name').order('sort_order');
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!f.label.trim()) { toast.error('Bezeichnung erforderlich'); return; }
    setBusy(true);
    try {
      const payload = {
        ...f,
        code: (f.code || f.label).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_'),
        options: typeof f.options === 'string' ? String(f.options).split(',').map((s: string) => s.trim()).filter(Boolean) : f.options,
      };
      const { error } = f.id
        ? await db.from('ph_attributes').update(payload).eq('id', f.id)
        : await db.from('ph_attributes').insert(payload);
      if (error) throw error;
      toast.success('Attribut gespeichert');
      setOpen(false); setF(empty); load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const toggleCat = (c: string) =>
    setF((s: any) => ({ ...s, categories: s.categories.includes(c) ? s.categories.filter((x: string) => x !== c) : [...s.categories, c] }));

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title="Technische Daten · Attribute" subtitle="Attribut-Engine – technische Merkmale ohne Programmierung ergänzen" icon={Cpu}
        actions={canWrite ? <Button onClick={() => { setF(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Neues Attribut</Button> : undefined} />

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Attribut</TableHead><TableHead>Gruppe</TableHead><TableHead>Typ</TableHead>
            <TableHead>Einheit</TableHead><TableHead>Kategorien</TableHead><TableHead>Flags</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Noch keine Attribute definiert.</TableCell></TableRow>}
            {rows.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.label}<div className="text-[11px] text-muted-foreground">{a.code}</div></TableCell>
                <TableCell className="text-xs">{a.group_name || '—'}</TableCell>
                <TableCell className="text-xs">{PM_ATTR_TYPES.find(t => t.code === a.value_type)?.label}</TableCell>
                <TableCell className="text-xs">{a.unit || '—'}</TableCell>
                <TableCell className="text-xs">{(a.categories || []).join(', ') || 'alle'}</TableCell>
                <TableCell className="space-x-1">
                  {a.is_comparable && <Badge variant="outline" className="text-[10px]">Vergleich</Badge>}
                  {a.is_public && <Badge variant="outline" className="text-[10px]">Public</Badge>}
                  {a.is_critical && <Badge className="text-[10px]">Kritisch</Badge>}
                </TableCell>
                <TableCell>{canWrite && <Button size="sm" variant="ghost" onClick={() => { setF({ ...a, options: (a.options || []).join(', ') }); setOpen(true); }}>Bearbeiten</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{f.id ? 'Attribut bearbeiten' : 'Neues Attribut'}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div><Label className="text-xs">Bezeichnung *</Label><Input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Typ</Label>
                <Select value={f.value_type} onValueChange={v => setF({ ...f, value_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PM_ATTR_TYPES.map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs">Einheit</Label><Input value={f.unit ?? ''} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="nm, W, kg…" /></div>
            </div>
            <div><Label className="text-xs">Gruppe</Label>
              <Select value={f.group_name} onValueChange={v => setF({ ...f, group_name: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PM_ATTR_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select></div>
            {['select', 'multiselect'].includes(f.value_type) && (
              <div><Label className="text-xs">Optionen (Komma-getrennt)</Label>
                <Input value={typeof f.options === 'string' ? f.options : (f.options || []).join(', ')} onChange={e => setF({ ...f, options: e.target.value })} /></div>
            )}
            <div><Label className="text-xs">Kategorien (leer = alle)</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {PM_CATEGORIES.map(c => (
                  <Badge key={c} variant={(f.categories || []).includes(c) ? 'default' : 'outline'} className="cursor-pointer text-[10px]" onClick={() => toggleCat(c)}>{c}</Badge>
                ))}
              </div></div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.is_comparable} onCheckedChange={v => setF({ ...f, is_comparable: !!v })} />Im Produktvergleich anzeigen</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.is_public} onCheckedChange={v => setF({ ...f, is_public: !!v })} />Für Website freigegeben (public)</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.is_critical} onCheckedChange={v => setF({ ...f, is_critical: !!v })} />Regulatorisch kritisch</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.active} onCheckedChange={v => setF({ ...f, active: !!v })} />Aktiv</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
