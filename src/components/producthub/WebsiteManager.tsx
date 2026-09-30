import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePhChannels } from '@/lib/producthub/useChannels';

const db = supabase as any;

export function WebsiteManager({ canWrite }: { canWrite: boolean }) {
  const { all, reload } = usePhChannels(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const c = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name.trim() || !c) { toast.error('Name und Kürzel sind Pflicht'); return; }
    if (all.some(x => x.code === c)) { toast.error('Dieses Kürzel gibt es schon'); return; }
    let u = url.trim();
    if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
    setBusy(true);
    const { error } = await db.from('ph_channels').insert({
      code: c, name: name.trim(), base_url: u || null, is_active: true,
      sort_order: Math.max(0, ...all.map(x => x.sort_order)) + 1,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Webseite ${name.trim()} angelegt`);
    setName(''); setUrl(''); setCode(''); reload();
  };

  const update = async (id: string, patch: Record<string, any>) => {
    const { error } = await db.from('ph_channels').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gespeichert'); reload(); }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" /> Webseiten</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {canWrite && (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="alix-lasers.ch" className="w-52" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Adresse</Label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://alix-lasers.ch" className="w-64" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Kürzel</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} placeholder="ch" className="w-24" /></div>
            <Button size="sm" onClick={add} disabled={busy}><Plus className="w-4 h-4 mr-1" /> Neue Webseite anlegen</Button>
          </div>
        )}
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Kürzel</TableHead><TableHead>Adresse</TableHead><TableHead>Aktiv</TableHead></TableRow></TableHeader>
          <TableBody>
            {all.map(c => (
              <TableRow key={c.code}>
                <TableCell className="font-medium">{c.label} {c.builtin && <Badge variant="outline" className="ml-1 text-[10px]">Standard</Badge>}</TableCell>
                <TableCell>{c.short}</TableCell>
                <TableCell>
                  {canWrite && c.id
                    ? <Input defaultValue={c.base_url || ''} placeholder="https://…" className="h-8 w-64"
                        onBlur={e => { const v = e.target.value.trim(); if (v !== (c.base_url || '')) update(c.id!, { base_url: v || null }); }} />
                    : <span className="text-xs text-muted-foreground">{c.base_url || '—'}</span>}
                </TableCell>
                <TableCell>
                  <Switch checked={c.is_active} disabled={!canWrite || !c.id} onCheckedChange={v => update(c.id!, { is_active: v })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Eine neue Webseite erscheint sofort unter „Webseiten“ und in jedem Gerät. Damit sie die Gerätedaten anzeigt,
          muss das Web-Team sie an den Product Hub anbinden. Löschen ist nicht möglich – bitte stattdessen deaktivieren.
        </p>
      </CardContent>
    </Card>
  );
}
