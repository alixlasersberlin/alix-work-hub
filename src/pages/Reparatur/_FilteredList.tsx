import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sbRepair } from '@/lib/repair/api';
import { STATUS_BADGE_CLASS } from '@/lib/repair/constants';
import { Card } from '@/components/ui/card';

type Props = {
  title: string;
  emptyText?: string;
  statusFilter: string[];
};

export function RepairFilteredList({ title, emptyText, statusFilter }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await sbRepair
        .from('repair_orders')
        .select('id,repair_number,status,priority,customer_company,customer_contact,device_type,serial_number,created_at')
        .in('status', statusFilter)
        .order('created_at', { ascending: false })
        .limit(500);
      setRows(data || []);
      setLoading(false);
    })();
  }, [statusFilter.join('|')]);

  return (
    <Card className="overflow-hidden">
      <div className="p-3 border-b border-border text-sm font-semibold">{title}</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Reparaturnr.</th>
            <th className="text-left px-3 py-2">Kunde</th>
            <th className="text-left px-3 py-2">Gerät</th>
            <th className="text-left px-3 py-2">Seriennr.</th>
            <th className="text-left px-3 py-2">Priorität</th>
            <th className="text-left px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Lade…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">{emptyText || 'Keine Einträge'}</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-3 py-2"><Link to={`/reparatur/${r.id}`} className="text-primary hover:underline font-mono">{r.repair_number}</Link></td>
              <td className="px-3 py-2">{r.customer_company || r.customer_contact || '–'}</td>
              <td className="px-3 py-2">{r.device_type || '–'}</td>
              <td className="px-3 py-2 text-xs font-mono">{r.serial_number || '–'}</td>
              <td className="px-3 py-2">{r.priority}</td>
              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[r.status] || 'bg-muted'}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
