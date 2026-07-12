import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Bucket { id: string; name: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }
interface Audit { id: string; public: boolean; policy_count: number; status: 'public' | 'no_policies' | 'ok' }

const STATUS_BADGE: Record<Audit['status'], string> = {
  public: 'bg-red-500/15 text-red-300 border-red-500/40',
  no_policies: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  ok: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
};

const STATUS_LABEL: Record<Audit['status'], string> = {
  public: 'Öffentlich',
  no_policies: 'Keine Policies',
  ok: 'OK',
};

export default function SecurityStorage() {
  const [rows, setRows] = useState<Bucket[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  useEffect(() => { (async () => {
    const [b, a] = await Promise.all([
      (supabase as any).schema('storage').from('buckets').select('id, name, public, file_size_limit, allowed_mime_types').order('public', { ascending: false }),
      (supabase as any).from('security_scan_bucket_audit').select('*'),
    ]);
    setRows((b.data ?? []) as Bucket[]);
    setAudit((a.data ?? []) as Audit[]);
  })(); }, []);

  const auditMap = new Map(audit.map(a => [a.id, a]));
  const publicCount = rows.filter(r => r.public).length;
  const noPolicyCount = audit.filter(a => a.status === 'no_policies').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Storage-Sicherheit — {rows.length} Buckets, {publicCount} öffentlich, {noPolicyCount} ohne Policies
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-2">Bucket</th>
              <th className="p-2">Status</th>
              <th className="p-2">Policies</th>
              <th className="p-2">Max-Größe</th>
              <th className="p-2">MIME-Whitelist</th>
            </tr></thead>
            <tbody>
              {rows.map(b => {
                const a = auditMap.get(b.id);
                const status = a?.status ?? (b.public ? 'public' : 'ok');
                return (
                  <tr key={b.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-mono">{b.id}</td>
                    <td className="p-2">
                      <Badge variant="outline" className={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
                    </td>
                    <td className="p-2 tabular-nums">{a?.policy_count ?? 0}</td>
                    <td className="p-2">{b.file_size_limit ? `${(b.file_size_limit / (1024 * 1024)).toFixed(0)} MB` : '—'}</td>
                    <td className="p-2 text-muted-foreground text-[11px]">{b.allowed_mime_types?.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
