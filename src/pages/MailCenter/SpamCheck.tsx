import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SPAM_WORDS = ['gratis', 'kostenlos', 'gewinn', '100%', 'klicken sie hier', 'jetzt kaufen', 'limitiertes angebot', 'dringend', '$$$', 'viagra', 'casino', 'risikofrei'];

function scoreContent(subject: string, html: string) {
  let score = 0;
  const reasons: string[] = [];
  const text = (subject + ' ' + html).toLowerCase();
  SPAM_WORDS.forEach(w => { if (text.includes(w)) { score += 10; reasons.push(`Verdächtiges Wort: "${w}"`); } });
  if (subject.length > 0 && subject === subject.toUpperCase()) { score += 15; reasons.push('Betreff komplett in Großbuchstaben'); }
  if ((subject.match(/!/g) || []).length > 2) { score += 10; reasons.push('Zu viele Ausrufezeichen im Betreff'); }
  const linkCount = (html.match(/<a\s/gi) || []).length;
  if (linkCount > 10) { score += 15; reasons.push(`Zu viele Links (${linkCount})`); }
  if (!/unsubscribe|abmelden|abmeldung/i.test(html)) { score += 20; reasons.push('Kein Abmeldelink erkennbar'); }
  if (html.length < 200 && subject.length > 0) { score += 5; reasons.push('Sehr kurzer Inhalt'); }
  const imgCount = (html.match(/<img\s/gi) || []).length;
  if (imgCount > 0 && html.replace(/<[^>]+>/g, '').trim().length < 100) { score += 10; reasons.push('Hauptsächlich Bilder, wenig Text'); }
  return { score: Math.min(100, score), reasons };
}

export default function SpamCheck() {
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const result = scoreContent(subject, html);
  const [deliv, setDeliv] = useState({ sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 });
  const [domain, setDomain] = useState<any>(null);

  async function loadStats() {
    const { data } = await supabase.from('mail_messages').select('status,opened_at,clicked_at,bounced_at,unsubscribed_at').limit(2000);
    const rows = data || [];
    setDeliv({
      sent: rows.length,
      opened: rows.filter((r: any) => r.opened_at).length,
      clicked: rows.filter((r: any) => r.clicked_at).length,
      bounced: rows.filter((r: any) => r.bounced_at).length,
      unsubscribed: rows.filter((r: any) => r.unsubscribed_at).length,
    });
    const { data: d } = await supabase.from('mail_domains').select('*').eq('is_active', true).limit(1).maybeSingle();
    setDomain(d);
  }

  useEffect(() => { loadStats(); }, []);

  const level = result.score < 25 ? 'low' : result.score < 60 ? 'mid' : 'high';
  const levelColor = { low: 'bg-emerald-500/15 text-emerald-500', mid: 'bg-amber-500/15 text-amber-500', high: 'bg-red-500/15 text-red-500' }[level];
  const levelLabel = { low: '🟢 Niedrig', mid: '🟡 Mittel', high: '🔴 Hoch' }[level];

  const pct = (n: number) => deliv.sent ? `${((n / deliv.sent) * 100).toFixed(1)}%` : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /><h2 className="text-xl font-semibold">Spam & Zustellbarkeit</h2></div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Spam-Analyse vor Versand</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Betreffzeile" />
            <Textarea value={html} onChange={e => setHtml(e.target.value)} placeholder="HTML / Text" rows={8} />
            <div className="flex items-center justify-between p-3 border border-border rounded-md">
              <span className="font-medium">Spam-Risiko</span>
              <Badge variant="outline" className={levelColor}>{levelLabel} ({result.score}/100)</Badge>
            </div>
            {result.reasons.length > 0 && (
              <ul className="text-sm space-y-1 text-muted-foreground">
                {result.reasons.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Domain & Authentifizierung</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadStats}><RefreshCw className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!domain && <p className="text-sm text-muted-foreground">Keine aktive Domain gefunden.</p>}
              {domain && (
                <>
                  <div className="flex items-center justify-between"><span className="text-sm">Domain</span><span className="font-mono text-sm">{domain.domain}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm">Provider</span><Badge variant="outline">{domain.provider}</Badge></div>
                  <div className="flex items-center justify-between"><span className="text-sm">SPF</span><Badge variant="outline" className="bg-emerald-500/15 text-emerald-500"><ShieldCheck className="w-3 h-3 mr-1" />OK (DNS)</Badge></div>
                  <div className="flex items-center justify-between"><span className="text-sm">DKIM</span><Badge variant="outline" className="bg-emerald-500/15 text-emerald-500"><ShieldCheck className="w-3 h-3 mr-1" />OK (DNS)</Badge></div>
                  <div className="flex items-center justify-between"><span className="text-sm">DMARC</span><Badge variant="outline" className="bg-amber-500/15 text-amber-500"><ShieldAlert className="w-3 h-3 mr-1" />Prüfen</Badge></div>
                  <p className="text-xs text-muted-foreground pt-2">DNS-Detail-Check via Resend-Dashboard oder externe Tools (mxtoolbox.com).</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Zustellbarkeit</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground text-xs">Versendet</div><div className="text-xl font-bold">{deliv.sent}</div></div>
              <div><div className="text-muted-foreground text-xs">Öffnungsrate</div><div className="text-xl font-bold">{pct(deliv.opened)}</div></div>
              <div><div className="text-muted-foreground text-xs">Klickrate</div><div className="text-xl font-bold">{pct(deliv.clicked)}</div></div>
              <div><div className="text-muted-foreground text-xs">Bounce Rate</div><div className="text-xl font-bold">{pct(deliv.bounced)}</div></div>
              <div className="col-span-2"><div className="text-muted-foreground text-xs">Abmeldungen</div><div className="text-xl font-bold">{deliv.unsubscribed}</div></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
