import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Activity, Clock, TrendingUp, AlertTriangle, FileSignature } from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  signiert: '#10b981', versendet: '#f59e0b', geoeffnet: '#06b6d4',
  teilweise_signiert: '#a855f7', abgelehnt: '#ef4444', abgelaufen: '#f97316',
  neu: '#94a3b8', in_bearbeitung: '#3b82f6', archiviert: '#64748b', ungueltig: '#7f1d1d',
};

export default function DigitaleSignaturenCockpit() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const [d, a] = await Promise.all([
        supabase.from('sig_documents')
          .select('id, title, document_type, status, created_at, completed_at, version')
          .gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('sig_audit_log')
          .select('event, created_at, document_id, details')
          .gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      ]);
      setDocs(d.data || []);
      setAudit(a.data || []);
      setLoading(false);
    })();
  }, []);

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    docs.forEach((d) => { m[d.status] = (m[d.status] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [docs]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    docs.forEach((d) => { m[d.document_type] = (m[d.document_type] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 10);
  }, [docs]);

  const timeline = useMemo(() => {
    // last 30 days: created vs signed per day
    const days: Record<string, { day: string; created: number; signed: number }> = {};
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      days[d] = { day: d.slice(5), created: 0, signed: 0 };
    }
    docs.forEach((d) => {
      const c = d.created_at?.slice(0, 10); if (days[c]) days[c].created++;
      const s = d.completed_at?.slice(0, 10); if (s && days[s]) days[s].signed++;
    });
    return Object.values(days);
  }, [docs]);

  const avgTimeToSign = useMemo(() => {
    const durations = docs
      .filter((d) => d.completed_at && d.created_at)
      .map((d) => (new Date(d.completed_at).getTime() - new Date(d.created_at).getTime()) / 3600000);
    if (!durations.length) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [docs]);

  const signedRate = docs.length ? Math.round(docs.filter((d) => d.status === 'signiert').length / docs.length * 100) : 0;
  const stalled = docs.filter((d) => ['versendet', 'geoeffnet'].includes(d.status)
    && (Date.now() - new Date(d.created_at).getTime()) > 7 * 86400000);

  const eventLabel: Record<string, string> = {
    request_created: 'Anfrage erstellt', opened: 'Geöffnet', email_sent: 'E-Mail gesendet',
    signed_complete: 'Signiert', signed_partial: 'Teilweise signiert', declined: 'Abgelehnt',
    reminder_sent: 'Erinnerung', expired: 'Abgelaufen', final_pdf_rendered: 'Finale PDF gerendert',
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/signaturen')}><ArrowLeft className="w-4 h-4 mr-2" />Zurück</Button>
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Signatur-Cockpit</h1>
          <Badge variant="outline">letzte 90 Tage</Badge>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Lädt …</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3" /> Abschlussrate</div>
              <div className="text-3xl font-bold text-emerald-500">{signedRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">{docs.filter((d) => d.status === 'signiert').length} / {docs.length} Dokumente</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> Ø Zeit bis Signatur</div>
              <div className="text-3xl font-bold text-cyan-500">
                {avgTimeToSign == null ? '—' : avgTimeToSign < 24 ? `${avgTimeToSign.toFixed(1)}h` : `${(avgTimeToSign / 24).toFixed(1)}d`}
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="w-3 h-3" /> Volumen</div>
              <div className="text-3xl font-bold">{docs.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Anfragen letzte 90 Tage</div>
            </CardContent></Card>
            <Card className={stalled.length ? 'border-amber-500/60' : ''}><CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="w-3 h-3" /> Ins Stocken geraten</div>
              <div className="text-3xl font-bold text-amber-500">{stalled.length}</div>
              <div className="text-xs text-muted-foreground mt-1">offen &gt; 7 Tage</div>
            </CardContent></Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Volumen &amp; Abschlüsse (30 Tage)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeline}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} name="Erstellt" />
                    <Line type="monotone" dataKey="signed" stroke="#10b981" strokeWidth={2} name="Signiert" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Status-Verteilung</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={80} label>
                      {byStatus.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Top Dokumenttypen</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Letzte Aktivität</CardTitle></CardHeader>
              <CardContent className="max-h-64 overflow-y-auto space-y-1">
                {audit.slice(0, 40).map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border-b py-1.5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>{eventLabel[a.event] || a.event}</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString('de-DE')}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {stalled.length > 0 && (
            <Card className="border-amber-500/40">
              <CardHeader><CardTitle className="text-sm text-amber-600">Anfragen &gt; 7 Tage ohne Signatur ({stalled.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {stalled.slice(0, 30).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded"
                      onClick={() => navigate(`/signaturen`)}>
                      <div>
                        <div className="font-medium">{d.title}</div>
                        <div className="text-xs text-muted-foreground">{d.document_type}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((Date.now() - new Date(d.created_at).getTime()) / 86400000)} Tage
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
