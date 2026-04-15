import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { createPDF } from '@/lib/pdf-utils';

interface Props {
  order: any;
}

const ALIX = {
  name: 'Alix Lasers GmbH',
  street: 'Buchsbaumweg 53',
  city: '12357 Berlin',
  country: 'Deutschland',
  glaeubigerId: 'DE02ZZZ00002605062',
};

function formatAddr(a: any) {
  if (!a) return { street: '', zipCity: '' };
  if (typeof a === 'string') return { street: a, zipCity: '' };
  const street = a.address || a.street || '';
  const zipCity = [a.zip, a.city].filter(Boolean).join(' ');
  return { street, zipCity };
}

export default function SepaMandatButton({ order }: Props) {
  const customer = order.customers;

  function generateSepaMandat() {
    const doc = createPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 18; // margin left
    const mr = 18;
    const cw = pw - ml - mr; // content width
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const customerName = customer?.company_name || customer?.contact_name || '';
    const addr = formatAddr(customer?.billing_address || customer?.shipping_address);

    // Helper: draw a bordered section row
    const drawRow = (y: number, h: number) => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(ml, y, cw, h);
    };

    const drawLabel = (label: string, x: number, y: number, size = 9) => {
      doc.setFont('Inter', 'bold');
      doc.setFontSize(size);
      doc.text(label, x, y);
      doc.setFont('Inter', 'normal');
    };

    const drawValue = (val: string, x: number, y: number, size = 10) => {
      doc.setFont('Inter', 'normal');
      doc.setFontSize(size);
      doc.text(val, x, y);
    };

    let y = 14;

    // ── Title ──
    drawRow(y, 22);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(16);
    doc.text('Erteilung einer Einzugsermächtigung', ml + 4, y + 10);
    doc.text('und eines SEPA-Lastschriftmandats', ml + 4, y + 17);
    y += 22;

    // ── Zahlungsempfänger Name ──
    drawRow(y, 12);
    drawLabel('Name des Zahlungsempfängers:', ml + 4, y + 5);
    drawValue(ALIX.name, ml + 72, y + 5);
    y += 12;

    // ── Anschrift Zahlungsempfänger ──
    drawRow(y, 24);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.text('Anschrift des Zahlungsempfängers', ml + 4, y + 5);
    // Underline
    const tw = doc.getTextWidth('Anschrift des Zahlungsempfängers');
    doc.line(ml + 4, y + 5.5, ml + 4 + tw, y + 5.5);
    doc.setFont('Inter', 'normal');

    drawLabel('Straße und Hausnummer:', ml + 4, y + 11);
    drawValue(ALIX.street, ml + 55, y + 11);

    drawLabel('Postleitzahl und Ort:', ml + 4, y + 19);
    drawValue(ALIX.city, ml + 55, y + 19);
    y += 24;

    // ── Gläubiger-ID ──
    drawRow(y, 14);
    drawLabel('Gläubiger-Identifikationsnummer:', ml + 4, y + 5);
    // Box for ID
    doc.setLineWidth(0.2);
    doc.rect(ml + 4, y + 7, cw - 8, 5);
    drawValue(ALIX.glaeubigerId, ml + 6, y + 11, 9);
    y += 14;

    // ── Mandatsreferenz ──
    drawRow(y, 14);
    drawLabel('Mandatsreferenz (vom Zahlungsempfänger auszufüllen):', ml + 4, y + 5);
    doc.rect(ml + 4, y + 7, cw - 8, 5);
    drawValue(order.order_number || '', ml + 6, y + 11, 9);
    y += 14;

    // ── Einzugsermächtigung ──
    drawRow(y, 20);
    drawLabel('Einzugsermächtigung:', ml + 4, y + 5);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(8);
    const einzugText = 'Ich ermächtige / Wir ermächtigen den Zahlungsempfänger (Name siehe oben) widerruflich, die von mir / uns zu entrichtenden Zahlungen bei Fälligkeit durch Lastschrift von meinem / unserem Konto einzuziehen.';
    const einzugLines = doc.splitTextToSize(einzugText, cw - 8);
    doc.text(einzugLines, ml + 4, y + 10);
    y += 20;

    // ── SEPA-Lastschriftmandat ──
    drawRow(y, 28);
    drawLabel('SEPA-Lastschriftmandat:', ml + 4, y + 5);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(8);
    const sepaText = 'Ich ermächtige / Wir ermächtigen (A) den Zahlungsempfänger (Name siehe oben), Zahlungen von meinem / unserem Konto mittels Lastschrift einzuziehen. Zugleich (B) weise ich mein / weisen wir unser Kreditinstitut an, die vom Zahlungsempfänger (Name siehe oben) auf mein / unser Konto gezogenen Lastschriften einzulösen.';
    const sepaLines = doc.splitTextToSize(sepaText, cw - 8);
    doc.text(sepaLines, ml + 4, y + 10);

    doc.setFontSize(7.5);
    const hinweisText = 'Hinweis: Ich kann / Wir können innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem / unserem Kreditinstitut vereinbarten Bedingungen.';
    const hinweisLines = doc.splitTextToSize(hinweisText, cw - 8);
    doc.text(hinweisLines, ml + 4, y + 21);
    y += 28;

    // ── Zahlungsart ──
    drawRow(y, 10);
    drawLabel('Zahlungsart:', ml + 4, y + 5);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    // Checkboxes
    doc.rect(ml + 40, y + 2, 3.5, 3.5);
    doc.text('Wiederkehrende Zahlung', ml + 45, y + 5);
    doc.rect(ml + 100, y + 2, 3.5, 3.5);
    doc.text('Einmalige Zahlung', ml + 105, y + 5);
    y += 10;

    // ── Zahlungspflichtiger Name ──
    drawRow(y, 12);
    drawLabel('Name des Zahlungspflichtigen (Kontoinhaber):', ml + 4, y + 5);
    drawValue(customerName, ml + 4, y + 10, 10);
    y += 12;

    // ── Anschrift Zahlungspflichtiger ──
    drawRow(y, 24);
    doc.setFont('Inter', 'bold');
    doc.setFontSize(9);
    doc.text('Anschrift des Zahlungspflichtigen (Kontoinhaber)', ml + 4, y + 5);
    const tw2 = doc.getTextWidth('Anschrift des Zahlungspflichtigen (Kontoinhaber)');
    doc.line(ml + 4, y + 5.5, ml + 4 + tw2, y + 5.5);
    doc.setFont('Inter', 'normal');

    drawLabel('Straße und Hausnummer:', ml + 4, y + 11);
    drawValue(addr.street, ml + 55, y + 11);

    drawLabel('Postleitzahl und Ort:', ml + 4, y + 19);
    drawValue(addr.zipCity, ml + 55, y + 19);
    y += 24;

    // ── IBAN ──
    drawRow(y, 14);
    drawLabel('IBAN des Zahlungspflichtigen (max. 22 Stellen):', ml + 4, y + 5);
    // IBAN box with DE prefix
    doc.rect(ml + 4, y + 7, cw - 8, 5);
    doc.setFontSize(10);
    doc.setFont('Inter', 'bold');
    doc.text('D E', ml + 6, y + 11);
    doc.setFont('Inter', 'normal');
    y += 14;

    // ── BIC ──
    drawRow(y, 12);
    drawLabel('BIC (8 oder 11 Stellen):', ml + 4, y + 5);
    doc.rect(ml + 4, y + 7, 60, 4);
    doc.setFontSize(10);
    doc.setFont('Inter', 'bold');
    doc.text('D E', ml + 20, y + 10);
    doc.setFont('Inter', 'normal');
    y += 12;

    // ── Ort / Datum / Unterschrift ──
    drawRow(y, 30);
    drawLabel('Ort:', ml + 4, y + 5);
    // Ort line
    doc.setLineWidth(0.2);
    doc.line(ml + 12, y + 6, ml + 70, y + 6);

    drawLabel('Datum (TT/MM/JJJJ):', ml + cw - 60, y + 5);
    doc.rect(ml + cw - 25, y + 2, 22, 5);
    drawValue(today, ml + cw - 24, y + 5.5, 8);

    drawLabel('Unterschrift(en) des Zahlungspflichtigen (Kontoinhaber):', ml + 4, y + 14);
    // Signature line
    doc.line(ml + 4, y + 26, ml + cw - 8, y + 26);
    y += 30;

    // ── Footer note ──
    doc.setFontSize(7);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(80);
    const footerText = 'Vor dem ersten Einzug einer SEPA-Lastschrift wird mich / uns der Zahlungsempfänger (Name siehe oben) über den Einzug in dieser Verfahrensart unterrichten.';
    const footerLines = doc.splitTextToSize(footerText, cw);
    doc.text(footerLines, ml, y + 5);

    doc.save(`SEPA-Mandat_${order.order_number}.pdf`);
  }

  return (
    <Button variant="outline" size="sm" onClick={generateSepaMandat} className="gap-1.5">
      <FileText className="w-4 h-4" /> SEPA Mandat
    </Button>
  );
}
