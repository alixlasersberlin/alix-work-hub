import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileDown, ClipboardCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SecurityCompliance() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const [inv, mfa, priv, sess, findings, scanInfo] = await Promise.all([
      (supabase as any).from('security_table_inventory').select('*'),
      (supabase as any).from('security_scan_mfa_coverage').select('*').catch(() => ({ data: [] })),
      (supabase as any).from('security_scan_privileged_no_mfa').select('*').catch(() => ({ data: [] })),
      (supabase as any).from('security_scan_stale_sessions').select('*').catch(() => ({ data: [] })),
      (supabase as any).from('security_audit_findings').select('*').order('severity'),
      (supabase as any).from('security_last_scan_info').select('*').single().catch(() => ({ data: null })),
    ]);
    setData({
      inv: inv.data ?? [], mfa: mfa.data ?? [], priv: priv.data ?? [],
      sess: sess.data ?? [], findings: findings.data ?? [], scanInfo: scanInfo.data,
    });
  })(); }, []);

  const generatePdf = () => {
    if (!data) return;
    setBusy(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const now = new Date().toLocaleString('de-DE');

      // Header
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, 595, 60, 'F');
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(18); doc.text('Alix Security Compliance Report', 40, 30);
      doc.setTextColor(200, 200, 200); doc.setFontSize(9);
      doc.text(`ISO 27001 / DSGVO Snapshot – erzeugt am ${now}`, 40, 48);

      doc.setTextColor(20, 20, 20);
      let y = 90;

      // Zusammenfassung
      doc.setFontSize(13); doc.text('1. Zusammenfassung', 40, y); y += 14;
      const total = data.inv.length;
      const noRls = data.inv.filter((t: any) => !t.rls_enabled).length;
      const noPol = data.inv.filter((t: any) => t.rls_enabled && t.policy_count === 0).length;
      const anon = data.inv.filter((t: any) => t.anon_access).length;
      const open = data.findings.filter((f: any) => f.status !== 'resolved').length;
      const crit = data.findings.filter((f: any) => (f.severity === 'critical' || f.severity === 'high') && f.status !== 'resolved').length;

      doc.setFontSize(10);
      const summary = [
        ['Tabellen gesamt', total],
        ['Tabellen ohne RLS', noRls],
        ['Tabellen mit RLS, aber ohne Policy', noPol],
        ['Tabellen mit Anon-Zugriff', anon],
        ['Offene Findings', open],
        ['Kritisch/Hoch offen', crit],
        ['Aktive Sessions >30 Tage', data.sess.length],
        ['Privilegierte Accounts ohne MFA', data.priv.length],
        ['Letzter Scan', data.scanInfo?.last_scan_at ? new Date(data.scanInfo.last_scan_at).toLocaleString('de-DE') : '–'],
      ];
      autoTable(doc, {
        startY: y, body: summary,
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 220 }, 1: { halign: 'right' } },
        theme: 'grid', headStyles: { fillColor: [30, 30, 30] },
      });
      y = (doc as any).lastAutoTable.finalY + 20;

      // MFA-Coverage
      doc.setFontSize(13); doc.text('2. MFA Coverage', 40, y); y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Rolle', 'Nutzer', 'Mit MFA', 'Ohne MFA', 'Coverage %']],
        body: data.mfa.map((r: any) => [r.role_name, r.total_users, r.with_mfa, r.without_mfa, `${r.coverage_pct ?? 0}%`]),
        styles: { fontSize: 9 }, theme: 'striped', headStyles: { fillColor: [212, 175, 55], textColor: 20 },
      });
      y = (doc as any).lastAutoTable.finalY + 20;

      // Findings
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setFontSize(13); doc.text('3. Offene Findings (Top 30)', 40, y); y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Sev', 'Kategorie', 'Titel', 'Ziel']],
        body: data.findings.filter((f: any) => f.status !== 'resolved').slice(0, 30).map((f: any) => [
          f.severity, f.category, f.title, f.target,
        ]),
        styles: { fontSize: 8 }, theme: 'grid', headStyles: { fillColor: [212, 175, 55], textColor: 20 },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 70 }, 2: { cellWidth: 230 } },
      });

      // Footer
      const pages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(140);
        doc.text(`Alix Security Compliance Report – Seite ${i}/${pages}`, 40, 820);
      }

      doc.save(`alix-security-compliance-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('PDF generiert');
    } catch (e: any) {
      toast.error(e.message ?? 'PDF-Fehler');
    } finally { setBusy(false); }
  };

  if (!data) return <div className="text-sm text-muted-foreground">Wird geladen…</div>;
  const open = data.findings.filter((f: any) => f.status !== 'resolved').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> Compliance Report</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">ISO 27001 / DSGVO Security Snapshot als PDF: Findings, MFA, Sessions, Rollen-Audit.</p>
        </div>
        <Button size="sm" onClick={generatePdf} disabled={busy}>
          <FileDown className="w-4 h-4 mr-1" />{busy ? 'Erzeuge…' : 'PDF exportieren'}
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tabellen" v={data.inv.length} />
        <Stat label="Offene Findings" v={open} />
        <Stat label="MFA-Rollen" v={data.mfa.length} />
        <Stat label="Alte Sessions" v={data.sess.length} />
      </CardContent>
    </Card>
  );
}

function Stat({ label, v }: { label: string; v: any }) {
  return <div className="rounded-md border p-3">
    <div className="text-[10.5px] uppercase text-muted-foreground tracking-wide">{label}</div>
    <div className="text-2xl font-semibold mt-1">{v}</div>
  </div>;
}
