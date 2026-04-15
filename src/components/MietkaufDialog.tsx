import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileText, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createPDF } from '@/lib/pdf-utils';
import alixLogo from '@/assets/alix-lasers-logo.png';

interface Props {
  order: any;
}

const TERMS = [12, 24, 36, 48, 60] as const;
const VAT_RATE = 0.19;

const ALIX = {
  name: 'Alix Lasers GmbH',
  street: 'Buchsbaumweg 53',
  city: '12357 Berlin',
  ustIdNr: 'DE321691012',
};

function fmtCurrency(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function getCustomerName(order: any): string {
  const c = order.customers || order.customer;
  if (!c) return '';
  return c.company_name || c.contact_name || '';
}

function getCustomerAddr(order: any) {
  const c = order.customers || order.customer;
  if (!c) return '';
  const a = c.billing_address || c.shipping_address;
  if (!a || typeof a !== 'object') return '';
  const parts = [
    a.address || a.street || '',
    [a.zip || a.postal_code || '', a.city || ''].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.join(', ');
}

function getDeviceModel(order: any): string {
  // Try to get from first item
  if (order.items && order.items.length > 0) return order.items[0].item_name || '';
  return '';
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

export default function MietkaufDialog({ order }: Props) {
  const [open, setOpen] = useState(false);
  const [kaufpreis, setKaufpreis] = useState('');
  const [anzahlung, setAnzahlung] = useState('');
  const [term, setTerm] = useState<number>(12);
  const [geraetModell, setGeraetModell] = useState('');
  const [zusatzService, setZusatzService] = useState('');
  const [kaufpreisEnde, setKaufpreisEnde] = useState('');
  const [mitMwst, setMitMwst] = useState(true);

  const kaufpreisNum = parseFloat(kaufpreis) || 0;
  const anzahlungNum = parseFloat(anzahlung) || 0;
  const restBetrag = Math.max(0, kaufpreisNum - anzahlungNum);
  const monatlicheRate = term > 0 ? Math.round((restBetrag / term) * 100) / 100 : 0;

  // VAT calculations
  const vatRate = mitMwst ? VAT_RATE : 0;
  const anzahlungVat = Math.round(anzahlungNum * vatRate * 100) / 100;
  const anzahlungBrutto = Math.round((anzahlungNum + anzahlungVat) * 100) / 100;
  const rateVat = Math.round(monatlicheRate * vatRate * 100) / 100;
  const rateBrutto = Math.round((monatlicheRate + rateVat) * 100) / 100;
  const kaufpreisEndeNum = parseFloat(kaufpreisEnde) || 0;
  const kaufpreisEndeVat = Math.round(kaufpreisEndeNum * vatRate * 100) / 100;

  const isValid = kaufpreisNum > 0 && anzahlungNum >= 0 && restBetrag > 0;

  async function generatePDF() {
    const doc = createPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ml = 18;
    const mr = 18;
    const cw = pw - ml - mr;

    // Logo top-right
    try {
      const logoData = await loadImageAsBase64(alixLogo);
      doc.addImage(logoData, 'PNG', pw - 60, 8, 46, 20);
    } catch { /* skip */ }

    let y = 18;

    // Title
    doc.setFont('Inter', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Mietkauf', ml, y);
    y += 12;

    // "zwischen"
    doc.setFont('Inter', 'normal');
    doc.setFontSize(10);
    doc.text('zwischen', ml, y);
    y += 8;

    // Alix info
    doc.text(ALIX.name, ml, y);
    y += 5;
    doc.text(ALIX.street, ml, y);
    y += 5;
    doc.text(ALIX.city, ml, y);

    // "- Alix Lasers GmbH" right-aligned
    doc.setFont('Inter', 'bold');
    doc.text('- Alix Lasers GmbH', pw - mr, y, { align: 'right' });
    doc.setFont('Inter', 'normal');
    y += 10;

    doc.text('und', ml, y);
    y += 10;

    // Customer name
    const customerName = getCustomerName(order);
    const customerAddr = getCustomerAddr(order);
    if (customerName) {
      doc.text(customerName, ml, y);
    }
    if (customerAddr) {
      y += 5;
      doc.text(customerAddr, ml, y);
    }

    // "- Kunde" right-aligned
    doc.setFont('Inter', 'bold');
    doc.text('- Kunde', pw - mr, y, { align: 'right' });
    doc.setFont('Inter', 'normal');
    y += 14;

    // ── Device/Order table ──
    const drawRow = (ry: number, h: number) => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(ml, ry, cw, h);
    };

    // Gerät Modell
    drawRow(y, 8);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.text('Gerät Modell:', ml + 3, y + 5.5);
    doc.setFont('Inter', 'normal');
    doc.text(geraetModell || getDeviceModel(order), ml + cw * 0.35, y + 5.5);
    // vertical line
    doc.line(ml + cw * 0.33, y, ml + cw * 0.33, y + 8);
    y += 8;

    // Auftragsnummer
    drawRow(y, 8);
    doc.setFont('Inter', 'bold');
    doc.text('Auftragsnummer:', ml + 3, y + 5.5);
    doc.setFont('Inter', 'normal');
    doc.text(order.order_number || '', ml + cw * 0.35, y + 5.5);
    doc.line(ml + cw * 0.33, y, ml + cw * 0.33, y + 8);
    y += 8;

    // Zusätzliche Serviceleistungen
    drawRow(y, 8);
    doc.setFont('Inter', 'bold');
    doc.text('Zusätzliche Serviceleistungen:', ml + 3, y + 5.5);
    doc.setFont('Inter', 'normal');
    doc.text(zusatzService, ml + cw * 0.35, y + 5.5);
    doc.line(ml + cw * 0.33, y, ml + cw * 0.33, y + 8);
    y += 14;

    // ── Laufzeit checkboxes ──
    doc.setFont('Inter', 'bold');
    doc.setFontSize(10);
    doc.text('Laufzeit:', ml, y);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    const termOptions = [
      { label: '1 Jahr', months: 12 },
      { label: '2 Jahre', months: 24 },
      { label: '3 Jahre', months: 36 },
      { label: '4 Jahre', months: 48 },
      { label: '5 Jahre', months: 60 },
    ];
    let cx = ml + 22;
    for (const opt of termOptions) {
      doc.rect(cx, y - 3, 3.5, 3.5);
      if (term === opt.months) {
        // Draw checkmark
        doc.setFont('Inter', 'bold');
        doc.text('X', cx + 0.7, y - 0.2);
        doc.setFont('Inter', 'normal');
      }
      doc.text(opt.label, cx + 5, y);
      cx += 28;
    }
    
    y += 12;

    // ── Financial table ──
    const col1 = ml;
    const col2 = ml + cw * 0.45;
    const col3 = pw - mr;
    const rowH = 7;

    const drawFinRow = (ry: number) => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(ml, ry, cw, rowH);
      doc.line(col2 - 5, ry, col2 - 5, ry + rowH);
      doc.line(col2 + cw * 0.25, ry, col2 + cw * 0.25, ry + rowH);
    };

    // 1. Rate
    drawFinRow(y);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.text('1. Rate', ml + 3, y + 5);
    doc.setFont('Inter', 'normal');
    doc.text(fmtCurrency(anzahlungNum), col3 - 3, y + 5, { align: 'right' });
    y += rowH;

    if (mitMwst) {
      // zzgl. Umsatzsteuer
      drawFinRow(y);
      doc.text('zzgl. Umsatzsteuer', col2 - 2, y + 5);
      doc.text(fmtCurrency(anzahlungVat), col3 - 3, y + 5, { align: 'right' });
      y += rowH;

      // zu zahlender Betrag
      drawFinRow(y);
      doc.setFont('Inter', 'bold');
      doc.text('zu zahlender Betrag', col2 - 2, y + 5);
      doc.text(fmtCurrency(anzahlungBrutto), col3 - 3, y + 5, { align: 'right' });
      doc.setFont('Inter', 'normal');
      y += rowH;
    }

    // Monatl. Raten
    drawFinRow(y);
    doc.setFont('Inter', 'bold');
    doc.text('Monatl. Raten:', ml + 3, y + 5);
    doc.setFont('Inter', 'normal');
    doc.text(fmtCurrency(monatlicheRate), col3 - 3, y + 5, { align: 'right' });
    y += rowH;

    if (mitMwst) {
      // zzgl. Umsatzsteuer
      drawFinRow(y);
      doc.text('zzgl. Umsatzsteuer', col2 - 2, y + 5);
      doc.text(fmtCurrency(rateVat), col3 - 3, y + 5, { align: 'right' });
      y += rowH;

      // Monatlich zu zahlende Rate
      drawFinRow(y);
      doc.setFont('Inter', 'bold');
      doc.text('Monatlich zu zahlende Rate', col2 - 2, y + 5);
      doc.text(fmtCurrency(rateBrutto), col3 - 3, y + 5, { align: 'right' });
      doc.setFont('Inter', 'normal');
      y += rowH;
    }

    // Kaufpreis bei Vertragsende
    drawFinRow(y);
    doc.setFont('Inter', 'bold');
    doc.text('Kaufpreis', ml + 3, y + 5);
    doc.setFont('Inter', 'normal');
    doc.text(fmtCurrency(kaufpreisEndeNum), col3 - 3, y + 5, { align: 'right' });
    y += rowH;

    if (mitMwst) {
      drawFinRow(y);
      doc.setFont('Inter', 'bold');
      doc.text('bei Vertragsende', ml + 3, y + 5);
      doc.setFont('Inter', 'normal');
      doc.text('Zzgl. Umsatzsteuer', col2 - 2, y + 5);
      doc.text(fmtCurrency(kaufpreisEndeVat), col3 - 3, y + 5, { align: 'right' });
      y += rowH;
    }
    y += rowH + 8;

    // ── Nutzungsort ──
    doc.setFont('Inter', 'bold');
    doc.setFontSize(10);
    doc.text('Nutzungsort:', ml, y);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    y += 5;
    doc.text('(falls abweichend von Anschrift des Kunden):', ml, y);
    doc.line(ml, y + 1.5, ml + cw, y + 1.5);
    y += 12;

    // ── AGB note ──
    doc.setFontSize(9);
    doc.setFont('Inter', 'bold');
    const agbText = 'Es gelten die Allgemeinen Geschäftsbedingungen der Alix Lasers GmbH, die im Internet unter alix-lasers.de eingesehen werden können.';
    const agbLines = doc.splitTextToSize(agbText, cw);
    doc.text(agbLines, ml, y);
    doc.setFont('Inter', 'normal');
    y += agbLines.length * 5 + 10;

    // ── Signature section ──
    const sigColW = cw / 2 - 5;

    // Left: Alix
    doc.setFontSize(9);
    doc.text('Berlin, den', ml, y);
    doc.line(ml + 22, y + 0.5, ml + sigColW, y + 0.5);
    y += 10;
    doc.setFont('Inter', 'bold');
    doc.text('Alix Lasers GmbH', ml, y);
    doc.setFont('Inter', 'normal');

    // Right: Kunde
    const rightX = ml + sigColW + 10;
    doc.text('Berlin, den', rightX, y - 10);
    doc.line(rightX + 22, y - 10 + 0.5, rightX + sigColW, y - 10 + 0.5);
    doc.setFont('Inter', 'bold');
    doc.text('Kunde', rightX, y);
    doc.setFont('Inter', 'normal');

    // ── Footer ──
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(
      `Alix Lasers GmbH - Alix Lasers ® Deutschland – Buchsbaumweg 53 - 12357 Berlin, DE - USt-IdNr.: ${ALIX.ustIdNr}`,
      pw / 2,
      footerY,
      { align: 'center' }
    );

    doc.save(`Mietkauf_${order.order_number}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
          <FileText className="w-4 h-4 mr-2" /> Mietkauf
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Mietkaufvertrag erstellen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm text-muted-foreground">Gerät Modell</label>
            <Input value={geraetModell} onChange={e => setGeraetModell(e.target.value)} placeholder="z.B. Alix Pro 2000" className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Kaufpreis netto (€)</label>
            <Input type="number" min={0} step="0.01" value={kaufpreis} onChange={e => setKaufpreis(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">1. Rate / Anzahlung netto (€)</label>
            <Input type="number" min={0} step="0.01" value={anzahlung} onChange={e => setAnzahlung(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Laufzeit</label>
            <Select value={String(term)} onValueChange={v => setTerm(Number(v))}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMS.map(t => (
                  <SelectItem key={t} value={String(t)}>{t / 12} {t === 12 ? 'Jahr' : 'Jahre'} ({t} Monate)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Kaufpreis bei Vertragsende netto (€)</label>
            <Input type="number" min={0} step="0.01" value={kaufpreisEnde} onChange={e => setKaufpreisEnde(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 border border-border p-3">
            <Label htmlFor="mwst-toggle" className="text-sm text-muted-foreground cursor-pointer">19% MwSt. ausweisen</Label>
            <Switch id="mwst-toggle" checked={mitMwst} onCheckedChange={setMitMwst} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Zusätzliche Serviceleistungen</label>
            <Input value={zusatzService} onChange={e => setZusatzService(e.target.value)} placeholder="Optional" className="bg-secondary border-border" />
          </div>

          {isValid && (
            <div className="rounded-lg bg-secondary/50 border border-border p-3 text-sm space-y-1">
              <p className="text-muted-foreground">Kaufpreis: <span className="text-foreground font-medium">{fmtCurrency(kaufpreisNum)}</span></p>
              <p className="text-muted-foreground">1. Rate (Anzahlung): <span className="text-foreground font-medium">{fmtCurrency(anzahlungNum)} netto / {fmtCurrency(anzahlungBrutto)} brutto</span></p>
              <p className="text-muted-foreground">Restbetrag: <span className="text-foreground font-medium">{fmtCurrency(restBetrag)}</span></p>
              <p className="text-muted-foreground">Monatliche Rate: <span className="text-foreground font-medium">{fmtCurrency(monatlicheRate)} netto / {fmtCurrency(rateBrutto)} brutto</span></p>
              <p className="text-muted-foreground">Laufzeit: <span className="text-foreground font-medium">{term} Monate</span></p>
            </div>
          )}

          <Button
            onClick={async () => {
              await generatePDF();
              toast({ title: 'PDF exportiert', description: 'Mietkaufvertrag wurde als PDF heruntergeladen.' });
            }}
            disabled={!isValid}
            className="w-full gold-gradient text-primary-foreground"
          >
            <Download className="w-4 h-4 mr-2" /> PDF erstellen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
