import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import alixLogo from '@/assets/alix-lasers-logo.png';

interface Props {
  order: any;
}

const ALIX = {
  name: 'Alix Lasers GmbH',
  street: 'Musterstraße 1',
  city: '12345 Berlin',
  country: 'Deutschland',
  iban: 'DE89 3704 0044 0532 0130 00',
  bic: 'COBADEFFXXX',
  glaeubigerId: 'DE98ZZZ09999999999',
};

function formatAddr(a: any): string[] {
  if (!a) return [];
  if (typeof a === 'string') return [a];
  const lines: string[] = [];
  if (a.address || a.street) lines.push(a.address || a.street);
  const zipCity = [a.zip, a.city].filter(Boolean).join(' ');
  if (zipCity) lines.push(zipCity);
  if (a.country) lines.push(a.country);
  return lines;
}

async function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export default function SepaMandatButton({ order }: Props) {
  const customer = order.customers;

  async function generateSepaMandat() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Logo top-right
    try {
      const logoData = await loadImageAsBase64(alixLogo);
      doc.addImage(logoData, 'PNG', pw - 60, 8, 46, 20);
    } catch { /* skip logo */ }

    // Title
    doc.setFontSize(16);
    doc.setFont(undefined!, 'bold');
    doc.text('SEPA-Lastschriftmandat', 14, 22);

    doc.setFontSize(9);
    doc.setFont(undefined!, 'normal');
    doc.text(`Mandatsreferenz: ${order.order_number}`, 14, 30);
    doc.text(`Datum: ${today}`, 14, 35);

    // Gläubiger (Alix)
    let y = 46;
    doc.setFontSize(11);
    doc.setFont(undefined!, 'bold');
    doc.text('Zahlungsempfänger (Gläubiger)', 14, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont(undefined!, 'normal');
    const glaeubigerLines = [
      `Name: ${ALIX.name}`,
      `Anschrift: ${ALIX.street}, ${ALIX.city}`,
      `Gläubiger-ID: ${ALIX.glaeubigerId}`,
      `IBAN: ${ALIX.iban}`,
      `BIC: ${ALIX.bic}`,
    ];
    glaeubigerLines.forEach(l => { doc.text(l, 14, y); y += 5; });

    // Zahlungspflichtiger (Kunde)
    y += 5;
    doc.setFontSize(11);
    doc.setFont(undefined!, 'bold');
    doc.text('Zahlungspflichtiger (Kontoinhaber)', 14, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont(undefined!, 'normal');

    const customerName = customer?.company_name || customer?.contact_name || '___________________________';
    const addr = formatAddr(customer?.billing_address || customer?.shipping_address);
    const addrStr = addr.length > 0 ? addr.join(', ') : '___________________________';

    const kundeLines = [
      `Name / Firma: ${customerName}`,
      `Anschrift: ${addrStr}`,
      `E-Mail: ${customer?.email || '___________________________'}`,
      '',
      'IBAN: ___________________________________________',
      '',
      'BIC:  ___________________________________________',
    ];
    kundeLines.forEach(l => { doc.text(l, 14, y); y += 5; });

    // Mandatstext
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text('Ermächtigung', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined!, 'normal');

    const mandatText = [
      `Ich ermächtige / Wir ermächtigen ${ALIX.name}, Zahlungen von meinem / unserem Konto`,
      'mittels Lastschrift einzuziehen. Zugleich weise ich mein / weisen wir unser Kreditinstitut an,',
      `die von ${ALIX.name} auf mein / unser Konto gezogenen Lastschriften einzulösen.`,
      '',
      'Hinweis: Ich kann / Wir können innerhalb von acht Wochen, beginnend mit dem',
      'Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei',
      'die mit meinem / unserem Kreditinstitut vereinbarten Bedingungen.',
    ];
    mandatText.forEach(l => { doc.text(l, 14, y); y += 5; });

    // Zahlungsart
    y += 6;
    doc.setFont(undefined!, 'bold');
    doc.text('Art der Zahlung:', 14, y);
    doc.setFont(undefined!, 'normal');
    y += 6;
    doc.text('☐  Einmalige Zahlung', 20, y);
    y += 5;
    doc.text('☐  Wiederkehrende Zahlung', 20, y);

    // Betrag
    y += 10;
    const amount = order.total_amount != null
      ? Number(order.total_amount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' })
      : '_______________';
    doc.text(`Betrag: ${amount}`, 14, y);
    doc.text(`Auftragsnummer: ${order.order_number}`, 100, y);

    // Unterschrift
    y += 18;
    doc.setDrawColor(180);
    doc.line(14, y, 90, y);
    doc.line(105, y, pw - 14, y);
    y += 4;
    doc.setFontSize(8);
    doc.text('Ort, Datum', 14, y);
    doc.text('Unterschrift des Kontoinhabers', 105, y);

    // Footer
    const fh = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(
      `${ALIX.name} · ${ALIX.street} · ${ALIX.city} · Gläubiger-ID: ${ALIX.glaeubigerId}`,
      pw / 2, fh - 10,
      { align: 'center' }
    );

    doc.save(`SEPA-Mandat_${order.order_number}.pdf`);
  }

  return (
    <Button variant="outline" size="sm" onClick={generateSepaMandat} className="gap-1.5">
      <FileText className="w-4 h-4" /> SEPA Mandat
    </Button>
  );
}
