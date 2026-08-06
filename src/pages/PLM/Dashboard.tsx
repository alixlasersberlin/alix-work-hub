import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Cpu, Boxes, Wrench, Factory, ListTree, Layers, FileCheck2, ClipboardCheck,
  PackageCheck, Hammer, BookOpenCheck, GitPullRequestArrow, ShieldCheck, History,
} from 'lucide-react';
import { plmLabel } from '@/lib/plm/config';

const TILES = [
  { path: '/produktion/geraete', label: 'Geräte', icon: Cpu, table: 'plm_devices' },
  { path: '/produktion/baugruppen', label: 'Baugruppen', icon: Boxes, table: 'plm_assemblies' },
  { path: '/produktion/einzelteile', label: 'Einzelteile', icon: Wrench, table: 'plm_parts' },
  { path: '/produktion/stueckliste', label: 'Stückliste', icon: ListTree, table: 'plm_bom_items' },
  { path: '/produktion/explosionszeichnungen', label: 'Explosionszeichnungen', icon: Layers, table: 'plm_drawings' },
  { path: '/produktion/lieferanten', label: 'Lieferanten', icon: Factory, table: 'plm_suppliers' },
  { path: '/produktion/wareneingang', label: 'Wareneingang', icon: PackageCheck, table: 'plm_goods_receipts' },
  { path: '/produktion/pruefplaene', label: 'Prüfpläne', icon: ClipboardCheck, table: 'plm_inspection_plans' },
  { path: '/produktion/auftraege', label: 'Produktionsaufträge', icon: Hammer, table: 'plm_production_orders' },
  { path: '/produktion/arbeitsanweisungen', label: 'Arbeitsanweisungen', icon: BookOpenCheck, table: 'plm_work_instructions' },
  { path: '/produktion/aenderungen', label: 'Änderungen (ECR/ECO)', icon: GitPullRequestArrow, table: 'plm_changes' },
  { path: '/produktion/dokumente', label: 'Technische Doku', icon: FileCheck2, table: 'plm_documents' },
];

export default function PlmDashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openChanges, setOpenChanges] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        TILES.map(async t => {
          const { count } = await (supabase.from(t.table as any) as any).select('id', { count: 'exact', head: true });
          return [t.table, count ?? 0] as const;
        }),
      );
      setCounts(Object.fromEntries(entries));

      const [{ data: ch }, { data: bl }, { data: al }] = await Promise.all([
        (supabase.from('plm_changes' as any) as any).select('id,change_number,title,status,risk_level')
          .in('status', ['beantragt', 'bewertet']).order('created_at', { ascending: false }).limit(8),
        (supabase.from('plm_parts' as any) as any).select('id,part_number,name,block_reason')
          .eq('blocked', true).limit(8),
        (supabase.from('plm_audit_log' as any) as any).select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      setOpenChanges((ch as any[]) || []);
      setBlocked((bl as any[]) || []);
      setAudit((al as any[]) || []);
    })();
  }, []);

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Produktion & Beschaffung"
        subtitle="PLM, Fertigung und Beschaffung nach MDR und ISO 13485."
        noBreadcrumbs
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {TILES.map(t => (
          <Link key={t.path} to={t.path}>
            <Card className="hover:border-primary/60 transition h-full">
              <CardContent className="p-4 space-y-2">
                <t.icon className="w-5 h-5 text-primary" />
                <p className="text-sm font-medium leading-tight">{t.label}</p>
                <p className="text-2xl font-semibold">{counts[t.table] ?? 0}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Offene Änderungen</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {openChanges.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{c.change_number}</p>
                </div>
                <Badge variant="outline">{plmLabel(c.status)}</Badge>
              </div>
            ))}
            {!openChanges.length && <p className="text-muted-foreground">Keine offenen Änderungen.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Gesperrte Teile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {blocked.map(p => (
              <div key={p.id} className="border-b border-border/50 pb-2">
                <p className="font-medium">{p.part_number} · {p.name}</p>
                <p className="text-xs text-muted-foreground">{p.block_reason || 'Kein Grund hinterlegt'}</p>
              </div>
            ))}
            {!blocked.length && <p className="text-muted-foreground">Keine gesperrten Teile.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Letzte Änderungen</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {audit.map(a => (
              <div key={a.id} className="border-b border-border/50 pb-2">
                <p className="text-xs">{plmLabel(a.action)} · <span className="font-mono">{a.entity_type}</span></p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('de-DE')}</p>
              </div>
            ))}
            {!audit.length && <p className="text-muted-foreground">Noch keine Einträge.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
