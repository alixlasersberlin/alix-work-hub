import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

type Tx = {
  id: string; identity_id: string; application_id: string; status: string;
  created_at: string; expires_at: string; used_at: string | null;
  redirect_uri: string;
};

export default function IdAdminSessions() {
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('alix_auth_transactions')
        .select('id, identity_id, application_id, status, created_at, expires_at, used_at, redirect_uri')
        .order('created_at', { ascending: false }).limit(200);
      setRows((data ?? []) as Tx[]);
      setLoading(false);
    })();
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle>Aktive & letzte Auth-Transaktionen</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-4">Zeit</th><th className="py-2 pr-4">Identität</th><th className="py-2 pr-4">App</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Redirect</th><th className="py-2 pr-4">IP</th><th className="py-2 pr-4">Ablauf</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.identity_id.slice(0, 8)}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.application_id.slice(0, 8)}</td>
                    <td className="py-2 pr-4"><Badge variant={r.status === 'consumed' ? 'default' : r.status === 'revoked' ? 'destructive' : 'secondary'}>{r.status}</Badge></td>
                    <td className="py-2 pr-4 text-xs truncate max-w-[280px]">{r.redirect_uri}</td>
                    <td className="py-2 pr-4 text-xs">{r.ip_address ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(r.expires_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Transaktionen.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
