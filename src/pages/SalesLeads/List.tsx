import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Inbox, Search, Filter, UserCheck, Pencil } from 'lucide-react';
import { toast } from 'sonner';

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
  lead_number: string | null;
  device_category: string | null;
  additional_services: any;
  customer_goal: string | null;
  implementation_period: string | null;
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
  service_rating: number | null;
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
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  async function loadLeads() {
    const { data } = await supabase
      .from('sales_leads')
      .select('id, created_at, external_id, source, form_name, lead_number, device_category, additional_services, customer_goal, implementation_period, first_name, last_name, company, email, phone, requested_products, lead_status, assigned_user, lead_score, score_category, consultation_type, delivery_preference, service_rating')
      .order('created_at', { ascending: false })
      .limit(500);
    setRows((data ?? []) as Lead[]);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadLeads();
      const { data: u } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      setUsers((u ?? []) as any);
      setLoading(false);
    })();
  }, []);

  async function assign(leadId: string, userId: string) {
    setAssigning(leadId);
    const value = userId === '__none' ? null : userId;
    const { error } = await supabase.from('sales_leads').update({ assigned_user: value }).eq('id', leadId);
    setAssigning(null);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.map(x => x.id === leadId ? { ...x, assigned_user: value } : x));
    toast.success(value ? 'Anfrage zugewiesen' : 'Zuweisung entfernt');
  }

  const userLabel = (id: string | null) => {
    if (!id) return null;
    const u = users.find(x => x.id === id);
    return u?.full_name || u?.email || id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'alle' && r.lead_status !== status) return false;
      if (source !== 'alle' && r.source !== source) return false;
      if (!q) return true;
      return [
        r.lead_number, r.company, r.first_name, r.last_name, r.email, r.phone,
        r.requested_products, r.form_name, r.device_category, r.customer_goal,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, status, source]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Verkaufsanfragen</h1>
            <p className="text-sm text-muted-foreground">Leads aus Zoho Forms, Website, Telefon, WhatsApp und API</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/verkauf/anfragen/dashboard" className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted/30">Dashboard</Link>
          <Link to="/verkauf/anfragen/import" className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted/30">CSV-Import</Link>
          <Link to="/verkauf/anfragen/neu" className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90">+ Neue Anfrage</Link>
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
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="phone">Telefon</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="csv">CSV-Import</SelectItem>
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
                <th className="p-3">Lead-Nr.</th>
                <th className="p-3">Score</th>
                <th className="p-3">Firma / Kontakt</th>
                <th className="p-3">E-Mail / Telefon</th>
                <th className="p-3">Geräteklasse</th>
                <th className="p-3">Zeitraum</th>
                <th className="p-3">Bewertung</th>
                <th className="p-3">Quelle</th>
                <th className="p-3">Status</th>
                <th className="p-3">Zugewiesen an</th>
                <th className="p-3 text-right">Aktion</th>
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
                  <td className="p-3 font-mono text-xs">
                    <Link to={`/verkauf/anfragen/${r.id}`} className="text-primary hover:underline">
                      {r.lead_number || '—'}
                    </Link>
                  </td>
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
                  <td className="p-3">
                    <div className="font-medium">
                      <Link to={`/verkauf/anfragen/${r.id}`} className="text-primary hover:underline">
                        {r.company || [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                      </Link>
                    </div>
                    {r.company && (r.first_name || r.last_name) && (
                      <div className="text-xs text-muted-foreground">{[r.first_name, r.last_name].filter(Boolean).join(' ')}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {r.email && <div>{r.email}</div>}
                    {r.phone && <div className="text-muted-foreground">{r.phone}</div>}
                  </td>
                  <td className="p-3">{r.device_category || r.requested_products || '—'}</td>
                  <td className="p-3 whitespace-nowrap">{r.implementation_period || '—'}</td>
                  <td className="p-3">{r.service_rating ? '★'.repeat(r.service_rating) : '—'}</td>
                  <td className="p-3 text-muted-foreground">{r.form_name || r.source}</td>
                  <td className="p-3"><Badge variant={statusVariant(r.lead_status)}>{r.lead_status}</Badge></td>
                  <td className="p-3">
                    <Select
                      value={r.assigned_user ?? '__none'}
                      onValueChange={(v) => assign(r.id, v)}
                      disabled={assigning === r.id}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{userLabel(r.assigned_user) || 'Zuweisen …'}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Nicht zugewiesen —</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email || u.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
