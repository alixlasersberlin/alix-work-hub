import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Plus, Search, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CustomerHit { id: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null; }

const CALL_TYPES = [
  ['inbound', 'Eingehender Anruf'], ['outbound', 'Ausgehender Anruf'], ['callback', 'Rückruf'],
  ['complaint', 'Reklamation'], ['sales', 'Vertriebsgespräch'], ['payment', 'Zahlungsrückfrage'],
  ['repair', 'Reparatur'], ['delivery', 'Lieferung'], ['training', 'Schulung'],
];
const DEPARTMENTS = ['finance', 'vertrieb', 'service', 'technik', 'marketing'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

export default function Telefonnotizen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    call_date: format(new Date(), 'yyyy-MM-dd'),
    call_time: format(new Date(), 'HH:mm'),
    call_type: 'inbound',
    priority: 'normal',
    department: 'vertrieb',
    has_followup: false,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('mail_phone_notes').select('*').order('call_date', { ascending: false }).limit(200);
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...form };
    if (!payload.topic) { toast.error('Thema fehlt'); return; }
    const { data: user } = await supabase.auth.getUser();
    payload.created_by = user.user?.id;
    payload.staff_user_id = user.user?.id;
    const { error } = await supabase.from('mail_phone_notes').insert(payload);
    if (error) { toast.error(error.message); return; }
    if (payload.has_followup && payload.followup_date) {
      await supabase.from('mail_followups').insert({
        title: `Rückruf: ${payload.topic}`,
        customer_id: payload.customer_id || null,
        due_date: payload.followup_date,
        department: payload.department,
        priority: payload.priority,
        created_by: user.user?.id,
        assigned_to: user.user?.id,
      });
    }
    toast.success('Telefonnotiz gespeichert');
    setOpen(false);
    setForm({ call_date: format(new Date(), 'yyyy-MM-dd'), call_type: 'inbound', priority: 'normal', department: 'vertrieb', has_followup: false });
    load();
  };

  const filtered = items.filter(i =>
    !search ||
    (i.topic || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.phone_number || '').includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Telefonnotizen</h2>
          <Badge variant="outline">{items.length}</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Neue Notiz</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Telefonnotiz erfassen</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ansprechpartner</Label><Input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div><Label>Telefonnummer</Label><Input value={form.phone_number || ''} onChange={e => setForm({ ...form, phone_number: e.target.value })} /></div>
              <div><Label>Datum</Label><Input type="date" value={form.call_date} onChange={e => setForm({ ...form, call_date: e.target.value })} /></div>
              <div><Label>Uhrzeit</Label><Input type="time" value={form.call_time || ''} onChange={e => setForm({ ...form, call_time: e.target.value })} /></div>
              <div>
                <Label>Gesprächsart</Label>
                <Select value={form.call_type} onValueChange={v => setForm({ ...form, call_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CALL_TYPES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Abteilung</Label>
                <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Thema *</Label><Input value={form.topic || ''} onChange={e => setForm({ ...form, topic: e.target.value })} /></div>
              <div className="col-span-2"><Label>Gesprächsnotiz</Label><Textarea rows={4} value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
              <div className="col-span-2"><Label>Ergebnis</Label><Textarea rows={2} value={form.result || ''} onChange={e => setForm({ ...form, result: e.target.value })} /></div>
              <div>
                <Label>Priorität</Label>
                <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form.has_followup} onChange={e => setForm({ ...form, has_followup: e.target.checked })} />
                  Wiedervorlage
                </label>
              </div>
              {form.has_followup && (
                <div className="col-span-2"><Label>Fälligkeitsdatum</Label><Input type="date" value={form.followup_date || ''} onChange={e => setForm({ ...form, followup_date: e.target.value })} /></div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={save}>Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="divide-y divide-border">
        {loading && <div className="p-6 text-center text-muted-foreground">Lade...</div>}
        {!loading && filtered.length === 0 && <div className="p-6 text-center text-muted-foreground">Keine Telefonnotizen</div>}
        {filtered.map(n => (
          <div key={n.id} className="p-4 hover:bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.topic || '—'}</span>
                  <Badge variant="outline">{CALL_TYPES.find(([k]) => k === n.call_type)?.[1] || n.call_type}</Badge>
                  {n.priority !== 'normal' && <Badge variant={n.priority === 'urgent' ? 'destructive' : 'secondary'}>{n.priority}</Badge>}
                  {n.has_followup && <Badge className="bg-primary/20 text-primary">Wiedervorlage {n.followup_date}</Badge>}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {n.contact_name && <>{n.contact_name} · </>}{n.phone_number} · {n.call_date} {n.call_time || ''}
                </div>
                {n.note && <p className="text-sm mt-2 line-clamp-2">{n.note}</p>}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
