import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Inbox, Search, Filter } from 'lucide-react';

const STATUS_OPTIONS = [
  'Importiert - Angebot offen',
  'Neu',
  'In Bearbeitung',
  'Angebot erstellt',
  'Nachfassen',
  'Gewonnen',
  'Verloren',
  'Archiviert',
];

type Lead = {
  id: string;
  created_at: string;
  external_id: string | null;
  source: string;
  form_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  requested_products: string | null;
  lead_status: string;
  assigned_user: string | null;
  lead_score: number | null;
  score_category: string | null;
  consultation_type: string | null;
  delivery_preference: string | null;
};

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'Gewonnen') return 'default';
  if (s === 'Verloren' || s === 'Archiviert') return 'destructive';
  if (s === 'Angebot erstellt' || s === 'In Bearbeitung') return 'secondary';
  return 'outline';
}

export default function SalesLeadsList() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('alle');
  const [source, setSource] = useState<string>('alle');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('sales_leads')
        .select('id, created_at, external_id, source, form_name, first_name, last_name, company, email, phone, requested_products, lead_status, assigned_user, lead_score, score_category, consultation_type, delivery_preference')
        .order('created_at', { ascending: false })
        .limit(500);
      setRows((data ?? []) as Lead[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'alle' && r.lead_status !== status) return false;
      if (source !== 'alle' && r.source !== source) return false;
      if (!q) return true;
      return [
        r.company, r.first_name, r.last_name, r.email, r.phone, r.requested_products, r.form_name,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, status, source]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Anfragen</h1>
          <p className="text-sm text-muted-foreground">Importierte Vertriebsanfragen (Zoho Forms)</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche Firma, Name, E-Mail, Produkt …"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Status</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Quelle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Quellen</SelectItem>
                <SelectItem value="zoho_forms">Zoho Forms</SelectItem>
                <SelectItem value="manual">Manuell</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Datum</th>
                <th className="p-3">Score</th>
                <th className="p-3">Firma</th>
                <th className="p-3">Ansprechpartner</th>
                <th className="p-3">E-Mail</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Produktinteresse</th>
                <th className="p-3">Beratung</th>
                <th className="p-3">Lieferung</th>
                <th className="p-3">Quelle</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Lade …</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Keine Anfragen gefunden.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                  <td className="p-3">
                    {r.lead_score != null ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                        r.lead_score >= 85 ? 'bg-red-500/20 text-red-400'
                        : r.lead_score >= 70 ? 'bg-orange-500/20 text-orange-400'
                        : r.lead_score >= 45 ? 'bg-yellow-500/20 text-yellow-500'
                        : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {r.lead_score} {r.score_category && `· ${r.score_category}`}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="p-3 font-medium">
                    <Link to={`/verkauf/anfragen/${r.id}`} className="text-primary hover:underline">
                      {r.company || '—'}
                    </Link>
                  </td>
                  <td className="p-3">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="p-3">{r.email || '—'}</td>
                  <td className="p-3">{r.phone || '—'}</td>
                  <td className="p-3">{r.requested_products || '—'}</td>
                  <td className="p-3">{r.consultation_type || '—'}</td>
                  <td className="p-3">{r.delivery_preference || '—'}</td>
                  <td className="p-3 text-muted-foreground">{r.form_name || r.source}</td>
                  <td className="p-3"><Badge variant={statusVariant(r.lead_status)}>{r.lead_status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
