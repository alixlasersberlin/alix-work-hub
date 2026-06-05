import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { REPAIR_STATUSES, STATUS_BADGE_CLASS } from '@/lib/repair/constants';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

type Row = {
  id: string;
  repair_number: string;
  status: string;
  priority: string;
  customer_company: string | null;
  customer_contact: string | null;
  device_type: string | null;
  serial_number: string | null;
  acceptance_date: string | null;
  created_at: string;
};

export default function ReparaturList({ archived = false }: { archived?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await sbRepair
        .from('repair_orders')
        .select('id,repair_number,status,priority,customer_company,customer_contact,device_type,serial_number,acceptance_date,created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (archived) {
        if (!['Abgeschlossen', 'Storniert', 'Ausgeliefert'].includes(r.status)) return false;
      } else {
        if (['Abgeschlossen', 'Storniert'].includes(r.status)) return false;
      }
      if (status !== 'all' && r.status !== status) return false;
      if (priority !== 'all' && r.priority !== priority) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const hay = [r.repair_number, r.customer_company, r.customer_contact, r.device_type, r.serial_number]
          .map((x) => (x || '').toLowerCase())
          .join(' ');
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, q, status, priority, archived]);

  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-col md:flex-row gap-3">
        <Input placeholder="Suche: Nummer, Kunde, Gerät, Seriennr…" value={q} onChange={(e) => setQ(e.target.value)} className="md:w-80" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-64"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Priorität" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {['Normal','Eilig','Garantie','Kulanz','Kostenpflichtig'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground self-center ml-auto">{filtered.length} Einträge</div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Reparaturnr.</th>
                <th className="text-left px-3 py-2">Kunde</th>
                <th className="text-left px-3 py-2">Gerät</th>
                <th className="text-left px-3 py-2">Seriennr.</th>
                <th className="text-left px-3 py-2">Priorität</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Annahme</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Lade…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Keine Einträge</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link to={`/reparatur/${r.id}`} className="text-primary hover:underline font-mono">
                      {r.repair_number || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.customer_company || r.customer_contact || '–'}</td>
                  <td className="px-3 py-2">{r.device_type || '–'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.serial_number || '–'}</td>
                  <td className="px-3 py-2">{r.priority}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[r.status] || 'bg-muted text-foreground'}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.acceptance_date || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
