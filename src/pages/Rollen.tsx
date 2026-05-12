import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, Users } from 'lucide-react';

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  user_count?: number;
}

export default function Rollen() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: rs } = await supabase.from('roles').select('*').order('name');
      const { data: urs } = await supabase.from('user_roles').select('role_id');
      const counts = (urs ?? []).reduce<Record<string, number>>((acc, r: any) => {
        acc[r.role_id] = (acc[r.role_id] ?? 0) + 1;
        return acc;
      }, {});
      setRoles((rs ?? []).map((r: any) => ({ ...r, user_count: counts[r.id] ?? 0 })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rollen</h1>
          <p className="text-sm text-muted-foreground">
            Übersicht aller verfügbaren Systemrollen und ihrer Zuweisungen.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{r.name}</CardTitle>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    {r.user_count}
                  </Badge>
                </div>
                {r.description && <CardDescription>{r.description}</CardDescription>}
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Rollen-ID: <code className="text-[10px]">{r.id}</code>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
