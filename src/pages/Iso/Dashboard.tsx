import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, GraduationCap, Factory, GitBranch, AlertTriangle, FileWarning } from 'lucide-react';
import { Section } from './_shared';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';

type Counts = {
  audits_open: number;
  findings_open: number;
  trainings: number;
  expiring_trainings: number;
  suppliers: number;
  changes_pending: number;
  vigilance_open: number;
};

export default function IsoDashboard() {
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<Counts>({
    audits_open: 0, findings_open: 0, trainings: 0, expiring_trainings: 0,
    suppliers: 0, changes_pending: 0, vigilance_open: 0,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const sb = supabase as any;
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 2);
    const soonIso = soon.toISOString().slice(0, 10);

    const [a, f, t, te, s, ch, v] = await Promise.all([
      sb.from('iso_audits').select('id', { count: 'exact', head: true }).neq('status', 'abgeschlossen'),
      sb.from('iso_audit_findings_ext').select('id', { count: 'exact', head: true }).neq('status', 'geschlossen'),
      sb.from('iso_trainings').select('id', { count: 'exact', head: true }),
      sb.from('iso_training_records').select('id', { count: 'exact', head: true }).lte('expires_at', soonIso),
      sb.from('iso_supplier_evaluations').select('id', { count: 'exact', head: true }),
      sb.from('iso_change_controls').select('id', { count: 'exact', head: true }).in('status', ['eingereicht', 'bewertung']),
      sb.from('mdr_vigilance_reports').select('id', { count: 'exact', head: true }).neq('authority_status', 'abgeschlossen'),
    ]);

    setC({
      audits_open: a.count ?? 0,
      findings_open: f.count ?? 0,
      trainings: t.count ?? 0,
      expiring_trainings: te.count ?? 0,
      suppliers: s.count ?? 0,
      changes_pending: ch.count ?? 0,
      vigilance_open: v.count ?? 0,
    });
    setLoading(false);
  }

  const tiles = [
    { label: 'Offene Audits', value: c.audits_open, icon: ClipboardList, accent: 'gold' as const },
    { label: 'Offene Feststellungen', value: c.findings_open, icon: FileWarning, accent: 'rose' as const },
    { label: 'Schulungen', value: c.trainings, icon: GraduationCap, accent: 'sky' as const },
    { label: 'Schulungen laufen bald ab', value: c.expiring_trainings, icon: GraduationCap, accent: 'rose' as const },
    { label: 'Lieferantenbewertungen', value: c.suppliers, icon: Factory, accent: 'violet' as const },
    { label: 'Änderungen in Prüfung', value: c.changes_pending, icon: GitBranch, accent: 'gold' as const },
    { label: 'Offene MDR-Meldungen', value: c.vigilance_open, icon: AlertTriangle, accent: 'rose' as const },
  ];

  return (
    <Section title="Übersicht">
      {loading ? (
        <SkeletonKpiGrid count={7} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map(t => (
            <KpiTile key={t.label} label={t.label} value={t.value} icon={t.icon} accent={t.accent} />
          ))}
        </div>
      )}
    </Section>
  );
}

