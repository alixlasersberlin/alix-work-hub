import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Copy, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { createFeed, getFeeds, revokeFeed, subscribeEch } from '@/lib/esc/ech/store';
import { feedUrl } from '@/lib/esc/ech/sender';
import { useEffect } from 'react';
import type { EchFeedToken } from '@/lib/esc/ech/types';

export default function EchCalendar() {
  const [feeds, setFeeds] = useState<EchFeedToken[]>(getFeeds());
  const [label, setLabel] = useState('');
  const [scope, setScope] = useState<EchFeedToken['scope']>('employee');
  const [scopeId, setScopeId] = useState('');

  useEffect(() => subscribeEch(() => setFeeds(getFeeds())), []);

  const add = () => {
    if (!label) { toast.error('Bezeichnung fehlt'); return; }
    createFeed({ label, scope, scopeId: scopeId || undefined });
    setLabel(''); setScopeId('');
    toast.success('Kalender-Feed erstellt');
  };

  const copy = (url: string) => { navigator.clipboard.writeText(url); toast.success('Link kopiert'); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Kalender-Synchronisation</h1>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Unterstützte Kalender (vorbereitet)</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-2 text-[12.5px]">
          {['Google Calendar','Apple Calendar','Outlook','Microsoft 365','Exchange','Thunderbird','Samsung Calendar','CalDAV','ICS Feed'].map((n) => (
            <div key={n} className="flex items-center gap-2 rounded-md border border-border/50 p-2">
              <CalendarDays className="w-4 h-4 text-primary/70" />
              <span>{n}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">vorbereitet</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Neuen Kalender-Feed erstellen</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div><Label className="text-[11px]">Bezeichnung</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Anna Weber – Service" /></div>
          <div>
            <Label className="text-[11px]">Bereich</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as EchFeedToken['scope'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Mitarbeiter</SelectItem>
                <SelectItem value="department">Abteilung</SelectItem>
                <SelectItem value="resource">Ressource</SelectItem>
                <SelectItem value="training">Schulungen</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="delivery">Lieferungen</SelectItem>
                <SelectItem value="all">Alle Termine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-[11px]">Referenz-ID (optional)</Label><Input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="z. B. e-anna" /></div>
          <div className="flex items-end"><Button className="w-full" onClick={add}>Feed erstellen</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Aktive Feeds</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border/50">
          {feeds.length === 0 && <div className="py-4 text-[12.5px] text-muted-foreground">Noch keine Feeds.</div>}
          {feeds.map((f) => (
            <div key={f.id} className="py-2 grid md:grid-cols-[1fr_120px_1fr_auto] gap-2 items-center text-[12.5px]">
              <span className="font-medium">{f.label}</span>
              <span className="text-[10.5px] uppercase text-muted-foreground">{f.scope}{f.scopeId ? ` · ${f.scopeId}` : ''}</span>
              <code className="text-[10.5px] text-muted-foreground truncate">{feedUrl(f.token)}</code>
              <div className="flex gap-1 justify-end">
                <Button size="sm" variant="ghost" onClick={() => copy(feedUrl(f.token))}><Copy className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => window.open(feedUrl(f.token, 'ics'), '_blank')}><ExternalLink className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { revokeFeed(f.id); toast.success('Feed entfernt'); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
