import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Bucket { id: string; name: string; public: boolean; file_size_limit: number | null; allowed_mime_types: string[] | null }

export default function SecurityStorage() {
  const [rows, setRows] = useState<Bucket[]>([]);
  useEffect(() => { (async () => {
    const { data } = await (supabase as any).schema('storage').from('buckets').select('id, name, public, file_size_limit, allowed_mime_types').order('public', { ascending: false });
    setRows((data ?? []) as Bucket[]);
  })(); }, []);

  const publicCount = rows.filter(r => r.public).length;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Storage-Sicherheit — {rows.length} Buckets, {publicCount} öffentlich</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-left"><tr>
              <th className="p-2">Bucket</th>
              <th className="p-2">Sichtbarkeit</th>
              <th className="p-2">Max-Größe</th>
              <th className="p-2">MIME-Whitelist</th>
            </tr></thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 font-mono">{b.id}</td>
                  <td className="p-2">
                    {b.public
                      ? <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/40">Öffentlich</Badge>
                      : <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">Privat</Badge>}
                  </td>
                  <td className="p-2">{b.file_size_limit ? `${(b.file_size_limit / (1024 * 1024)).toFixed(0)} MB` : '—'}</td>
                  <td className="p-2 text-muted-foreground text-[11px]">{b.allowed_mime_types?.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
