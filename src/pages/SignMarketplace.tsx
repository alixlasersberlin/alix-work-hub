import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Store, Plus, Key, Copy, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Partner = {
  id: string; name: string; slug: string; primary_color: string; plan: string;
  status: string; monthly_quota: number; used_quota: number; logo_url: string | null;
  custom_domain: string | null; contact_email: string | null; api_key_prefix: string | null;
};

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomKey() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return 'sk_live_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function SignMarketplace() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', primary_color: '#D4AF37', plan: 'starter', monthly_quota: 100, contact_email: '', custom_domain: '' });
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('sig_partners').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setPartners((data ?? []) as Partner[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.slug) { toast.error('Name und Slug erforderlich'); return; }
    const key = randomKey();
    const hash = await sha256Hex(key);
    const prefix = key.slice(0, 12);
    const { error } = await supabase.from('sig_partners').insert({
      ...form,
      api_key_hash: hash,
      api_key_prefix: prefix,
    });
    if (error) { toast.error(error.message); return; }
    setNewKey(key);
    setForm({ name: '', slug: '', primary_color: '#D4AF37', plan: 'starter', monthly_quota: 100, contact_email: '', custom_domain: '' });
    load();
  };

  const rotate = async (p: Partner) => {
    const key = randomKey();
    const hash = await sha256Hex(key);
    const { error } = await supabase.from('sig_partners').update({ api_key_hash: hash, api_key_prefix: key.slice(0, 12) }).eq('id', p.id);
    if (error) { toast.error(error.message); return; }
    setNewKey(key);
    setDialogOpen(true);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Partner wirklich löschen?')) return;
    const { error } = await supabase.from('sig_partners').delete().eq('id', id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display gold-text flex items-center gap-2"><Store className="w-6 h-6" /> Sign Marketplace &amp; White-Label</h1>
          <p className="text-sm text-muted-foreground">Externe Partner mit eigenem Branding, API-Key &amp; Kontingent verwalten.</p>
        </div>
        <Button onClick={() => { setNewKey(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Neuer Partner
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Aktive Partner ({partners.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Nutzung</TableHead>
                  <TableHead>API-Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded" style={{ background: p.primary_color }} />
                      {p.name}
                    </TableCell>
                    <TableCell><code className="text-xs">{p.slug}</code></TableCell>
                    <TableCell><Badge variant="outline">{p.plan}</Badge></TableCell>
                    <TableCell className="text-xs">{p.used_quota} / {p.monthly_quota}</TableCell>
                    <TableCell><code className="text-[10px]">{p.api_key_prefix ?? '—'}…</code></TableCell>
                    <TableCell><Badge variant={p.status === 'active' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => rotate(p)}><Key className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {partners.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Noch keine Partner.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{newKey ? 'API-Key erzeugt' : 'Neuer Partner'}</DialogTitle></DialogHeader>
          {newKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Kopiere den Key JETZT — er wird aus Sicherheitsgründen nicht erneut angezeigt.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">{newKey}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Kopiert'); }}><Copy className="w-3 h-3" /></Button>
              </div>
              <DialogFooter><Button onClick={() => { setNewKey(null); setDialogOpen(false); }}>Fertig</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug (URL-safe)</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Farbe</Label><Input type="color" value={form.primary_color} onChange={e => setForm({ ...form, primary_color: e.target.value })} /></div>
                <div>
                  <Label>Plan</Label>
                  <Select value={form.plan} onValueChange={v => setForm({ ...form, plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Monatliches Kontingent</Label><Input type="number" value={form.monthly_quota} onChange={e => setForm({ ...form, monthly_quota: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Kontakt E-Mail</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Custom Domain (optional)</Label><Input placeholder="sign.partner.de" value={form.custom_domain} onChange={e => setForm({ ...form, custom_domain: e.target.value })} /></div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                <Button onClick={create}>Anlegen &amp; Key erzeugen</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
