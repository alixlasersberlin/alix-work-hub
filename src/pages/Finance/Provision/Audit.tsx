import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { DataCard } from '@/components/PageShell';
import { EmptyState } from '@/components/infinity/EmptyState';
import { Input } from '@/components/ui/input';
import { History } from 'lucide-react';

export default function ProvisionAudit() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('commission_audit_logs').select('*').order('created_at', { ascending: false }).limit(1000);
      setRows(data ?? []);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    const s = search.trim().toLowerCase();
    return !s || [r.action, r.object_type, r.user_name, r.reason].filter(Boolean).some((v: string) => v.toLowerCase().includes(s));
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader title="Provisions-Audit" subtitle="Lückenlose Historie aller Änderungen, Freigaben, Stornos und Auszahlungen" icon={History} />
      <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <DataCard className="p-0">
        <div className="p-5">
          {filtered.length === 0 ? (
            <EmptyState icon={History} title="Keine Audit-Einträge" description="Sobald Provisionen bearbeitet werden, erscheinen hier alle Vorgänge." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Zeitpunkt</th>
                    <th className="p-3 text-left">Aktion</th>
                    <th className="p-3 text-left">Objekt</th>
                    <th className="p-3 text-left">Benutzer</th>
                    <th className="p-3 text-left">Grund</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                      <td className="p-3">{r.action}</td>
                      <td className="p-3">{r.object_type ?? '–'}</td>
                      <td className="p-3">{r.user_name ?? '–'}</td>
                      <td className="p-3">{r.reason ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataCard>
    </div>
  );
}
