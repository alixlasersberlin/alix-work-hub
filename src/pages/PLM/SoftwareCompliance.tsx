import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, FileDown, Table2 } from 'lucide-react';
import { toast } from 'sonner';

type Tone = 'ok' | 'warn' | 'bad';

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </CardContent></Card>
  );
}

function Lamp({ label, tone, hint }: { label: string; tone: Tone; hint?: string }) {
  const dot = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-destructive';
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <span className={`w-4 h-4 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
      </div>
    </CardContent></Card>
  );
}

export default function SoftwareCompliance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [units, setUnits] = useState<any[]>([]);
  const [reqs, setReqs] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [bugs, setBugs] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [hwDocs, setHwDocs] = useState<any[]>([]);
  const [soup, setSoup] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [measures, setMeasures] = useState<any[]>([]);
  const [classification, setClassification] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from('plm_devices' as any) as any)
        .select('id,name,article_number').order('name');
      const list = (data as any[]) || [];
      setDevices(list);
      setDeviceId(prev => prev || list[0]?.id || '');
      if (!list.length) setLoading(false);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    const f = (t: string) => (supabase.from(t as any) as any).select('*').eq('device_id', deviceId).limit(2000);
    const [u, r, rk, t, b, rel, tm, hw, sp, pl, an, pr, ms, cl, sg] = await Promise.all([
      f('plm_sw_units'), f('plm_sw_requirements'), f('plm_sw_risks'), f('plm_sw_tests'),
      f('plm_sw_bugs'), f('plm_sw_releases'), f('plm_sw_team'), f('plm_hw_docs'),
      f('plm_sw_soup'), f('plm_sw_plans'), f('plm_sw_anomalies'), f('plm_sw_problems'),
      f('plm_sw_risk_measures'), f('plm_sw_classification'), f('plm_sw_signatures'),
    ]);
    setUnits((u.data as any[]) || []);
    setReqs((r.data as any[]) || []);
    setRisks((rk.data as any[]) || []);
    setTests((t.data as any[]) || []);
    setBugs((b.data as any[]) || []);
    setReleases((rel.data as any[]) || []);
    setTeam((tm.data as any[]) || []);
    setHwDocs((hw.data as any[]) || []);
    setSoup((sp.data as any[]) || []);
    setPlans((pl.data as any[]) || []);
    setAnomalies((an.data as any[]) || []);
    setProblems((pr.data as any[]) || []);
    setMeasures((ms.data as any[]) || []);
    setClassification((cl.data as any[]) || []);
    setSignatures((sg.data as any[]) || []);
    setLoading(false);
  }, [deviceId]);
  useEffect(() => { load(); }, [load]);

  const m = useMemo(() => {
    const byKind = (k: string) => tests.filter(t => t.kind === k);
    const passed = (arr: any[]) => arr.filter(t => t.result === 'pass' && t.executed_confirmed).length;
    const ver = byKind('verification'), int = byKind('integration'), sys = byKind('system');
    const reqIdsWith = (kind: string) => new Set(tests.filter(t => t.kind === kind && t.requirement_id).map(t => t.requirement_id));
    const verReq = reqIdsWith('verification'), intReq = reqIdsWith('integration'), sysReq = reqIdsWith('system');
    const fullyTraced = reqs.filter(q => q.unit_id && verReq.has(q.id) && sysReq.has(q.id)).length;
    const traceability = reqs.length ? Math.round((fullyTraced / reqs.length) * 100) : 0;
    const openBugs = bugs.filter(b => !['geschlossen', 'abgelehnt', 'verifiziert'].includes(b.status)).length;
    const latest = [...releases].sort((a, b) =>
      String(b.release_date || '').localeCompare(String(a.release_date || '')))[0];
    return {
      ver, int, sys, verPassed: passed(ver), intPassed: passed(int), sysPassed: passed(sys),
      traceability, openBugs, latest,
      reqNoSys: reqs.filter(q => !sysReq.has(q.id)),
      reqNoVer: reqs.filter(q => !verReq.has(q.id)),
      reqNoUnit: reqs.filter(q => !q.unit_id),
      reqNoInt: reqs.filter(q => !intReq.has(q.id)),
      risksNoVerification: risks.filter(r => !r.verification),
      unitsNoOwner: units.filter(u => !u.owner),
      unitsNoSource: units.filter(u => !u.source_location),
      vcsMissing: !team.some(p => p.version_control && p.version_control !== 'None'),
      teamOk: team.some(p => p.team === 'software' && p.is_lead),
      hwIsolation: hwDocs.some(d => d.doc_kind === 'isolationsdiagramm'),
    };
  }, [units, reqs, risks, tests, bugs, releases, team, hwDocs]);

  const gaps = useMemo(() => {
    const g: { tone: Tone; text: string }[] = [];
    if (m.reqNoSys.length) g.push({ tone: 'bad', text: `${m.reqNoSys.length} Requirements ohne Systemtest` });
    if (m.reqNoVer.length) g.push({ tone: 'bad', text: `${m.reqNoVer.length} Requirements ohne Unit-Verifikation` });
    if (m.risksNoVerification.length) g.push({ tone: 'bad', text: `${m.risksNoVerification.length} Risiken ohne Risk-Control-Verifikation` });
    if (m.reqNoUnit.length) g.push({ tone: 'warn', text: `${m.reqNoUnit.length} Requirements ohne Software Unit` });
    if (m.unitsNoOwner.length) g.push({ tone: 'warn', text: `${m.unitsNoOwner.length} Software Units ohne Owner` });
    if (m.unitsNoSource.length) g.push({ tone: 'warn', text: `${m.unitsNoSource.length} Software Units ohne Source-Code-Ort` });
    if (m.vcsMissing) g.push({ tone: 'warn', text: 'Git-Repository / Versionsverwaltung nicht dokumentiert' });
    if (!m.hwIsolation) g.push({ tone: 'warn', text: 'Isolationsdiagramm (IEC 60601-1) fehlt' });
    if (!m.teamOk) g.push({ tone: 'warn', text: 'Software Development Team Lead fehlt' });
    if (!g.length) g.push({ tone: 'ok', text: 'Keine offenen Lücken erkannt' });
    return g;
  }, [m]);

  const complete = useMemo(() => {
    const checks = [
      reqs.length > 0, units.length > 0, m.reqNoVer.length === 0, m.reqNoInt.length === 0,
      m.reqNoSys.length === 0, m.risksNoVerification.length === 0 && risks.length > 0,
      m.hwIsolation, m.teamOk, !m.vcsMissing, m.unitsNoOwner.length === 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [reqs, units, risks, m]);

  const exportMarkdown = () => {
    const dev = devices.find(d => d.id === deviceId);
    const lines: string[] = [];
    lines.push(`# Software Documentation — ${dev?.name ?? ''}`);
    lines.push(`Stand: ${new Date().toLocaleString('de-DE')}  |  Vollständigkeit: ${complete} %  |  Traceability: ${m.traceability} %`, '');
    lines.push('## Software Requirements Specification');
    reqs.forEach(q => lines.push(`- **${q.req_code ?? ''}** ${q.title} — Status: ${q.status}, Quelle: ${q.source ?? '—'}, Akzeptanzkriterien: ${q.acceptance_criteria ?? '—'}`));
    lines.push('', '## Software Architecture');
    units.forEach(u => lines.push(`- **${u.unit_code ?? ''}** ${u.name} — Klasse ${u.safety_class ?? '—'}, Owner ${u.owner ?? '—'}, Version ${u.version ?? '—'}`));
    lines.push('', '## Software Risk Management File');
    risks.forEach(r => lines.push(`- **${r.risk_code ?? ''}** ${r.hazard} — S${r.severity}/P${r.probability}, Control: ${r.risk_control ?? '—'}, Restrisiko akzeptabel: ${r.acceptable ? 'Ja' : 'Nein'}`));
    (['verification', 'integration', 'system'] as const).forEach(kind => {
      lines.push('', `## ${kind === 'verification' ? 'Software Units Verification Protocol (TP_SW555)' : kind === 'integration' ? 'Software Integration Test Protocol (TP_SW563)' : 'Software System Test Protocol (TP_SW575)'}`);
      tests.filter(t => t.kind === kind).forEach(t =>
        lines.push(`- **${t.test_code ?? ''}** ${t.title} — Expected: ${t.expected_result ?? '—'} | Actual: ${t.executed_confirmed ? (t.actual_result ?? '—') : 'nicht durchgeführt'} | Result: ${t.result} | Tester: ${t.tester ?? '—'} | Datum: ${t.test_date ?? '—'}`));
    });
    lines.push('', '## Software Release Report');
    releases.forEach(r => lines.push(`- **${r.version}** ${r.release_date ?? ''} — Commit ${r.git_commit ?? '—'}, Hash ${r.firmware_hash ?? '—'}, freigegeben von ${r.approved_by ?? '—'}`));
    lines.push('', '## Bug Report');
    bugs.forEach(b => lines.push(`- **${b.bug_code ?? ''}** ${b.title} — ${b.severity}, Status ${b.status}, behoben in ${b.released_version ?? '—'}`));
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `software-documentation-${dev?.name ?? 'device'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Dokumentation generiert');
  };

  return (
    <div className="container max-w-[1600px] py-6 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="ALIX SOFTWARE COMPLIANCE"
        subtitle="Software Documentation & Traceability Center nach IEC 62304 — verknüpft mit ISO 14971 und IEC 60601-1."
        noBreadcrumbs
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[240px]"
            value={deviceId}
            onChange={e => setDeviceId(e.target.value)}
          >
            {!devices.length && <option value="">Keine Geräte vorhanden</option>}
            {devices.map(d => <option key={d.id} value={d.id}>{[d.article_number, d.name].filter(Boolean).join(' · ')}</option>)}
          </select>
          <Badge variant="outline">Software Version: {m.latest?.version ?? '—'}</Badge>
          <Badge variant="outline">Vollständigkeit: {complete} %</Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => navigate('/produktion/software/traceability')}>
              <Table2 className="w-4 h-4 mr-1" /> Traceability Matrix
            </Button>
            <Button onClick={exportMarkdown} disabled={!deviceId}>
              <FileDown className="w-4 h-4 mr-1" /> Dokumente generieren
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Kpi label="Software Units" value={units.length} />
            <Kpi label="Requirements" value={reqs.length} />
            <Kpi label="Risks" value={risks.length} />
            <Kpi label="Verification Tests" value={`${m.verPassed}/${m.ver.length}`} />
            <Kpi label="Integration Tests" value={`${m.intPassed}/${m.int.length}`} />
            <Kpi label="System Tests" value={`${m.sysPassed}/${m.sys.length}`} />
            <Kpi label="Open Issues" value={m.openBugs} />
            <Kpi label="Traceability" value={`${m.traceability} %`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Lamp label="Requirements" tone={reqs.length ? (m.reqNoUnit.length ? 'warn' : 'ok') : 'bad'} hint={`${reqs.length} erfasst`} />
            <Lamp label="Software Architecture" tone={units.length ? (m.unitsNoOwner.length ? 'warn' : 'ok') : 'bad'} hint={`${units.length} Units`} />
            <Lamp label="Unit Verification" tone={!m.ver.length ? 'bad' : m.reqNoVer.length ? 'warn' : 'ok'} hint={`${m.verPassed}/${m.ver.length} bestanden`} />
            <Lamp label="Integration Testing" tone={!m.int.length ? 'bad' : m.intPassed < m.int.length ? 'warn' : 'ok'} hint={`${m.intPassed}/${m.int.length} bestanden`} />
            <Lamp label="System Testing" tone={!m.sys.length ? 'bad' : m.sysPassed < m.sys.length ? 'warn' : 'ok'} hint={`${m.sysPassed}/${m.sys.length} bestanden`} />
            <Lamp label="Risk Management" tone={!risks.length ? 'bad' : m.risksNoVerification.length ? 'warn' : 'ok'} hint={`${risks.length} Risiken`} />
            <Lamp label="Hardware Documentation" tone={!hwDocs.length ? 'bad' : m.hwIsolation ? 'ok' : 'warn'} hint={`${hwDocs.length} Dokumente`} />
            <Lamp label="Development Team" tone={!team.length ? 'bad' : m.teamOk && !m.vcsMissing ? 'ok' : 'warn'} hint={`${team.length} Personen`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Was fehlt uns noch?</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-3 h-3 rounded-full ${g.tone === 'ok' ? 'bg-emerald-500' : g.tone === 'warn' ? 'bg-amber-500' : 'bg-destructive'}`} />
                  {g.text}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
