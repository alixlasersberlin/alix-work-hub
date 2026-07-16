import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Org = {
  id: string; legal_name: string; display_name: string | null; organization_type: string;
  linked_customer_id: string | null; tenant_id: string | null; country: string | null;
  status: string; created_at: string;
};

export default function IdAdminOrganizations() {
  const [rows, setRows] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('alix_organizations')
        .select('id, legal_name, display_name, organization_type, linked_customer_id, tenant_id, country, status, created_at')
        .order('created_at', { ascending: false }).limit(500);
      setRows((data ?? []) as Org[]);
      setLoading(false);
    })();
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle>Organisationen</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Typ</th><th className="py-2 pr-4">Kunde</th><th className="py-2 pr-4">Mandant</th><th className="py-2 pr-4">Land</th><th className="py-2 pr-4">Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 font-medium">{r.display_name ?? r.legal_name}</td>
                    <td className="py-2 pr-4">{r.organization_type}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{r.linked_customer_id ?? '—'}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">{r.tenant_id ?? '—'}</td>
                    <td className="py-2 pr-4">{r.country ?? '—'}</td>
                    <td className="py-2 pr-4"><Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Keine Organisationen.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
