import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { useMedTenant, medMoney } from '@/hooks/useMedTenant';
import { Loader2, Package, FileText, Wallet, ShieldCheck } from 'lucide-react';

export default function MedDashboard() {
  const { tenantId, loading } = useMedTenant();
  const [stats, setStats] = useState({ items: 0, docs: 0, open: 0, compliance: 0 });
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const [items, docs, openDocs, comp] = await Promise.all([
        supabase.from('med_items' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('med_documents' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('med_documents' as any).select('gross_total, paid_total').eq('tenant_id', tenantId).eq('doc_type', 'rechnung'),
        supabase.from('med_compliance_docs' as any).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      ]);
      const open = ((openDocs.data as any[]) || []).reduce(
        (s, d) => s + (Number(d.gross_total || 0) - Number(d.paid_total || 0)), 0);
      if (!cancelled) {
        setStats({ items: items.count ?? 0, docs: docs.count ?? 0, open, compliance: comp.count ?? 0 });
        setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!tenantId) return <div className="p-6 text-muted-foreground">Mandant „Alix Medical" nicht gefunden.</div>;

  const tiles = [
    { label: 'Artikel', value: stats.items, icon: Package, to: '/med/artikel' },
    { label: 'Belege', value: stats.docs, icon: FileText, to: '/med/belege' },
    { label: 'Offene Rechnungen', value: medMoney(stats.open), icon: Wallet, to: '/med/buchhaltung' },
    { label: 'Compliance-Dokumente', value: stats.compliance, icon: ShieldCheck, to: '/med/compliance' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Mandant · ⚕️ Alix Medical</div>
        <h1 className="text-2xl font-display font-bold">Medical Dashboard</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(t => (
          <Link key={t.label} to={t.to}>
            <Card className="p-5 hover:border-primary/40 transition-colors h-full">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <t.icon className="w-4 h-4 text-primary" /> {t.label}
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {busy ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : t.value}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
