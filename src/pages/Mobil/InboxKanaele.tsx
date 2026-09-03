import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

const CHANNEL_TYPES = ['whatsapp', 'sms', 'email', 'instagram', 'facebook', 'telegram'] as const;
const PROVIDERS = ['META', 'TWILIO', 'OTHER'] as const;

export default function MobilInboxKanaele() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'whatsapp', phone_number: '', provider: 'META',
    provider_phone_id: '', department: '', is_active: true, push_enabled: true,
    ai_enabled: false, is_test: false,
  });

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('ac_channels')
      .select('id, name, type, phone_number, provider, provider_phone_id, department, is_active, ai_enabled, push_enabled, is_test')
      .order('name');
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name erforderlich.'); return; }
    const { error } = await (supabase as any).from('ac_channels').insert({ ...form, name: form.name.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success('Kanal angelegt.');
    setOpen(false);
    setForm({ ...form, name: '', phone_number: '', provider_phone_id: '', department: '' });
    load();
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold flex-1">Kommunikationskanäle</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Kanal</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Zugangsdaten (Tokens, Secrets) werden ausschließlich serverseitig als Supabase-Secret gespeichert
        und hier bewusst nicht angezeigt.
      </p>

      {loading && [0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}

      {!loading && rows.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Noch keine Kanäle angelegt.</Card>
      )}

      {rows.map((c) => (
        <Card key={c.id} className="p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{c.name}</span>
            {c.is_test && <Badge variant="outline" className="text-[9px]">TEST</Badge>}
            <Badge variant={c.is_active === false ? 'secondary' : 'default'} className="ml-auto text-[10px]">
              {c.is_active === false ? 'Inaktiv' : 'Aktiv'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {(c.type || '—').toString().toUpperCase()} · {c.phone_number || 'keine Nummer'} · {c.provider || '—'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Abteilung: {c.department || '—'} · KI: {c.ai_enabled ? 'an' : 'aus'} · Push: {c.push_enabled === false ? 'aus' : 'an'}
          </div>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kanal erstellen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Typ</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNEL_TYPES.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Telefonnummer (E.164)</Label><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+4915112345678" /></div>
            <div>
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Provider Phone ID</Label><Input value={form.provider_phone_id} onChange={(e) => setForm({ ...form, provider_phone_id: e.target.value })} /></div>
            <div><Label>Abteilung</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="TECHNIK / SALES / ZENTRALE" /></div>
            {([['is_active', 'Aktiv'], ['push_enabled', 'Push aktiviert'], ['ai_enabled', 'KI aktiviert'], ['is_test', 'Testkanal']] as const).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={(form as any)[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!isAdmin}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
