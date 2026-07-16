import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Ban, Play } from 'lucide-react';
import { toast } from 'sonner';

type Identity = {
  id: string; auth_user_id: string; display_name: string | null; primary_email: string;
  account_type: string; account_status: string; preferred_language: string | null;
  last_login_at: string | null; created_at: string;
};

export default function IdAdminIdentities() {
  const [rows, setRows] = useState<Identity[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from('alix_identities')
      .select('id, auth_user_id, display_name, primary_email, account_type, account_status, preferred_language, last_login_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (q.trim()) query = query.or(`display_name.ilike.%${q.trim()}%,primary_email.ilike.%${q.trim()}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message); else setRows((data ?? []) as Identity[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const action = async (identity_id: string, kind: 'suspend' | 'reactivate') => {
    setActing(identity_id);
    const { error } = await supabase.functions.invoke('alix-id-admin', {
      body: { action: kind === 'suspend' ? 'suspend_identity' : 'reactivate_identity', identity_id, reason: kind === 'suspend' ? 'admin_ui' : undefined },
    });
    setActing(null);
    if (error) toast.error(error.message); else { toast.success(kind === 'suspend' ? 'Identität gesperrt.' : 'Identität freigegeben.'); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Identitäten</CardTitle>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name suchen…" className="pl-8 h-9 w-64" />
          </div>
          <Button type="submit" size="sm" variant="outline">Suchen</Button>
        </form>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">E-Mail</th>
                  <th className="py-2 pr-4">Typ</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Sprache</th>
                  <th className="py-2 pr-4">Letzter Login</th>
                  <th className="py-2 pr-4">Erstellt</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 font-medium">{r.display_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.primary_email}</td>
                    <td className="py-2 pr-4">{r.account_type}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={r.account_status === 'active' ? 'default' : 'destructive'}>{r.account_status}</Badge>
                    </td>
                    <td className="py-2 pr-4">{r.preferred_language ?? '—'}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.last_login_at ? new Date(r.last_login_at).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      {r.account_status === 'active' ? (
                        <Button size="sm" variant="outline" disabled={acting === r.id} onClick={() => action(r.id, 'suspend')}>
                          <Ban className="w-3 h-3 mr-1" /> Sperren
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={acting === r.id} onClick={() => action(r.id, 'reactivate')}>
                          <Play className="w-3 h-3 mr-1" /> Freigeben
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Keine Identitäten gefunden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
