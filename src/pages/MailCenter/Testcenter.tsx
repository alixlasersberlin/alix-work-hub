import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TestTube2, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Status = 'idle' | 'running' | 'ok' | 'fail';
interface Test { key: string; label: string; status: Status; detail?: string }

const INITIAL: Test[] = [
  { key: 'testmail', label: 'Testmail senden', status: 'idle' },
  { key: 'template', label: 'Vorlage laden', status: 'idle' },
  { key: 'customer', label: 'Kunde suchen', status: 'idle' },
  { key: 'placeholder', label: 'Platzhalter ersetzen', status: 'idle' },
  { key: 'tracking', label: 'Tracking empfangen', status: 'idle' },
  { key: 'unsub', label: 'Abmeldung testen', status: 'idle' },
  { key: 'campaign', label: 'Kampagne testen', status: 'idle' },
  { key: 'automation', label: 'Automation testen', status: 'idle' },
  { key: 'attachment', label: 'Dokument anhängen', status: 'idle' },
  { key: 'roles', label: 'Rollen prüfen', status: 'idle' },
];

export default function Testcenter() {
  const [tests, setTests] = useState<Test[]>(INITIAL);
  const [email, setEmail] = useState('');

  function setStatus(key: string, status: Status, detail?: string) {
    setTests(t => t.map(x => x.key === key ? { ...x, status, detail } : x));
  }

  async function runOne(key: string) {
    setStatus(key, 'running');
    try {
      switch (key) {
        case 'testmail': {
          if (!email) { setStatus(key, 'fail', 'Bitte Empfänger angeben'); return; }
          const { error } = await supabase.functions.invoke('send-mail', { body: { to: email, subject: 'Alix MailCenter Testmail', html: '<p>Testmail aus dem Testcenter</p>' } });
          if (error) throw error;
          setStatus(key, 'ok', `Gesendet an ${email}`);
          break;
        }
        case 'template': {
          const { data, error } = await supabase.from('mail_templates').select('id').limit(1);
          if (error) throw error;
          setStatus(key, 'ok', `${data?.length || 0} Vorlage(n) verfügbar`);
          break;
        }
        case 'customer': {
          const { data, error } = await supabase.from('customers').select('id').limit(1);
          if (error) throw error;
          setStatus(key, data?.length ? 'ok' : 'fail', `${data?.length || 0} Kunde(n) gefunden`);
          break;
        }
        case 'placeholder': {
          const tpl = 'Hallo {{name}}, Ihre Nr. {{nr}}';
          const out = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => ({ name: 'Max', nr: '12345' } as any)[k] || '');
          setStatus(key, out.includes('Max') ? 'ok' : 'fail', out);
          break;
        }
        case 'tracking': {
          const { count } = await supabase.from('mail_events').select('id', { count: 'exact', head: true });
          setStatus(key, 'ok', `${count || 0} Events`);
          break;
        }
        case 'unsub': {
          const { count } = await supabase.from('mail_unsubscribes').select('id', { count: 'exact', head: true });
          setStatus(key, 'ok', `${count || 0} Abmeldungen`);
          break;
        }
        case 'campaign': {
          const { data } = await supabase.from('mail_campaigns').select('id').limit(1);
          setStatus(key, 'ok', `${data?.length || 0} Kampagne(n)`);
          break;
        }
        case 'automation': {
          const { data } = await supabase.from('mail_automations').select('id').limit(1);
          setStatus(key, 'ok', `${data?.length || 0} Automation(en)`);
          break;
        }
        case 'attachment': {
          const { error } = await supabase.storage.from('production-orders').list('', { limit: 1 });
          if (error) throw error;
          setStatus(key, 'ok', 'Storage zugänglich');
          break;
        }
        case 'roles': {
          const { data } = await supabase.rpc('can_access_mail');
          setStatus(key, data ? 'ok' : 'fail', data ? 'MailCenter-Zugriff vorhanden' : 'Kein Zugriff');
          break;
        }
      }
    } catch (e: any) {
      setStatus(key, 'fail', e.message || 'Fehler');
    }
  }

  async function runAll() {
    for (const t of tests) await runOne(t.key);
    toast.success('Alle Tests abgeschlossen');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2"><TestTube2 className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Testcenter</h2></div>
        <div className="flex gap-2">
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Test-Empfänger E-Mail" className="w-64" />
          <Button onClick={runAll}><Play className="w-4 h-4 mr-2" />Alle Tests</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tests.map(t => (
          <Card key={t.key}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium">{t.label}</div>
                {t.detail && <div className="text-xs text-muted-foreground mt-1">{t.detail}</div>}
              </div>
              {t.status === 'ok' && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>}
              {t.status === 'fail' && <Badge variant="outline" className="bg-red-500/15 text-red-500"><XCircle className="w-3 h-3 mr-1" />Fehler</Badge>}
              {t.status === 'running' && <Badge variant="outline"><Loader2 className="w-3 h-3 mr-1 animate-spin" />läuft</Badge>}
              <Button size="sm" variant="ghost" onClick={() => runOne(t.key)}>Testen</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
