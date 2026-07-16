import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Mail, Globe } from 'lucide-react';

export default function AlixIdKonto() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke('alix-id-userinfo', { body: {} });
      setData(data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return <div>Konnte Konto nicht laden.</div>;

  const id = data.identity ?? {};
  const orgs = data.organizations ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Mein Konto</h1>
        <p className="text-sm text-muted-foreground">Zentrale Stammdaten Ihrer Alix-ID.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Identität</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={id.display_name ?? '—'} />
          <Row label="E-Mail" value={id.email ?? '—'} icon={Mail} />
          <Row label="Sprache" value={id.preferred_language?.toUpperCase() ?? 'DE'} icon={Globe} />
          <Row label="Kontotyp" value={id.account_type ?? 'customer'} />
          <Row label="Letzter Login" value={id.last_login_at ? new Date(id.last_login_at).toLocaleString('de-DE') : '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Organisationen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {orgs.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Organisation zugeordnet.</p>}
          {orgs.map((o: any) => {
            const org = o.organization ?? {};
            return (
              <div key={o.id} className="flex items-center justify-between border border-border/60 rounded-md p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{org.display_name ?? org.legal_name ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.relationship_type}{org.country ? ` · ${org.country}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {o.is_primary && <Badge variant="secondary" className="text-[10px]">Primär</Badge>}
                  <Badge variant="outline" className="text-[10px]">{o.relationship_status}</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Änderungen an Firmenname, Adresse oder Zuordnung erfolgen ausschließlich durch Alix Lasers.
        Bitte wenden Sie sich bei Änderungswünschen an Ihren Ansprechpartner.
      </p>
    </div>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="w-4 h-4" />} {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
