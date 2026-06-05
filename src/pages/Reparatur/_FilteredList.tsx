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
        .select('id,repair_number,repair_status,customer_name,device_category,device_brand,device_model,device_serial_number,created_at')
        .in('repair_status', statusFilter)
        .order('created_at', { ascending: false })
        .limit(500);
      setRows(data || []);
      setLoading(false);
    })();
  }, [statusFilter.join('|')]);

  return (
    <Card className="overflow-hidden">
      <div className="p-3 border-b border-border text-sm font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Reparaturnr.</th>
              <th className="text-left px-3 py-2">Kunde</th>
              <th className="text-left px-3 py-2">Gerät</th>
              <th className="text-left px-3 py-2">Seriennr.</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Angelegt</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Lade…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">{emptyText || 'Keine Einträge'}</td></tr>}
            {rows.map((r) => {
              const device = [r.device_brand, r.device_model].filter(Boolean).join(' ') || r.device_category || '–';
              return (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2"><Link to={`/reparatur/${r.id}`} className="text-primary hover:underline font-mono">{r.repair_number}</Link></td>
                  <td className="px-3 py-2">{r.customer_name || '–'}</td>
                  <td className="px-3 py-2">{device}</td>
                  <td className="px-3 py-2 text-xs font-mono">{r.device_serial_number || '–'}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE_CLASS[r.repair_status] || 'bg-muted'}`}>{r.repair_status}</span></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('de-DE')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
