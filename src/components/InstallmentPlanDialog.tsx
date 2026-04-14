import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Banknote, Download, Loader2 } from 'lucide-react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface Props {
  order: any;
  customer: any;
  userId: string;
}

const TERMS = [12, 24, 36, 48, 60] as const;

function generateInstallments(baseAmount: number, term: number, startDate: Date) {
  const monthlyRate = Math.round((baseAmount / term) * 100) / 100;
  const rows: { nr: number; dueDate: Date; amount: number; remaining: number }[] = [];
  let remaining = baseAmount;

  for (let i = 0; i < term; i++) {
    const isLast = i === term - 1;
    const amount = isLast ? remaining : monthlyRate;
    remaining = Math.round((remaining - amount) * 100) / 100;
    rows.push({
      nr: i + 1,
      dueDate: addMonths(startDate, i),
      amount,
      remaining: Math.max(remaining, 0),
    });
  }
  return rows;
}

function buildPdf(order: any, customer: any, purchasePrice: number, downPayment: number, term: number, rows: ReturnType<typeof generateInstallments>) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  const usable = pw - margin * 2;
  let y = 25;

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Ratenplan', margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Auftrag: ${order.order_number}`, margin, y);
  y += 5;
  doc.text(`Kunde: ${customer?.company_name || customer?.contact_name || '—'}`, margin, y);
  y += 5;
  doc.text(`Erstellt am: ${format(new Date(), 'dd.MM.yyyy', { locale: de })}`, margin, y);
  y += 10;

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.text('Zusammenfassung', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const summaryLines = [
    [`Kaufpreis:`, `${fmt(purchasePrice)} EUR`],
    [`Anzahlung:`, `${fmt(downPayment)} EUR`],
    [`Finanzierungsbetrag:`, `${fmt(purchasePrice - downPayment)} EUR`],
    [`Laufzeit:`, `${term} Monate`],
    [`Monatliche Rate:`, `${fmt(rows[0]?.amount || 0)} EUR`],
  ];
  for (const [label, val] of summaryLines) {
    doc.text(label, margin, y);
    doc.text(val, margin + usable, y, { align: 'right' });
    y += 5;
  }
  y += 5;

  // Table header
  const cols = [
    { label: 'Nr.', x: margin, w: 12 },
    { label: 'Fälligkeitsdatum', x: margin + 14, w: 40 },
    { label: 'Rate', x: margin + 80, w: 30 },
    { label: 'Restbetrag', x: margin + usable, w: 30 },
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, usable, 7, 'F');
  doc.text('Nr.', cols[0].x, y);
  doc.text('Fälligkeitsdatum', cols[1].x, y);
  doc.text('Rate (EUR)', cols[2].x, y, { align: 'right' });
  doc.text('Restbetrag (EUR)', margin + usable, y, { align: 'right' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  for (const row of rows) {
    if (y > 270) {
      doc.addPage();
      y = 25;
    }
    doc.text(String(row.nr), cols[0].x, y);
    doc.text(format(row.dueDate, 'dd.MM.yyyy'), cols[1].x, y);
    doc.text(fmt(row.amount), cols[2].x, y, { align: 'right' });
    doc.text(fmt(row.remaining), margin + usable, y, { align: 'right' });
    y += 5;
  }

  // Footer total
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.line(margin, y - 3, margin + usable, y - 3);
  doc.text('Gesamtbetrag:', margin, y);
  doc.text(`${fmt(purchasePrice - downPayment)} EUR`, margin + usable, y, { align: 'right' });

  return doc;
}

export default function InstallmentPlanDialog({ order, customer, userId }: Props) {
  const [open, setOpen] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState(order.total_amount ? String(order.total_amount) : '');
  const [downPayment, setDownPayment] = useState('');
  const [term, setTerm] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ReturnType<typeof generateInstallments> | null>(null);

  const baseAmount = (parseFloat(purchasePrice) || 0) - (parseFloat(downPayment) || 0);
  const termNum = parseInt(term) || 0;

  const deliveryDate = order.expected_shipment_date ? new Date(order.expected_shipment_date) : new Date();
  const startDate = startOfMonth(addMonths(deliveryDate, 1));

  function handlePreview() {
    if (baseAmount <= 0 || !termNum) { toast.error('Bitte Kaufpreis, Anzahlung und Laufzeit eingeben.'); return; }
    setPreview(generateInstallments(baseAmount, termNum, startDate));
  }

  async function handleCreate() {
    if (!preview) return;
    setSaving(true);
    try {
      // Create finance records for each installment
      const records = preview.map(row => ({
        order_id: order.id,
        payment_status: 'offen',
        invoice_status: 'erstellt',
        due_date: format(row.dueDate, 'yyyy-MM-dd'),
        amount_due: row.amount,
        amount_paid: 0,
        currency: order.currency || 'EUR',
        finance_note: `Ratenplan Rate ${row.nr}/${preview.length}`,
        created_by: userId,
        last_checked_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('finance_records').insert(records);
      if (error) throw error;

      // Generate & download PDF
      const pdf = buildPdf(order, customer, parseFloat(purchasePrice), parseFloat(downPayment), termNum, preview);
      pdf.save(`Ratenplan_${order.order_number}.pdf`);

      toast.success(`${preview.length} Raten erstellt und PDF heruntergeladen.`);
      setOpen(false);
      setPreview(null);
    } catch (err: any) {
      toast.error(err.message || 'Fehler beim Erstellen.');
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadPdf() {
    if (!preview) return;
    const pdf = buildPdf(order, customer, parseFloat(purchasePrice), parseFloat(downPayment), termNum, preview);
    pdf.save(`Ratenplan_${order.order_number}.pdf`);
  }

  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setPreview(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
          <Banknote className="w-4 h-4 mr-2" /> Ratenplan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Banknote className="w-5 h-5 text-primary" /> Ratenplan erstellen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Inputs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kaufpreis (EUR)</label>
              <Input type="number" step="0.01" value={purchasePrice} onChange={e => { setPurchasePrice(e.target.value); setPreview(null); }} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Anzahlung (EUR)</label>
              <Input type="number" step="0.01" value={downPayment} onChange={e => { setDownPayment(e.target.value); setPreview(null); }} placeholder="0.00" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Laufzeit</label>
              <Select value={term} onValueChange={v => { setTerm(v); setPreview(null); }}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Wählen" /></SelectTrigger>
                <SelectContent>
                  {TERMS.map(t => <SelectItem key={t} value={String(t)}>{t} Monate</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {baseAmount > 0 && termNum > 0 && (
            <div className="rounded-lg bg-secondary/50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Finanzierungsbetrag:</span><span className="text-foreground font-medium">{fmt(baseAmount)} EUR</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monatliche Rate:</span><span className="text-foreground font-medium">{fmt(Math.round((baseAmount / termNum) * 100) / 100)} EUR</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Erste Rate am:</span><span className="text-foreground font-medium">{format(startDate, 'dd.MM.yyyy')}</span></div>
            </div>
          )}

          {!preview && (
            <Button onClick={handlePreview} disabled={baseAmount <= 0 || !termNum} className="gold-gradient text-primary-foreground w-full">
              Ratenplan berechnen
            </Button>
          )}

          {/* Preview table */}
          {preview && (
            <>
              <div className="rounded-xl border border-border overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-secondary">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Nr.</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Fälligkeitsdatum</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Rate</th>
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium">Restbetrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(row => (
                      <tr key={row.nr} className="border-t border-border">
                        <td className="px-3 py-1.5 text-muted-foreground">{row.nr}</td>
                        <td className="px-3 py-1.5 text-foreground">{format(row.dueDate, 'dd.MM.yyyy')}</td>
                        <td className="px-3 py-1.5 text-foreground text-right">{fmt(row.amount)} EUR</td>
                        <td className="px-3 py-1.5 text-foreground text-right">{fmt(row.remaining)} EUR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleCreate} disabled={saving} className="gold-gradient text-primary-foreground flex-1">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Banknote className="w-4 h-4 mr-2" />}
                  {saving ? 'Erstelle...' : 'Ratenplan erstellen & PDF herunterladen'}
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} className="border-border">
                  <Download className="w-4 h-4 mr-2" /> Nur PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
