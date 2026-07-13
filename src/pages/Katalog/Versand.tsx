import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, Ban, Info, Mail, MessageCircle, Link as LinkIcon, Eye, Clock, XCircle, TrendingUp } from 'lucide-react';

interface Item { id: string; sku: string; name: string; }
interface Country { id: string; iso_code: string; name: string; }
interface Language { code: string; name: string; }
interface Link {
  id: string; token: string; item_id: string; language_code: string; country_id: string | null;
  recipient_name: string | null; recipient_email: string | null; recipient_phone: string | null;
  channel: string; expires_at: string | null; view_count: number; revoked_at: string | null; created_at: string;
}

function baseUrl() {
  return `${window.location.origin}/catalog/share/`;
}

function randomToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, '').slice(0, 22);
}

export default function KatalogVersand() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    item_id: '', language_code: 'de', country_id: '__none__',
    recipient_name: '', recipient_email: '', recipient_phone: '',
    channel: 'link', expires_days: 30,
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = async () => {
    const c = supabase as any;
    const [{ data: it }, { data: cc }, { data: ll }, { data: ls }] = await Promise.all([
      c.from('catalog_items').select('id, sku, name').in('status', ['freigegeben', 'aktiv']).order('sku').limit(500),
      c.from('catalog_countries').select('id, iso_code, name').order('iso_code'),
      c.from('catalog_languages').select('code, name').order('code'),
      c.from('catalog_share_links').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    setItems(it ?? []);
    setCountries(cc ?? []);
    setLanguages(ll ?? []);
    setLinks(ls ?? []);
  };
  useEffect(() => { load(); }, []);

  // Realtime: live-Update bei neuen Aufrufen / Widerruf / neuen Links
  useEffect(() => {
    const c = supabase as any;
    const channel = c
      .channel('catalog_share_links_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalog_share_links' }, (payload: any) => {
        setLinks((prev) => {
          if (payload.eventType === 'INSERT') {
            if (prev.find((l) => l.id === payload.new.id)) return prev;
            return [payload.new as Link, ...prev];
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((l) => l.id !== payload.old.id);
          }
          return prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l));
        });
        if (payload.eventType === 'UPDATE'
          && payload.new?.view_count != null
          && payload.old?.view_count != null
          && payload.new.view_count > payload.old.view_count) {
          toast({ title: 'Neuer Aufruf', description: `Link ${String(payload.new.token).slice(0, 8)}… wurde geöffnet` });
        }
      })
      .subscribe();
    return () => { c.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!form.item_id) { toast({ title: 'Artikel wählen', variant: 'destructive' }); return; }
    setSaving(true);
    const token = randomToken();
    const expires = form.expires_days > 0
      ? new Date(Date.now() + form.expires_days * 86400000).toISOString()
      : null;
    const c = supabase as any;
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await c.from('catalog_share_links').insert({
      token,
      item_id: form.item_id,
      language_code: form.language_code,
      country_id: form.country_id === '__none__' ? null : form.country_id,
      recipient_name: form.recipient_name || null,
      recipient_email: form.recipient_email || null,
      recipient_phone: form.recipient_phone || null,
      channel: form.channel,
      expires_at: expires,
      created_by: userRes?.user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Link erstellt', description: `${baseUrl()}${token}` });
    setOpen(false);
    setForm({ ...form, item_id: '', recipient_name: '', recipient_email: '', recipient_phone: '' });
    load();
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(baseUrl() + token);
    toast({ title: 'Link kopiert' });
  };

  const revoke = async (id: string) => {
    if (!confirm('Link widerrufen?')) return;
    const { error } = await (supabase as any).from('catalog_share_links')
      .update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Widerrufen' });
    load();
  };

  const openMail = (l: Link) => {
    const url = baseUrl() + l.token;
    const item = items.find((i) => i.id === l.item_id);
    const subj = `Artikelinformation: ${item?.name ?? l.item_id}`;
    const body = `Guten Tag${l.recipient_name ? ' ' + l.recipient_name : ''},\n\nanbei der Link zum Artikel:\n${url}\n\nMit freundlichen Grüßen\nAlixWork`;
    window.location.href = `mailto:${l.recipient_email ?? ''}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  };

  const openWhats = (l: Link) => {
    const url = baseUrl() + l.token;
    const item = items.find((i) => i.id === l.item_id);
    const text = `Artikel: ${item?.name ?? ''}\n${url}`;
    const phone = (l.recipient_phone ?? '').replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const now = new Date();
  const kpis = useMemo(() => {
    const active = links.filter((l) => !l.revoked_at && (!l.expires_at || new Date(l.expires_at) >= now)).length;
    const expired = links.filter((l) => !l.revoked_at && l.expires_at && new Date(l.expires_at) < now).length;
    const revoked = links.filter((l) => !!l.revoked_at).length;
    const totalViews = links.reduce((s, l) => s + (l.view_count ?? 0), 0);
    const top = [...links].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 3);
    return { active, expired, revoked, totalViews, top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links]);

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((l) => {
      const exp = l.expires_at && new Date(l.expires_at) < now;
      if (statusFilter === 'active' && (l.revoked_at || exp)) return false;
      if (statusFilter === 'expired' && (!exp || l.revoked_at)) return false;
      if (statusFilter === 'revoked' && !l.revoked_at) return false;
      if (q) {
        const item = items.find((i) => i.id === l.item_id);
        const hay = `${item?.sku ?? ''} ${item?.name ?? ''} ${l.recipient_name ?? ''} ${l.recipient_email ?? ''} ${l.token}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, statusFilter, search, items]);

  const soonMs = 3 * 86400000;
  const expiringSoon = useMemo(() => links.filter((l) =>
    !l.revoked_at && l.expires_at
    && new Date(l.expires_at).getTime() >= now.getTime()
    && new Date(l.expires_at).getTime() - now.getTime() < soonMs
  ).length, [links, now.getTime()]);

  const revokeMany = async () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Link(s) widerrufen?`)) return;
    const { error } = await (supabase as any).from('catalog_share_links')
      .update({ revoked_at: new Date().toISOString() }).in('id', ids);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${ids.length} widerrufen` });
    setSelected({});
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          Erzeuge sichere Freigabelinks für einzelne Katalog-Artikel und versende sie per E-Mail oder WhatsApp. Links laufen automatisch ab und können jederzeit widerrufen werden.
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><div className="text-2xl font-bold">{kpis.active}</div><div className="text-xs text-muted-foreground">Aktive Links</div></div>
          <LinkIcon className="h-6 w-6 text-emerald-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><div className="text-2xl font-bold">{kpis.totalViews}</div><div className="text-xs text-muted-foreground">Aufrufe gesamt</div></div>
          <Eye className="h-6 w-6 text-primary" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><div className="text-2xl font-bold">{expiringSoon}</div><div className="text-xs text-muted-foreground">Läuft &lt; 3 Tage</div></div>
          <Clock className="h-6 w-6 text-orange-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><div className="text-2xl font-bold">{kpis.expired}</div><div className="text-xs text-muted-foreground">Abgelaufen</div></div>
          <Clock className="h-6 w-6 text-amber-500" />
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center justify-between">
          <div><div className="text-2xl font-bold">{kpis.revoked}</div><div className="text-xs text-muted-foreground">Widerrufen</div></div>
          <XCircle className="h-6 w-6 text-red-500" />
        </CardContent></Card>
      </div>


      {kpis.top.length > 0 && kpis.top[0].view_count > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" /> Top-Aufrufe
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {kpis.top.map((l) => {
              const item = items.find((i) => i.id === l.item_id);
              return (
                <div key={l.id} className="text-xs p-2 rounded-md bg-muted/40 flex justify-between items-center">
                  <span className="truncate">{item ? `${item.sku} · ${item.name}` : l.token}</span>
                  <Badge variant="secondary">{l.view_count}×</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="expired">Abgelaufen</SelectItem>
                <SelectItem value="revoked">Widerrufen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Suche</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU, Name, Empfänger…" className="w-64" />
          </div>
          {Object.values(selected).some(Boolean) && (
            <Button variant="destructive" size="sm" onClick={revokeMany}>
              <Ban className="h-4 w-4 mr-1" />
              {Object.values(selected).filter(Boolean).length} widerrufen
            </Button>
          )}
        </div>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Neuer Freigabelink</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Freigabelink erstellen</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Artikel *</Label>
                <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Artikel wählen" /></SelectTrigger>
                  <SelectContent>
                    {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.sku} · {i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sprache</Label>
                  <Select value={form.language_code} onValueChange={(v) => setForm({ ...form, language_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {languages.map((l) => <SelectItem key={l.code} value={l.code}>{l.code.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Land (Preis)</Label>
                  <Select value={form.country_id} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— kein Preis —</SelectItem>
                      {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.iso_code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Empfängername</Label>
                <Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-Mail</Label>
                  <Input type="email" value={form.recipient_email} onChange={(e) => setForm({ ...form, recipient_email: e.target.value })} />
                </div>
                <div>
                  <Label>Telefon (WhatsApp)</Label>
                  <Input value={form.recipient_phone} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} placeholder="+49…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kanal</Label>
                  <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="link">Nur Link</SelectItem>
                      <SelectItem value="email">E-Mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gültig für (Tage)</Label>
                  <Input type="number" min={0} value={form.expires_days} onChange={(e) => setForm({ ...form, expires_days: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create} disabled={saving}>{saving ? 'Speichere…' : 'Link erstellen'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  aria-label="Alle auswählen"
                  checked={filteredLinks.length > 0 && filteredLinks.every((l) => selected[l.id])}
                  onChange={(e) => {
                    const next: Record<string, boolean> = { ...selected };
                    filteredLinks.forEach((l) => { next[l.id] = e.target.checked; });
                    setSelected(next);
                  }}
                />
              </TableHead>
              <TableHead>Artikel</TableHead>
              <TableHead>Empfänger</TableHead>
              <TableHead>Kanal</TableHead>
              <TableHead>Aufrufe</TableHead>
              <TableHead>Gültig bis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-56"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLinks.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Links passen zum Filter</TableCell></TableRow>
            )}
            {filteredLinks.map((l) => {
              const item = items.find((i) => i.id === l.item_id);
              const expired = l.expires_at && new Date(l.expires_at) < new Date();
              return (
                <TableRow key={l.id} className={selected[l.id] ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label="Zeile auswählen"
                      checked={!!selected[l.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))}
                    />
                  </TableCell>
                  <TableCell className="text-sm">{item ? `${item.sku} · ${item.name}` : l.item_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">
                    {l.recipient_name ?? '—'}
                    {l.recipient_email && <div className="text-muted-foreground">{l.recipient_email}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.channel}</Badge></TableCell>
                  <TableCell>{l.view_count}</TableCell>
                  <TableCell className="text-xs">{l.expires_at ? new Date(l.expires_at).toLocaleDateString('de-DE') : '∞'}</TableCell>
                  <TableCell>
                    {l.revoked_at ? <Badge variant="destructive">widerrufen</Badge>
                      : expired ? <Badge variant="secondary">abgelaufen</Badge>
                      : <Badge className="bg-emerald-500/15 text-emerald-500">aktiv</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copy(l.token)} title="Link kopieren"><Copy className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => window.open(baseUrl() + l.token, '_blank')} title="Öffnen"><LinkIcon className="h-4 w-4" /></Button>
                      {l.recipient_email && <Button size="sm" variant="ghost" onClick={() => openMail(l)} title="E-Mail"><Mail className="h-4 w-4" /></Button>}
                      {l.recipient_phone && <Button size="sm" variant="ghost" onClick={() => openWhats(l)} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>}
                      {!l.revoked_at && <Button size="sm" variant="ghost" onClick={() => revoke(l.id)} title="Widerrufen"><Ban className="h-4 w-4 text-red-500" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
