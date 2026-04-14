import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, FileText, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface Props {
  order: any;
}

const TERMS = [12, 24, 36, 48, 60] as const;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfNextMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtCurrency(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function drawWatermark(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  // @ts-ignore — setGState exists on jsPDF
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
  doc.setFontSize(54);
  doc.setTextColor(120, 120, 120);
  // draw diagonal watermark text across the page center
  const cx = pageW / 2;
  const cy = pageH / 2;
  doc.text('Alix Lasers ®', cx, cy, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();
}

export default function InstallmentPlanDialog({ order }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [term, setTerm] = useState<number>(12);
  const [saving, setSaving] = useState(false);

  const deliveryDate = order.expected_shipment_date ? new Date(order.expected_shipment_date) : new Date();

  const baseAmount = Math.max(0, (parseFloat(price) || 0) - (parseFloat(downPayment) || 0));
  const monthlyRate = term > 0 ? Math.round((baseAmount / term) * 100) / 100 : 0;

  const schedule = useMemo(() => {
    if (baseAmount <= 0 || monthlyRate <= 0) return [];
    const start = startOfNextMonth(deliveryDate);
    const rows: { nr: number; dueDate: Date; amount: number; remaining: number }[] = [];
    let remaining = baseAmount;
    for (let i = 1; i <= term; i++) {
      const amount = i === term ? Math.round(remaining * 100) / 100 : monthlyRate;
      remaining = Math.round((remaining - amount) * 100) / 100;
      rows.push({ nr: i, dueDate: addMonths(start, i - 1), amount, remaining: Math.max(0, remaining) });
    }
    return rows;
  }, [baseAmount, monthlyRate, term, deliveryDate]);

  function generatePDF() {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    // Watermark on first page
    drawWatermark(doc);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Ratenplan', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Auftrag: ${order.order_number}`, 14, 32);
    doc.text(`Erstellt am: ${fmtDate(new Date())}`, 14, 38);
    doc.text(`Kaufpreis: ${fmtCurrency(parseFloat(price) || 0)}`, 14, 46);
    doc.text(`Anzahlung: ${fmtCurrency(parseFloat(downPayment) || 0)}`, 14, 52);
    doc.text(`Basiswert: ${fmtCurrency(baseAmount)}`, 14, 58);
    doc.text(`Laufzeit: ${term} Monate`, 14, 64);
    doc.text(`Monatliche Rate: ${fmtCurrency(monthlyRate)}`, 14, 70);

    // Table header
    let y = 82;
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(30, 30, 30);
    doc.rect(14, y - 5, pw - 28, 8, 'F');
    doc.text('Nr.', 18, y);
    doc.text('Fälligkeitsdatum', 40, y);
    doc.text('Rate', 110, y, { align: 'right' });
    doc.text('Restbetrag', pw - 18, y, { align: 'right' });

    y += 10;
    doc.setTextColor(40, 40, 40);

    for (const row of schedule) {
      if (y > 270) {
        doc.addPage();
        drawWatermark(doc);
        y = 20;
        // repeat header
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(30, 30, 30);
        doc.rect(14, y - 5, pw - 28, 8, 'F');
        doc.text('Nr.', 18, y);
        doc.text('Fälligkeitsdatum', 40, y);
        doc.text('Rate', 110, y, { align: 'right' });
        doc.text('Restbetrag', pw - 18, y, { align: 'right' });
        y += 10;
        doc.setTextColor(40, 40, 40);
      }

      if (row.nr % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(14, y - 5, pw - 28, 7, 'F');
      }

      doc.text(`${row.nr}`, 18, y);
      doc.text(fmtDate(row.dueDate), 40, y);
      doc.text(fmtCurrency(row.amount), 110, y, { align: 'right' });
      doc.text(fmtCurrency(row.remaining), pw - 18, y, { align: 'right' });
      y += 7;
    }

    // Total line
    y += 4;
    doc.setDrawColor(30, 30, 30);
    doc.line(14, y - 3, pw - 14, y - 3);
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text('Gesamtbetrag:', 14, y + 2);
    doc.text(fmtCurrency(baseAmount), pw - 18, y + 2, { align: 'right' });

    doc.save(`Ratenplan_${order.order_number}.pdf`);
  }

  async function createAndExport() {
    if (schedule.length === 0) return;
    setSaving(true);
    try {
      const records = schedule.map(row => ({
        order_id: order.id,
        payment_status: 'offen',
        invoice_status: 'offen',
        due_date: row.dueDate.toISOString().split('T')[0],
        amount_due: row.amount,
        amount_paid: 0,
        currency: order.currency || 'EUR',
        finance_note: `Ratenplan Rate ${row.nr}/${term}`,
        created_by: user?.id,
      }));

      const { error } = await supabase.from('finance_records').insert(records);
      if (error) throw error;

      generatePDF();
      toast({ title: 'Ratenplan erstellt', description: `${term} Raten wurden in Finance angelegt und als PDF exportiert.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
          <FileText className="w-4 h-4 mr-2" /> Ratenplan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Ratenplan erstellen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm text-muted-foreground">Kaufpreis (€)</label>
            <Input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Anzahlung (€)</label>
            <Input type="number" min={0} step="0.01" value={downPayment} onChange={e => setDownPayment(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Laufzeit</label>
            <Select value={String(term)} onValueChange={v => setTerm(Number(v))}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMS.map(t => (
                  <SelectItem key={t} value={String(t)}>{t} Monate</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {baseAmount > 0 && (
            <div className="rounded-lg bg-secondary/50 border border-border p-3 text-sm space-y-1">
              <p className="text-muted-foreground">Basiswert: <span className="text-foreground font-medium">{fmtCurrency(baseAmount)}</span></p>
              <p className="text-muted-foreground">Monatliche Rate: <span className="text-foreground font-medium">{fmtCurrency(monthlyRate)}</span></p>
              <p className="text-muted-foreground">Erste Rate am: <span className="text-foreground font-medium">{schedule.length > 0 ? fmtDate(schedule[0].dueDate) : '—'}</span></p>
            </div>
          )}

          <Button onClick={createAndExport} disabled={schedule.length === 0 || saving} className="w-full gold-gradient text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {saving ? 'Erstelle...' : 'Ratenplan erstellen & PDF exportieren'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
