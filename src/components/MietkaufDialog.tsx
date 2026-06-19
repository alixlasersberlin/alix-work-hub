import { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { createPDF } from '@/lib/pdf-utils';
import alixLogo from '@/assets/alix-logo-gold-pdf.png.asset.json';
import templateAsset from '@/assets/mietkauf-template.jpg.asset.json';

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

function getCustomerBank(order: any) {
  const c = order.customers || order.customer;
  if (!c) return { iban: '', bic: '', bank: '' };
  return { iban: c.iban || '', bic: c.bic || '', bank: c.bank_name || '' };
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

  // Region auto-detect from shipping/billing country
  const detectedRegion: 'DE' | 'EU' = useMemo(() => {
    const c = order?.customers || order?.customer;
    const a = c?.shipping_address || c?.billing_address;
    const country = String(a?.country || '').trim().toLowerCase();
    if (!country) return 'DE';
    if (['de', 'deutschland', 'germany'].includes(country)) return 'DE';
    return 'EU';
  }, [order]);
  const [region, setRegion] = useState<'DE' | 'EU'>(detectedRegion);
  useEffect(() => { setRegion(detectedRegion); }, [detectedRegion]);

  const isDE = region === 'DE';
  const flag = isDE ? '🇩🇪' : '🇪🇺';
  const priceLabel = isDE ? 'brutto' : 'netto';

  const kaufpreisNum = parseFloat(kaufpreis) || 0;
  const anzahlungNum = parseFloat(anzahlung) || 0;
  const restBetrag = Math.max(0, kaufpreisNum - anzahlungNum);
  const monatlicheRate = term > 0 ? Math.round((restBetrag / term) * 100) / 100 : 0;

  // DE: Kaufpreis bei Vertragsende = letzte monatliche Rate (auto)
  useEffect(() => {
    if (isDE) setKaufpreisEnde(monatlicheRate ? String(monatlicheRate.toFixed(2)) : '');
  }, [isDE, monatlicheRate]);

  const kaufpreisEndeNum = parseFloat(kaufpreisEnde) || 0;

  const isValid = kaufpreisNum > 0 && anzahlungNum >= 0 && restBetrag > 0;

  async function generatePDF() {
    const doc = createPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 18;
    const mr = 18;
    const cw = pw - ml - mr;

    // Background template on every page
    let templateData: string | null = null;
    try { templateData = await loadImageAsBase64(templateAsset.url); } catch { /* skip */ }
    const drawTemplate = () => {
      if (templateData) {
        try { doc.addImage(templateData, 'JPEG', 0, 0, pw, ph, undefined, 'FAST'); } catch { /* skip */ }
      }
    };
    drawTemplate();
    // Hook auto-add for subsequent pages
    const origAddPage = doc.addPage.bind(doc);
    (doc as any).addPage = (...args: any[]) => {
      const r = origAddPage(...args);
      drawTemplate();
      return r;
    };

    // Logo top-right, aligned to right content margin (gold logo, aspect ~5.33:1)
    try {
      const logoData = await loadImageAsBase64(alixLogo.url);
      const LOGO_W = 45;
      const LOGO_H = LOGO_W / 5.33;
      doc.addImage(logoData, 'PNG', pw - mr - LOGO_W, 12, LOGO_W, LOGO_H, undefined, 'FAST');
    } catch { /* skip */ }

    let y = 18;

    // Title
    doc.setFont('Inter', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Vertrag', ml, y);
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
    y += 8;

    // Bank details
    const bankInfo = getCustomerBank(order);
    if (bankInfo.iban || bankInfo.bic || bankInfo.bank) {
      doc.setFontSize(8);
      if (bankInfo.iban) { doc.text(`IBAN: ${bankInfo.iban}`, ml, y); y += 4; }
      if (bankInfo.bic) { doc.text(`BIC: ${bankInfo.bic}`, ml, y); y += 4; }
      if (bankInfo.bank) { doc.text(`Bank: ${bankInfo.bank}`, ml, y); y += 4; }
      doc.setFontSize(10);
    }
    y += 6;

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
    doc.text(`1. Rate (${priceLabel})`, ml + 3, y + 5);
    doc.setFont('Inter', 'normal');
    doc.text(fmtCurrency(anzahlungNum), col3 - 3, y + 5, { align: 'right' });
    y += rowH;

    // Monatl. Raten
    drawFinRow(y);
    doc.setFont('Inter', 'bold');
    doc.text(`Monatl. Raten (${priceLabel}):`, ml + 3, y + 5);
    doc.setFont('Inter', 'normal');
    doc.text(fmtCurrency(monatlicheRate), col3 - 3, y + 5, { align: 'right' });
    y += rowH;

    // Kaufpreis bei Vertragsende
    drawFinRow(y);
    doc.setFont('Inter', 'bold');
    doc.text(`Kaufpreis bei Vertragsende (${priceLabel})`, ml + 3, y + 5);
    doc.setFont('Inter', 'normal');
    doc.text(fmtCurrency(kaufpreisEndeNum), col3 - 3, y + 5, { align: 'right' });
    y += rowH;

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
    <>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-primary/30 text-primary hover:bg-primary/10"
      onClick={() => { console.log('[MietkaufDialog] open click'); setOpen(true); }}
    >
      <FileText className="w-4 h-4 mr-2" /> Mietkauf
    </Button>
    {open && (
      <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-8 backdrop-blur-sm">
        <div className="relative w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-lg">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <span className="text-xl leading-none" title={isDE ? 'Deutschland' : 'EU'}>{flag}</span>
              Mietkaufvertrag erstellen
            </h2>
            <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setRegion('DE')}
                className={`px-2 py-1 rounded ${isDE ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >🇩🇪 DE</button>
              <button
                type="button"
                onClick={() => setRegion('EU')}
                className={`px-2 py-1 rounded ${!isDE ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >🇪🇺 EU</button>
            </div>
          </div>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-muted-foreground">Gerät Modell</label>
              <Input value={geraetModell} onChange={e => setGeraetModell(e.target.value)} placeholder="z.B. Alix Pro 2000" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Gesamtbetrag {priceLabel} (€)</label>
              <Input type="number" min={0} step="0.01" value={kaufpreis} onChange={e => setKaufpreis(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">1. Rate / Anzahlung {priceLabel} (€)</label>
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
              <label className="text-sm text-muted-foreground">
                Kaufpreis bei Vertragsende {priceLabel} (€)
                {isDE && <span className="ml-1 text-xs">(automatisch = letzte monatliche Rate)</span>}
              </label>
              <Input
                type="number" min={0} step="0.01"
                value={kaufpreisEnde}
                onChange={e => setKaufpreisEnde(e.target.value)}
                placeholder="0,00"
                className="bg-secondary border-border"
                disabled={isDE}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Zusätzliche Serviceleistungen</label>
              <Input value={zusatzService} onChange={e => setZusatzService(e.target.value)} placeholder="Optional" className="bg-secondary border-border" />
            </div>

            {isValid && (
              <div className="rounded-lg bg-secondary/50 border border-border p-3 text-sm space-y-1">
                <p className="text-muted-foreground">Gesamtbetrag ({priceLabel}): <span className="text-foreground font-medium">{fmtCurrency(kaufpreisNum)}</span></p>
                <p className="text-muted-foreground">1. Rate / Anzahlung ({priceLabel}): <span className="text-foreground font-medium">{fmtCurrency(anzahlungNum)}</span></p>
                <p className="text-muted-foreground">Restbetrag ({priceLabel}): <span className="text-foreground font-medium">{fmtCurrency(restBetrag)}</span></p>
                <p className="text-muted-foreground">Monatliche Rate ({priceLabel}): <span className="text-foreground font-medium">{fmtCurrency(monatlicheRate)}</span></p>
                <p className="text-muted-foreground">Kaufpreis bei Vertragsende ({priceLabel}): <span className="text-foreground font-medium">{fmtCurrency(kaufpreisEndeNum)}</span></p>
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
        </div>
      </div>
    )}
    </>
  );
}
