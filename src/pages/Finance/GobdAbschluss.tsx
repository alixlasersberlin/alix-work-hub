import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, FileCheck2, UserCheck, Stamp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Check = { bereich: string; pruefung: string; status: string; detail: string };
type Resp = {
  id: string; area: string; duty: string; role_name: string | null;
  person_name: string | null; person_email: string | null; deputy_name: string | null;
  status: string; confirmed_by_name: string | null; confirmed_at: string | null;
};
type Approval = {
  id: string; subject: string; subject_label: string; decision: string;
  approver_name: string; approver_role: string; reason: string | null;
  doc_version: string | null; approved_at: string;
};
type Report = {
  id: string; report_number: string; version: number; status: string;
  technical_status: string; organizational_status: string; content_hash: string;
  created_at: string; payload: any;
};

const SUBJECTS: { key: string; label: string }[] = [
  { key: 'verfahrensdokumentation', label: 'Verfahrensdokumentation' },
  { key: 'aufbewahrungskonzept', label: 'Aufbewahrungskonzept' },
  { key: 'berechtigungskonzept', label: 'Berechtigungskonzept' },
  { key: 'wiederherstellung', label: 'Datensicherung & Wiederherstellungsnachweis' },
  { key: 'vier_augen', label: 'Vier-Augen-Prinzip' },
  { key: 'loeschfreigabe', label: 'Aufbewahrungs- und Löschfreigabe' },
  { key: 'gesamtfreigabe', label: 'GoBD-Gesamtfreigabe' },
];

const dt = (s?: string | null) => (s ? new Date(s).toLocaleString('de-DE') : '—');

function StatusBadge({ status }: { status: string }) {
  const v = status === 'BESTANDEN' ? 'outline' : status === 'FEHLER' ? 'destructive' : 'secondary';
  return <Badge variant={v as any}>{status}</Badge>;
}

export default function GobdAbschluss() {
  const [org, setOrg] = useState<Check[]>([]);
  const [resps, setResps] = useState<Resp[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editResp, setEditResp] = useState<Resp | null>(null);
  const [form, setForm] = useState({ person_name: '', person_email: '', deputy_name: '', notes: '', confirmed_by_name: '' });

  const [approvalSubject, setApprovalSubject] = useState<string | null>(null);
  const [appForm, setAppForm] = useState({ approver_name: '', approver_role: '', reason: '', evidence_ref: '' });

  async function load() {
    setLoading(true);
    const [o, r, a, f] = await Promise.all([
      (supabase as any).rpc('gobd_org_status'),
      supabase.from('gobd_responsibilities' as any).select('*').order('area'),
      supabase.from('gobd_approvals' as any).select('*').order('approved_at', { ascending: false }),
      supabase.from('gobd_final_reports' as any).select('*').order('version', { ascending: false }),
    ]);
    if (o.error) toast.error(o.error.message); else setOrg((o.data ?? []) as Check[]);
    setResps((r.data ?? []) as Resp[]);
    setApprovals((a.data ?? []) as Approval[]);
    setReports((f.data ?? []) as Report[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const offen = org.filter(c => c.status !== 'BESTANDEN').length;
  const latest = reports[0];

  const latestBySubject = useMemo(() => {
    const m: Record<string, Approval> = {};
    for (const a of approvals) if (!m[a.subject]) m[a.subject] = a;
    return m;
  }, [approvals]);

  async function saveResp(confirm: boolean) {
    if (!editResp) return;
    if (!form.person_name.trim()) { toast.error('Bitte verantwortliche Person eintragen'); return; }
    if (confirm && !form.confirmed_by_name.trim()) { toast.error('Bitte Name der bestätigenden Person eintragen'); return; }
    setBusy(true);
    const { error } = await (supabase as any).rpc('gobd_set_responsibility', {
      p_area: editResp.area,
      p_duty: editResp.duty,
      p_role_name: editResp.role_name,
      p_person_name: form.person_name.trim(),
      p_person_email: form.person_email.trim() || null,
      p_deputy_name: form.deputy_name.trim() || null,
      p_notes: form.notes.trim() || null,
      p_confirm: confirm,
      p_confirmed_by_name: form.confirmed_by_name.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(confirm ? 'Verantwortlichkeit bestätigt' : 'Verantwortlichkeit gespeichert');
    setEditResp(null);
    load();
  }

  async function recordApproval(decision: 'freigegeben' | 'abgelehnt' | 'zurueckgestellt') {
    if (!approvalSubject) return;
    if (!appForm.approver_name.trim() || !appForm.approver_role.trim()) {
      toast.error('Name und Funktion der freigebenden Person sind Pflicht'); return;
    }
    setBusy(true);
    const { error } = await (supabase as any).rpc('gobd_record_approval', {
      p_subject: approvalSubject,
      p_decision: decision,
      p_approver_name: appForm.approver_name.trim(),
      p_approver_role: appForm.approver_role.trim(),
      p_reason: appForm.reason.trim() || null,
      p_doc_version: null,
      p_evidence_ref: appForm.evidence_ref.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Freigabe revisionssicher dokumentiert');
    setApprovalSubject(null);
    setAppForm({ approver_name: '', approver_role: '', reason: '', evidence_ref: '' });
    load();
  }

  async function generateReport() {
    setBusy(true);
    const { error } = await (supabase as any).rpc('gobd_generate_final_report');
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Abschlussbericht erzeugt');
    load();
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="GoBD · Organisatorischer Abschluss"
        subtitle="Verantwortlichkeiten, Freigaben und versionierter Abschlussbericht — technische Prüfungen werden nicht erneut ausgeführt"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={generateReport} disabled={busy}><FileCheck2 className="h-4 w-4 mr-2" />Abschlussbericht erzeugen</Button>
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Offene organisatorische Punkte</div>
          <div className="text-2xl font-semibold mt-1">{loading ? '…' : offen}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Bestätigte Verantwortlichkeiten</div>
          <div className="text-2xl font-semibold mt-1">
            {loading ? '…' : `${resps.filter(r => r.status === 'bestaetigt').length} / ${resps.length}`}
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Dokumentierte Freigaben</div>
          <div className="text-2xl font-semibold mt-1">{loading ? '…' : approvals.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Letzter Abschlussbericht</div>
          <div className="text-sm font-semibold mt-2">{latest ? latest.report_number : '—'}</div>
          {latest && <div className="text-[11px] text-muted-foreground mt-1">{latest.status}</div>}
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Organisatorischer Status</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Bereich</TableHead><TableHead>Prüfung</TableHead>
              <TableHead>Status</TableHead><TableHead>Hinweis</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {org.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{c.bereich}</TableCell>
                  <TableCell className="text-xs">{c.pruefung}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserCheck className="h-4 w-4" />Verantwortlichkeiten</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Bereich</TableHead><TableHead>Aufgabe</TableHead><TableHead>Person</TableHead>
              <TableHead>Vertretung</TableHead><TableHead>Status</TableHead><TableHead>Bestätigt</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {resps.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.area}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.duty}</TableCell>
                  <TableCell className="text-xs">{r.person_name || '—'}</TableCell>
                  <TableCell className="text-xs">{r.deputy_name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'bestaetigt' ? 'outline' : 'secondary'}>
                      {r.status === 'bestaetigt' ? 'bestätigt' : 'offen'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.confirmed_at ? `${r.confirmed_by_name ?? ''} · ${dt(r.confirmed_at)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditResp(r);
                      setForm({
                        person_name: r.person_name ?? '', person_email: r.person_email ?? '',
                        deputy_name: r.deputy_name ?? '', notes: '', confirmed_by_name: r.confirmed_by_name ?? '',
                      });
                    }}>Bearbeiten</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Stamp className="h-4 w-4" />Freigaben</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Gegenstand</TableHead><TableHead>Stand</TableHead>
              <TableHead>Freigegeben von</TableHead><TableHead>Datum</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {SUBJECTS.map(s => {
                const a = latestBySubject[s.key];
                return (
                  <TableRow key={s.key}>
                    <TableCell className="text-xs">{s.label}</TableCell>
                    <TableCell>
                      <Badge variant={!a ? 'secondary' : a.decision === 'freigegeben' ? 'outline' : 'destructive'}>
                        {a ? a.decision : 'offen'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{a ? `${a.approver_name} (${a.approver_role})` : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a ? dt(a.approved_at) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setApprovalSubject(s.key)}>Freigabe erfassen</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-4">
            Freigaben sind unveränderbar. Eine Korrektur erfolgt durch eine neue Freigabe mit Begründung.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Abschlussberichte</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Bericht</TableHead><TableHead>Erzeugt</TableHead><TableHead>Technisch</TableHead>
              <TableHead>Organisatorisch</TableHead><TableHead>Freigabestatus</TableHead><TableHead>Prüfsumme</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {reports.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Noch kein Abschlussbericht erzeugt
                </TableCell></TableRow>
              )}
              {reports.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">{r.report_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dt(r.created_at)}</TableCell>
                  <TableCell><StatusBadge status={r.technical_status} /></TableCell>
                  <TableCell><StatusBadge status={r.organizational_status} /></TableCell>
                  <TableCell className="text-xs font-medium">{r.status}</TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">{r.content_hash.slice(0, 16)}…</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground mt-4">
            Jeder Bericht erhält eine neue Version und bleibt unverändert erhalten. Bestehende Nachweise werden nicht überschrieben.
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!editResp} onOpenChange={(v) => !v && setEditResp(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editResp?.area} · {editResp?.duty}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Verantwortliche Person</Label>
              <Input value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} /></div>
            <div><Label className="text-xs">E-Mail</Label>
              <Input value={form.person_email} onChange={e => setForm({ ...form, person_email: e.target.value })} /></div>
            <div><Label className="text-xs">Vertretung</Label>
              <Input value={form.deputy_name} onChange={e => setForm({ ...form, deputy_name: e.target.value })} /></div>
            <div><Label className="text-xs">Bestätigt durch (Name)</Label>
              <Input value={form.confirmed_by_name} onChange={e => setForm({ ...form, confirmed_by_name: e.target.value })} /></div>
            <div><Label className="text-xs">Notiz</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => saveResp(false)} disabled={busy}>Speichern</Button>
            <Button onClick={() => saveResp(true)} disabled={busy}>Speichern & bestätigen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approvalSubject} onOpenChange={(v) => !v && setApprovalSubject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Freigabe · {SUBJECTS.find(s => s.key === approvalSubject)?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name der freigebenden Person</Label>
              <Input value={appForm.approver_name} onChange={e => setAppForm({ ...appForm, approver_name: e.target.value })} /></div>
            <div><Label className="text-xs">Funktion</Label>
              <Input placeholder="z. B. Geschäftsführung" value={appForm.approver_role}
                     onChange={e => setAppForm({ ...appForm, approver_role: e.target.value })} /></div>
            <div><Label className="text-xs">Nachweis / Verweis</Label>
              <Input placeholder="z. B. docs/gobd/phase15b-nachweis-2026-09-15.md"
                     value={appForm.evidence_ref} onChange={e => setAppForm({ ...appForm, evidence_ref: e.target.value })} /></div>
            <div><Label className="text-xs">Begründung / Anmerkung</Label>
              <Textarea rows={3} value={appForm.reason} onChange={e => setAppForm({ ...appForm, reason: e.target.value })} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => recordApproval('zurueckgestellt')} disabled={busy}>Zurückstellen</Button>
            <Button variant="destructive" onClick={() => recordApproval('abgelehnt')} disabled={busy}>Ablehnen</Button>
            <Button onClick={() => recordApproval('freigegeben')} disabled={busy}>Freigeben</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
