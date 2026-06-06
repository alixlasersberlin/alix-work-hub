import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Ticket, Search, ArrowRight, Loader2 } from 'lucide-react';

interface TicketRow {
  id: string;
  external_ticket_id: string | null;
  source_system: string | null;
  customer_name: string | null;
  company_name: string | null;
  order_number: string | null;
  device_name: string | null;
  serial_number: string | null;
  title: string | null;
  status: string;
  priority: string;
  department: string;
  last_synced_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ['offen', 'in_bearbeitung', 'wartet_kunde', 'gelöst', 'geschlossen'];
const PRIORITY_OPTIONS = ['niedrig', 'normal', 'hoch', 'kritisch'];
const DEPARTMENT_OPTIONS = ['service', 'technik', 'finance', 'tourenplanung', 'lieferung', 'abholung', 'austausch'];

function statusColor(s: string) {
  switch (s) {
    case 'offen': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'in_bearbeitung': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'wartet_kunde': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'gelöst': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'geschlossen': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}
function priorityColor(p: string) {
  switch (p) {
    case 'kritisch': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'hoch': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'normal': return 'bg-muted text-muted-foreground border-border';
    case 'niedrig': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export default function TicketsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState<string>('all');
  const [prioF, setPrioF] = useState<string>('all');
  const [deptF, setDeptF] = useState<string>('all');
  const [sourceF, setSourceF] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tickets')
        .select('id, external_ticket_id, source_system, customer_name, company_name, order_number, device_name, serial_number, title, status, priority, department, last_synced_at, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!cancelled) {
        if (error) console.error(error);
        setRows((data as TicketRow[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusF !== 'all' && r.status !== statusF) return false;
      if (prioF !== 'all' && r.priority !== prioF) return false;
      if (deptF !== 'all' && r.department !== deptF) return false;
      if (sourceF !== 'all' && r.source_system !== sourceF) return false;
      if (!q) return true;
      const hay = [r.customer_name, r.company_name, r.order_number, r.device_name, r.serial_number, r.title, r.external_ticket_id]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusF, prioF, deptF, sourceF]);

  const sources = useMemo(() => Array.from(new Set(rows.map(r => r.source_system).filter(Boolean))) as string[], [rows]);

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Ticket className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Tickets</h1>
        <Badge variant="outline" className="ml-2">{filtered.length}</Badge>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-4 grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche Kunde, Gerät, Seriennr., Auftragsnr., Titel..." className="pl-9" />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={prioF} onValueChange={setPrioF}>
          <SelectTrigger><SelectValue placeholder="Priorität" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {PRIORITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptF} onValueChange={setDeptF}>
          <SelectTrigger><SelectValue placeholder="Abteilung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Abteilungen</SelectItem>
            {DEPARTMENT_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceF} onValueChange={setSourceF}>
          <SelectTrigger><SelectValue placeholder="Quelle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Keine Tickets gefunden.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Gerät</TableHead>
                <TableHead>Seriennr.</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Letzter Sync</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow
                  key={r.id}
                  onClick={() => navigate(`/tickets/${r.id}`)}
                  className="cursor-pointer hover:bg-muted/40"
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{r.title || r.external_ticket_id || r.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{r.external_ticket_id || r.source_system}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.customer_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.company_name || ''}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.device_name || '—'}</TableCell>
                  <TableCell className="text-sm font-mono">{r.serial_number || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{r.department}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={priorityColor(r.priority)}>{r.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.last_synced_at ? new Date(r.last_synced_at).toLocaleString('de-DE') : '—'}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/tickets/${r.id}`}>Details <ArrowRight className="w-3 h-3 ml-1" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
