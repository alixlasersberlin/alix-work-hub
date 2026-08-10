import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import { findDuplicateGroups, DuplicateGroup } from '@/lib/plm/manufacturers';
import { useAuth } from '@/hooks/useAuth';

const WRITE_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung', 'Medical', 'Produktion', 'QM'];

export default function PlmHerstellerDubletten() {
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => WRITE_ROLES.includes(r));
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('plm_manufacturers' as any) as any)
      .select('id,name,short_name,name_normalized,country,approval_status').limit(2000);
    if (error) toast.error(error.message);
    setGroups(findDuplicateGroups((data as any[]) || []));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function mergeInto(target: any, sources: any[]) {
    if (!confirm(`${sources.length} Hersteller in „${target.name}“ zusammenführen?`)) return;
    setBusy(true);
    for (const s of sources) {
      const { error } = await (supabase.rpc as any)('plm_merge_manufacturers', { p_target: target.id, p_source: s.id });
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    setBusy(false);
    toast.success('Hersteller zusammengeführt');
    load();
  }

  return (
    <div className="container max-w-[1400px] py-6 space-y-6">
      <PageHeader icon={Copy} title="Hersteller-Dubletten" subtitle="KI-gestützte Erkennung möglicherweise identischer Hersteller (z. B. „Mean Well“ / „MEAN WELL“ / „Taiwan MeanWell“)." noBreadcrumbs />

      {loading ? (
        <div className="p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !groups.filter(g => !ignored.includes(g.key)).length ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Keine Dubletten gefunden.</CardContent></Card>
      ) : groups.filter(g => !ignored.includes(g.key)).map(g => (
        <Card key={g.key}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Möglicherweise identischer Hersteller
              <Badge variant="outline" className="ml-2 border-amber-500/40 text-amber-500">{Math.round(g.score * 100)}% Übereinstimmung</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setIgnored(s => [...s, g.key])}>Ignorieren</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {g.rows.map(r => (
              <div key={r.id} className="flex items-center gap-3 border border-border rounded-md p-3">
                <div className="flex-1 text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{[r.short_name, r.country].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                {canWrite && (
                  <Button size="sm" disabled={busy} onClick={() => mergeInto(r, g.rows.filter(x => x.id !== r.id))}>
                    Als Haupt-Hersteller zusammenführen
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
