import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, FileText, Download, CalendarIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { de } from 'date-fns/locale';
import jsPDF from 'jspdf';
import alixLogo from '@/assets/alix-lasers-logo.png';

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
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
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
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.setFontSize(54);
  doc.setTextColor(80, 80, 80);
  doc.text('Alix Lasers ®', pageW / 2, pageH / 2, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();
}

function getCustomerName(order: any): string {
  const c = order.customers || order.customer;
  if (!c) return '';
  return c.company_name || c.contact_name || '';
}

function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export default function InstallmentPlanDialog({ order }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [term, setTerm] = useState<number>(12);
  const [saving, setSaving] = useState(false);

  const deliveryDate = order.expected_shipment_date ? new Date(order.expected_shipment_date) : new Date();
  const defaultStart = startOfNextMonth(deliveryDate);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);

  const effectiveStart = startDate || defaultStart;

  const baseAmount = Math.max(0, (parseFloat(price) || 0) - (parseFloat(downPayment) || 0));
  const monthlyRate = term > 0 ? Math.round((baseAmount / term) * 100) / 100 : 0;

  const schedule = useMemo(() => {
    if (baseAmount <= 0 || monthlyRate <= 0) return [];
    const rows: { nr: number; dueDate: Date; amount: number; remaining: number }[] = [];
    let remaining = baseAmount;
    for (let i = 1; i <= term; i++) {
      const amount = i === term ? Math.round(remaining * 100) / 100 : monthlyRate;
      remaining = Math.round((remaining - amount) * 100) / 100;
      rows.push({ nr: i, dueDate: addMonths(effectiveStart, i - 1), amount, remaining: Math.max(0, remaining) });
    }
    return rows;
  }, [baseAmount, monthlyRate, term, effectiveStart]);

  async function generatePDF() {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    drawWatermark(doc);

    // Logo top-right
    try {
      const logoData = await loadImageAsBase64(alixLogo);
      doc.addImage(logoData, 'PNG', pw - 60, 8, 46, 20);
    } catch {
      // logo load failed, skip
    }

    // Title
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Ratenplan', 14, 22);

    // Customer name
    const customerName = getCustomerName(order);
    let addrY = 32;
    if (customerName) {
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.setFont(undefined!, 'bold');
      doc.text(customerName, 14, addrY);
      doc.setFont(undefined!, 'normal');
      addrY += 7;
    }

    // Customer address
    const addr = order.shipping_address || order.billing_address;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    if (addr && typeof addr === 'object') {
      const a = addr as Record<string, any>;
      const lines = [
        a.attention || a.name || '',
        a.street || a.address || a.line1 || '',
        [a.zip || a.postal_code || '', a.city || ''].filter(Boolean).join(' '),
        a.state || '',
        a.country || '',
      ].filter(Boolean);
      for (const line of lines) {
        doc.text(line, 14, addrY);
        addrY += 5;
      }
      addrY += 3;
    }

    doc.setTextColor(100, 100, 100);
    doc.text(`Auftrag: ${order.order_number}`, 14, addrY);
    doc.text(`Erstellt am: ${fmtDate(new Date())}`, 14, addrY + 6);
    doc.text(`Kaufpreis: ${fmtCurrency(parseFloat(price) || 0)}`, 14, addrY + 14);
    doc.text(`Anzahlung: ${fmtCurrency(parseFloat(downPayment) || 0)}`, 14, addrY + 20);
    doc.text(`Basiswert: ${fmtCurrency(baseAmount)}`, 14, addrY + 26);
    doc.text(`Laufzeit: ${term} Monate`, 14, addrY + 32);
    doc.text(`Monatliche Rate: ${fmtCurrency(monthlyRate)}`, 14, addrY + 38);
    const tableStartY = addrY + 50;

    // Table header
    let y = tableStartY;
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

      await generatePDF();
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
          <div>
            <label className="text-sm text-muted-foreground">Erste Rate am</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left bg-secondary border-border", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {startDate ? fmtDate(startDate) : fmtDate(defaultStart) + ' (automatisch)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate || defaultStart} onSelect={setStartDate} locale={de} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {startDate && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground mt-1 h-6 px-1" onClick={() => setStartDate(undefined)}>
                Auf automatisch zurücksetzen
              </Button>
            )}
          </div>

          {baseAmount > 0 && (
            <div className="rounded-lg bg-secondary/50 border border-border p-3 text-sm space-y-1">
              <p className="text-muted-foreground">Basiswert: <span className="text-foreground font-medium">{fmtCurrency(baseAmount)}</span></p>
              <p className="text-muted-foreground">Monatliche Rate: <span className="text-foreground font-medium">{fmtCurrency(monthlyRate)}</span></p>
              <p className="text-muted-foreground">Erste Rate am: <span className="text-foreground font-medium">{schedule.length > 0 ? fmtDate(schedule[0].dueDate) : '—'}</span></p>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={async () => { await generatePDF(); toast({ title: 'PDF exportiert', description: 'Ratenplan wurde als PDF heruntergeladen.' }); }} disabled={schedule.length === 0} variant="outline" className="flex-1 border-primary/30 text-primary hover:bg-primary/10">
              <Download className="w-4 h-4 mr-2" /> Nur PDF
            </Button>
            <Button onClick={createAndExport} disabled={schedule.length === 0 || saving} className="flex-1 gold-gradient text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {saving ? 'Erstelle...' : 'PDF & Finance'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
