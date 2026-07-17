import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileSignature, Search, Plus, ShieldCheck, Activity, Users } from 'lucide-react';


type Row = {
  id: string; title: string; document_type: string; status: string;
  created_at: string; completed_at: string | null; version: number;
};

const statusBadge: Record<string, string> = {
  neu: 'bg-muted text-muted-foreground',
  in_bearbeitung: 'bg-blue-500/20 text-blue-500',
  versendet: 'bg-amber-500/20 text-amber-500',
  geoeffnet: 'bg-cyan-500/20 text-cyan-500',
  teilweise_signiert: 'bg-purple-500/20 text-purple-500',
  signiert: 'bg-emerald-500/20 text-emerald-500',
  abgelehnt: 'bg-red-500/20 text-red-500',
  abgelaufen: 'bg-orange-500/20 text-orange-500',
  archiviert: 'bg-slate-500/20 text-slate-500',
  ungueltig: 'bg-red-700/20 text-red-700',
};

export default function DigitaleSignaturen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [kpi, setKpi] = useState({ today: 0, open: 0, declined: 0, waiting: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sig_documents')
        .select('id,title,document_type,status,created_at,completed_at,version')
        .order('created_at', { ascending: false }).limit(200);
      const list = (data || []) as Row[];
      setRows(list);
      const today = new Date().toISOString().slice(0, 10);
      setKpi({
        today: list.filter((r) => r.completed_at && r.completed_at.startsWith(today)).length,
        open: list.filter((r) => ['versendet', 'geoeffnet', 'teilweise_signiert', 'neu', 'in_bearbeitung'].includes(r.status)).length,
        declined: list.filter((r) => r.status === 'abgelehnt').length,
        waiting: list.filter((r) => ['versendet', 'geoeffnet'].includes(r.status)).length,
      });
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase()) || r.document_type.toLowerCase().includes(q.toLowerCase()));

  return (
    
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileSignature className="w-6 h-6 text-primary" /> Digitale Signaturen
            </h1>
            <p className="text-sm text-muted-foreground">Signaturanfragen erstellen, überwachen und archivieren</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/signaturen')}>
              <ShieldCheck className="w-4 h-4 mr-2" /> Admin
            </Button>
            <Button onClick={() => navigate('/signaturen/neu')}>
              <Plus className="w-4 h-4 mr-2" /> Neue Anfrage
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Heute signiert', v: kpi.today, c: 'text-emerald-500' },
            { l: 'Offen', v: kpi.open, c: 'text-amber-500' },
            { l: 'Warten auf Kunde', v: kpi.waiting, c: 'text-cyan-500' },
            { l: 'Abgelehnt', v: kpi.declined, c: 'text-red-500' },
          ].map((k) => (
            <Card key={k.l}><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.l}</div>
              <div className={`text-3xl font-bold ${k.c}`}>{k.v}</div>
            </CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Anfragen</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche…" className="pl-8 h-9" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> lädt …
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Keine Signaturanfragen</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 px-2">Titel</th>
                      <th className="py-2 px-2">Typ</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Version</th>
                      <th className="py-2 px-2">Erstellt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/signaturen/${r.id}`)}>
                        <td className="py-2 px-2 font-medium">{r.title}</td>
                        <td className="py-2 px-2">{r.document_type}</td>
                        <td className="py-2 px-2">
                          <Badge className={statusBadge[r.status] || ''} variant="outline">{r.status}</Badge>
                        </td>
                        <td className="py-2 px-2">v{r.version}</td>
                        <td className="py-2 px-2 text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    
  );
}
