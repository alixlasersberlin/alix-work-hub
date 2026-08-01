import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FeedbackHeader, REWARD_TYPES } from './_shared';
import { Plus, Trash2, Gift, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';

const EMPTY = {
  name: '', description: '', reward_type: 'gutschein', value_amount: '', currency: 'EUR',
  stock_total: '', generic_code: '', code_mode: 'einmalig', conditions: '', requires_shipping: false,
  department: '', auto_email: true, valid_from: '', valid_to: '', status: 'aktiv',
};

export default function FeedbackRewards() {
  const sb = supabase as any;
  const [rows, setRows] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const canDelete = useCanDelete();

  async function load() {
    const [r, a] = await Promise.all([
      sb.from('survey_rewards').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      sb.from('survey_reward_assignments').select('id,reward_id,status,issued_at,redeemed_at,code_text').order('created_at', { ascending: false }).limit(500),
    ]);
    setRows(r.data ?? []); setAssignments(a.data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function save() {
    if (!form.name?.trim()) { toast.error('Bitte Name angeben'); return; }
    const payload = {
      name: form.name, description: form.description, reward_type: form.reward_type,
      value_amount: form.value_amount === '' ? null : Number(form.value_amount), currency: form.currency,
      stock_total: form.stock_total === '' ? null : Number(form.stock_total),
      generic_code: form.generic_code || null, code_mode: form.code_mode, conditions: form.conditions || null,
      requires_shipping: form.requires_shipping, department: form.department || null, auto_email: form.auto_email,
      valid_from: form.valid_from || null, valid_to: form.valid_to || null, status: form.status,
    };
    const { error } = form.id
      ? await sb.from('survey_rewards').update(payload).eq('id', form.id)
      : await sb.from('survey_rewards').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Gespeichert'); setOpen(false); setForm(EMPTY); load();
  }

  async function remove(id: string) {
    if (!confirm('Belohnung löschen?')) return;
    const { error } = await sb.from('survey_rewards').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message); else load();
  }

  const usedOf = (id: string) => assignments.filter(a => a.reward_id === id).length;
  const redeemedOf = (id: string) => assignments.filter(a => a.reward_id === id && a.redeemed_at).length;

  return (
    <div className="space-y-5">
      <FeedbackHeader title="Geschenke & Belohnungen" subtitle="Verwaltung aller Danke-Prämien"
        action={<Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Neue Belohnung</Button>} />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-3">Bezeichnung</th><th className="p-3">Typ</th><th className="p-3">Wert</th>
              <th className="p-3">Bestand</th><th className="p-3">Vergeben / Eingelöst</th><th className="p-3">Gültig bis</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3"><div className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" />{r.name}</div>
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}</td>
                  <td className="p-3"><Badge variant="outline">{r.reward_type}</Badge></td>
                  <td className="p-3">{r.value_amount ? `${r.value_amount} ${r.currency ?? ''}` : '–'}</td>
                  <td className="p-3">{r.stock_total ?? '∞'}</td>
                  <td className="p-3">{usedOf(r.id)} / {redeemedOf(r.id)}</td>
                  <td className="p-3 text-muted-foreground">{r.valid_to ? new Date(r.valid_to).toLocaleDateString('de-DE') : '–'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => { setForm({ ...r, value_amount: r.value_amount ?? '', stock_total: r.stock_total ?? '', valid_from: r.valid_from?.slice(0, 10) ?? '', valid_to: r.valid_to?.slice(0, 10) ?? '' }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Noch keine Belohnungen angelegt.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Belohnung bearbeiten' : 'Neue Belohnung'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Bezeichnung</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Art</Label>
              <Select value={form.reward_type} onValueChange={v => setForm({ ...form, reward_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REWARD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Wert</Label><Input type="number" value={form.value_amount} onChange={e => setForm({ ...form, value_amount: e.target.value })} /></div>
            <div><Label>Währung</Label><Input value={form.currency ?? 'EUR'} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
            <div><Label>Bestand (leer = unbegrenzt)</Label><Input type="number" value={form.stock_total} onChange={e => setForm({ ...form, stock_total: e.target.value })} /></div>
            <div>
              <Label>Code-Modus</Label>
              <Select value={form.code_mode ?? 'einmalig'} onValueChange={v => setForm({ ...form, code_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="einmalig">Einmalige Codes</SelectItem>
                  <SelectItem value="generisch">Ein generischer Code</SelectItem>
                  <SelectItem value="kein_code">Ohne Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Generischer Code</Label><Input value={form.generic_code ?? ''} onChange={e => setForm({ ...form, generic_code: e.target.value })} /></div>
            <div><Label>Gültig ab</Label><Input type="date" value={form.valid_from ?? ''} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
            <div><Label>Gültig bis</Label><Input type="date" value={form.valid_to ?? ''} onChange={e => setForm({ ...form, valid_to: e.target.value })} /></div>
            <div><Label>Zuständige Abteilung</Label><Input value={form.department ?? ''} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Bedingungen</Label><Textarea rows={2} value={form.conditions ?? ''} onChange={e => setForm({ ...form, conditions: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={!!form.requires_shipping} onCheckedChange={v => setForm({ ...form, requires_shipping: v })} /><span className="text-sm">Versand erforderlich</span></div>
            <div className="flex items-center gap-2"><Switch checked={!!form.auto_email} onCheckedChange={v => setForm({ ...form, auto_email: v })} /><span className="text-sm">Automatisch per E-Mail senden</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button><Button onClick={save}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
