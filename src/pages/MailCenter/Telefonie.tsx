import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall,
  Users, Clock, Mic, Sparkles, Search, RefreshCw, Settings, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Customer { id: string; display_name: string | null; company_name: string | null; primary_phone: string | null; email: string | null; }

const CFG_KEY = 'mailcenter_3cx_config';
interface ThreeCxCfg { baseUrl: string; extension: string; webhookSecret: string; recording: boolean; transcription: boolean; }

export default function Telefonie() {
  const [cfg, setCfg] = useState<ThreeCxCfg>({ baseUrl: '', extension: '', webhookSecret: '', recording: false, transcription: false });
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [callbackTasks, setCallbackTasks] = useState<any[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem(CFG_KEY); if (s) setCfg(JSON.parse(s)); } catch {}
    load();
  }, []);

  async function load() {
    const [notes, tasks] = await Promise.all([
      supabase.from('mail_phone_notes').select('id,topic,note,created_at,direction,customer_id').order('created_at', { ascending: false }).limit(20),
      supabase.from('mail_tasks').select('id,title,status,priority,created_at').ilike('title', '%rückruf%').limit(20),
    ]);
    setRecentNotes(notes.data || []);
    setCallbackTasks(tasks.data || []);
  }

  function saveCfg() {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    toast.success('3CX-Konfiguration gespeichert');
  }

  async function doSearch() {
    if (!search.trim()) return;
    const q = search.trim();
    const { data } = await supabase
      .from('customers')
      .select('id,display_name,company_name,primary_phone,email')
      .or(`display_name.ilike.%${q}%,company_name.ilike.%${q}%,primary_phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20);
    setResults((data as any) || []);
  }

  function callNumber(number: string) {
    if (!number) return;
    // 3CX click2call: callto://<extension>/<number> oder tel:
    const cleaned = number.replace(/[^+0-9]/g, '');
    const url = cfg.baseUrl ? `${cfg.baseUrl.replace(/\/$/, '')}/callto/${cleaned}` : `tel:${cleaned}`;
    window.open(url, '_self');
    toast.success(`Anruf wird gestartet: ${cleaned}`);
  }

  async function createCallback(customerId: string | null, name: string, priority: 'hoch' | 'mittel' | 'niedrig' = 'mittel') {
    const { error } = await supabase.from('mail_tasks').insert({
      title: `Rückruf erforderlich: ${name}`,
      description: 'Automatisch erstellt aus verpasstem Anruf',
      status: 'offen',
      priority,
      customer_id: customerId,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Rückruf-Aufgabe angelegt');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><Phone className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Telefonie-Zentrale (3CX)</h2></div>
        <Button onClick={load} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Aktualisieren</Button>
      </div>

      {!cfg.baseUrl && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">3CX noch nicht konfiguriert</div>
              Hinterlegen Sie unter „Einstellungen" Ihre 3CX-Server-URL und Webhook für volle Funktion. Click-to-Call funktioniert auch ohne Konfiguration via <code>tel:</code>.
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Anrufe heute', value: '—', icon: PhoneCall, color: 'text-primary' },
          { label: 'Verpasste Anrufe', value: '—', icon: PhoneMissed, color: 'text-red-500' },
          { label: 'Rückrufe offen', value: callbackTasks.filter(t => t.status === 'offen').length, icon: PhoneOutgoing, color: 'text-amber-500' },
          { label: 'Ø Gesprächsdauer', value: '—', icon: Clock, color: 'text-emerald-500' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className="text-2xl font-bold">{k.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="live">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="live">Live-Anrufe</TabsTrigger>
          <TabsTrigger value="callbacks">Rückrufe</TabsTrigger>
          <TabsTrigger value="search">Click-to-Call</TabsTrigger>
          <TabsTrigger value="notes">Gesprächsnotizen</TabsTrigger>
          <TabsTrigger value="settings">Einstellungen</TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><PhoneIncoming className="w-4 h-4" />Aktive & verpasste Anrufe</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Live-Anruf-Stream wird per 3CX Webhook empfangen. Sobald <code>baseUrl</code> + <code>webhookSecret</code> konfiguriert sind und die Edge Function <code>3cx-webhook</code> deployed ist, erscheinen hier eingehende, ausgehende, verpasste Anrufe sowie Warteschlangen und Mitarbeiterstatus.
              </p>
              <div className="mt-4 p-4 border border-dashed border-border rounded-md text-center text-sm text-muted-foreground">
                Noch keine Anrufdaten vorhanden. Webhook in 3CX einrichten:<br />
                <code className="text-xs">POST https://xmrmkgfgpoundfwhnxfs.supabase.co/functions/v1/3cx-webhook</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="callbacks">
          <Card>
            <CardHeader><CardTitle className="text-base">Offene Rückrufe</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {callbackTasks.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Rückrufe.</p>}
              {callbackTasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('de-DE')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.priority || 'mittel'}</Badge>
                    <Badge variant="outline">{t.status}</Badge>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => createCallback(null, 'Unbekannter Anrufer')}>
                <PhoneMissed className="w-4 h-4 mr-2" />Manuell Rückruf anlegen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4" />Kunde suchen & anrufen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="Name, Firma, Telefon oder E-Mail…" />
                <Button onClick={doSearch}><Search className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-2">
                {results.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 border border-border rounded-md">
                    <div>
                      <div className="font-medium">{c.display_name || c.company_name}</div>
                      <div className="text-xs text-muted-foreground">{c.company_name} · {c.primary_phone || 'keine Nr.'}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!c.primary_phone} onClick={() => callNumber(c.primary_phone!)}>
                        <PhoneCall className="w-4 h-4 mr-2" />Anrufen
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(`/customers/${c.id}`, '_blank')}>
                        <Users className="w-4 h-4 mr-2" />Akte
                      </Button>
                    </div>
                  </div>
                ))}
                {!results.length && search && <p className="text-sm text-muted-foreground">Keine Treffer.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Letzte Gesprächsnotizen</CardTitle>
              <Button size="sm" variant="outline" asChild><a href="/mailcenter/telefonnotizen"><ExternalLink className="w-4 h-4 mr-2" />Alle anzeigen</a></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentNotes.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Notizen.</p>}
              {recentNotes.map((n: any) => (
                <div key={n.id} className="p-3 border border-border rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{n.topic || '(ohne Thema)'}</span>
                    <Badge variant="outline">{n.direction || 'eingehend'}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.note}</p>
                  <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('de-DE')}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" />3CX Konfiguration</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-xl">
              <div>
                <label className="text-sm font-medium">3CX Server URL</label>
                <Input value={cfg.baseUrl} onChange={e => setCfg({ ...cfg, baseUrl: e.target.value })} placeholder="https://pbx.alix.de" />
              </div>
              <div>
                <label className="text-sm font-medium">Eigene Nebenstelle</label>
                <Input value={cfg.extension} onChange={e => setCfg({ ...cfg, extension: e.target.value })} placeholder="z. B. 200" />
              </div>
              <div>
                <label className="text-sm font-medium">Webhook Secret</label>
                <Input type="password" value={cfg.webhookSecret} onChange={e => setCfg({ ...cfg, webhookSecret: e.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.recording} onChange={e => setCfg({ ...cfg, recording: e.target.checked })} />
                  Gesprächsaufzeichnung (rechtl. Einwilligung erforderlich)
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.transcription} onChange={e => setCfg({ ...cfg, transcription: e.target.checked })} />
                  <Sparkles className="w-4 h-4 text-primary" />KI-Transkription & Zusammenfassung
                </label>
              </div>
              <Button onClick={saveCfg}>Speichern</Button>
              <p className="text-xs text-muted-foreground pt-2">
                Hinweis: Tatsächlicher 3CX-Datenempfang erfordert eine Edge Function (<code>3cx-webhook</code>) und KI-Transkription die Edge Function (<code>3cx-transcribe</code>). Beide können bei Bedarf separat erstellt werden.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
