import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileDown, ClipboardCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function BugCapaIsoReport() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    const sb = supabase as any;
    const [bugs, capas, findings, actions, mttr, bo, co] = await Promise.all([
      sb.from('bugs').select('*').order('created_at', { ascending: false }),
      sb.from('capas').select('*').order('created_at', { ascending: false }),
      sb.from('audit_findings').select('*').order('created_at', { ascending: false }),
      sb.from('capa_actions').select('*').order('created_at', { ascending: false }),
      sb.from('capa_mttr_stats').select('*').single(),
      sb.from('bug_overdue').select('*'),
      sb.from('capa_overdue').select('*'),
    ]);
    setData({ bugs: bugs.data ?? [], capas: capas.data ?? [], findings: findings.data ?? [],
      actions: actions.data ?? [], mttr: mttr.data, bo: bo.data ?? [], co: co.data ?? [] });
  })(); }, []);

  const generatePdf = () => {
    if (!data) return;
    setBusy(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const now = new Date().toLocaleString('de-DE');

      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, 595, 60, 'F');
      doc.setTextColor(212, 175, 55); doc.setFontSize(18);
      doc.text('Alix ISO 13485 – QM-Bericht', 40, 30);
      doc.setTextColor(200); doc.setFontSize(9);
      doc.text(`Bugs · CAPA · Audit-Feststellungen – erzeugt am ${now}`, 40, 48);

      doc.setTextColor(20); let y = 90;

      // 1) Kennzahlen
      doc.setFontSize(13); doc.text('1. Kennzahlen', 40, y); y += 8;
      autoTable(doc, {
        startY: y,
        body: [
          ['Bugs gesamt', data.bugs.length],
          ['davon offen', data.bugs.filter((b: any) => !['geschlossen','erledigt'].includes(b.status)).length],
          ['Bugs überfällig', data.bo.length],
          ['CAPAs gesamt', data.capas.length],
          ['CAPAs offen', data.mttr?.open_total ?? 0],
          ['CAPAs überfällig', data.co.length],
          ['CAPAs geschlossen', data.mttr?.closed_total ?? 0],
          ['MTTR (Tage, alle)', data.mttr?.mttr_days_all ?? '–'],
          ['MTTR (Tage, 90d)', data.mttr?.mttr_days_90d ?? '–'],
          ['Wirksamkeit bestätigt', data.mttr?.effective_count ?? 0],
          ['Wirksamkeit unwirksam', data.mttr?.ineffective_count ?? 0],
          ['Audit-Feststellungen gesamt', data.findings.length],
          ['Maßnahmen offen', data.actions.filter((a: any) => ['offen','in_bearbeitung'].includes(a.status)).length],
        ],
        styles: { fontSize: 9, cellPadding: 4 }, theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 240 }, 1: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable.finalY + 20;

      // 2) Offene Bugs (Top 30)
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setFontSize(13); doc.text('2. Offene Bugs (Top 30)', 40, y); y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Nr.', 'Titel', 'Priorität', 'Kritikalität', 'Status', 'Fällig']],
        body: data.bugs.filter((b: any) => !['geschlossen','erledigt'].includes(b.status)).slice(0, 30)
          .map((b: any) => [b.ticket_number, b.title, b.priority, b.criticality, b.status, b.due_date ?? '–']),
        styles: { fontSize: 8 }, theme: 'striped',
        headStyles: { fillColor: [212, 175, 55], textColor: 20 },
      });
      y = (doc as any).lastAutoTable.finalY + 20;

      // 3) Offene CAPAs
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setFontSize(13); doc.text('3. Offene CAPAs', 40, y); y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Nr.', 'Titel', 'Auslöser', 'Status', 'Fällig']],
        body: data.capas.filter((c: any) => c.status !== 'geschlossen')
          .map((c: any) => [c.capa_number, c.title, c.trigger_type ?? '–', c.status, c.due_date ?? '–']),
        styles: { fontSize: 8 }, theme: 'striped',
        headStyles: { fillColor: [212, 175, 55], textColor: 20 },
      });
      y = (doc as any).lastAutoTable.finalY + 20;

      // 4) Audit-Feststellungen
      if (y > 700) { doc.addPage(); y = 60; }
      doc.setFontSize(13); doc.text('4. Audit-Feststellungen', 40, y); y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Nr.', 'Audit', 'Bereich', 'Typ', 'Status', 'Datum']],
        body: data.findings.map((f: any) => [f.finding_number, f.audit_name, f.area ?? '–', f.finding_type, f.status, f.audit_date ?? '–']),
        styles: { fontSize: 8 }, theme: 'striped',
        headStyles: { fillColor: [212, 175, 55], textColor: 20 },
      });

      // Footer
      const pages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(140);
        doc.text(`Alix ISO 13485 QM-Bericht – Seite ${i}/${pages}`, 40, 820);
      }
      doc.save(`alix-iso13485-qm-bericht-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('QM-Bericht erzeugt');
    } catch (e: any) { toast.error(e.message ?? 'PDF-Fehler'); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="text-sm text-muted-foreground">Wird geladen…</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-primary" /> ISO 13485 QM-Bericht</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Kennzahlen + offene Bugs / CAPAs / Findings als PDF-Bericht.</p>
        </div>
        <Button size="sm" onClick={generatePdf} disabled={busy}>
          <FileDown className="w-4 h-4 mr-1" />{busy ? 'Erzeuge…' : 'PDF exportieren'}
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <S label="Bugs" v={data.bugs.length} />
        <S label="CAPAs" v={data.capas.length} />
        <S label="Findings" v={data.findings.length} />
        <S label="MTTR (d)" v={data.mttr?.mttr_days_all ?? '–'} />
      </CardContent>
    </Card>
  );
}
function S({ label, v }: { label: string; v: any }) {
  return <div className="rounded-md border p-3">
    <div className="text-[10.5px] uppercase text-muted-foreground tracking-wide">{label}</div>
    <div className="text-2xl font-semibold mt-1">{v}</div>
  </div>;
}
