import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, FileDown, Loader2, Mail, CalendarIcon, Printer, Eye } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createPDF } from '@/lib/pdf-utils';
import { peekNumber, nextNumber } from '@/lib/number-ranges';
import autoTable from 'jspdf-autotable';
import templateAsset from '@/assets/angebot-template.jpg.asset.json';
import logoAsset from '@/assets/alix-logo-gold.png.asset.json';

interface Props {
  order: any;
  customer: any;
  items: any[];
}

const fmtMoney = (n: number, currency = 'EUR') =>
  (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('de-DE') : '—';

function addrLines(a: any): string[] {
  if (!a || typeof a !== 'object') return [];
  const out: string[] = [];
  const street = a.address || a.street;
  const street2 = a.street2 || a.address2;
  const zipCity = [a.zip || a.postal_code || '', a.city || ''].filter(Boolean).join(' ');
  const country = a.country;
  if (street) out.push(String(street));
  if (street2) out.push(String(street2));
  if (zipCity) out.push(zipCity);
  if (country) out.push(String(country));
  return out;
}

let _tplCache: string | null = null;
async function loadTemplate(): Promise<string> {
  if (_tplCache) return _tplCache;
  const res = await fetch(templateAsset.url);
  const blob = await res.blob();
  const data: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  _tplCache = data;
  return data;
}

let _logoCache: string | null = null;
async function loadLogo(): Promise<string> {
  if (_logoCache) return _logoCache;
  const res = await fetch(logoAsset.url);
  const blob = await res.blob();
  const data: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  _logoCache = data;
  return data;
}

type PayType = 'Direktkauf' | 'Ratenzahlung' | 'Leasing' | 'Mietkauf' | 'Alix Flex';

export default function OrderConfirmationTab({ order, customer, items }: Props) {
  const [confirmDate, setConfirmDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [deliveryWeek, setDeliveryWeek] = useState<string>(
    order?.expected_shipment_date
      ? new Date(order.expected_shipment_date).toLocaleDateString('de-DE')
      : ''
  );

  // Liefertermin automatisch an das voraussichtliche Versanddatum angleichen
  useEffect(() => {
    if (order?.expected_shipment_date) {
      setDeliveryWeek(new Date(order.expected_shipment_date).toLocaleDateString('de-DE'));
    }
  }, [order?.expected_shipment_date]);
  const [notes, setNotes] = useState<string>('Vielen Dank für Ihre Bestellung. Wir bestätigen Ihnen hiermit den Auftrag zu den nachfolgenden Konditionen.');
  const [paymentTerms, setPaymentTerms] = useState<string>('');
  const [confirmationNumber, setConfirmationNumber] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Zentralen Nummernkreis 'order' (Auftragsbestätigung) abfragen – Vorschau.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nr = await peekNumber('order');
        if (!cancelled && nr) setConfirmationNumber(nr);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Zahlungsberechnung (aus Angebot übernommen, manuell überschreibbar)
  const [payType, setPayType] = useState<PayType>('Direktkauf');
  const [payPrice, setPayPrice] = useState<string>('');
  const [payDown, setPayDown] = useState<string>('');
  const [payTerm, setPayTerm] = useState<number>(24);
  const [linkedOfferNr, setLinkedOfferNr] = useState<string>('');
  const [caseNumber, setCaseNumber] = useState<string | null>(order?.case_number || null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customer?.id) return;
      const { data } = await supabase
        .from('finance_accounts')
        .select('payment_terms')
        .eq('customer_id', customer.id)
        .maybeSingle();
      if (!cancelled && data?.payment_terms) setPaymentTerms(data.payment_terms);
    })();
    return () => { cancelled = true; };
  }, [customer?.id]);

  // Bestes Angebot zum Auftrag finden (gleicher Kunde, Status order/signed, Betragsabgleich bevorzugt)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customer?.id) return;
      const { data } = await supabase
        .from('offers')
        .select('offer_number, status, total_gross, payload, case_number, created_at')
        .eq('customer_id', customer.id)
        .in('status', ['order', 'signed', 'draft'])
        .order('created_at', { ascending: false })
        .limit(25);
      if (cancelled || !data?.length) return;
      const target = Number(order?.total_amount) || 0;
      const ranked = [...data].sort((a: any, b: any) => {
        const da = Math.abs((Number(a.total_gross) || 0) - target);
        const db = Math.abs((Number(b.total_gross) || 0) - target);
        return da - db;
      });
      const pick: any = ranked[0];
      setLinkedOfferNr(pick?.offer_number || '');
      // Stammnummer vom besten passenden Angebot übernehmen, falls Auftrag noch keine hat
      if (!caseNumber && pick?.case_number) setCaseNumber(pick.case_number);
      const p = (pick?.payload as any)?.payment;
      if (!p) return;
      if (p.type) setPayType(p.type as PayType);
      if (typeof p.price === 'number') setPayPrice(String(p.price));
      else if (target) setPayPrice(String(target));
      if (typeof p.down === 'number') setPayDown(String(p.down));
      if (typeof p.term === 'number') setPayTerm(p.term);
    })();
    return () => { cancelled = true; };
  }, [customer?.id, order?.total_amount]);

  const currency = order?.currency || 'EUR';

  const totals = useMemo(() => {
    let net = 0, tax = 0;
    for (const i of items) {
      const qty = Number(i.quantity) || 0;
      const rate = Number(i.rate) || 0;
      const lineNet = qty * rate;
      const taxAmount = Number((i as any).tax_amount);
      const taxPct = Number((i as any).tax_percentage);
      net += lineNet;
      if (Number.isFinite(taxAmount) && taxAmount > 0) {
        tax += taxAmount;
      } else if (Number.isFinite(taxPct) && taxPct > 0) {
        tax += lineNet * (taxPct / 100);
      }
    }
    const computedGross = net + tax;
    const orderGross = Number(order?.total_amount);
    const finalGross = Number.isFinite(orderGross) && orderGross > 0 ? orderGross : computedGross;
    // Wenn Items keine MwSt-Info haben, aus Brutto rückrechnen (Standard 19%)
    let finalNet = net;
    let finalTax = tax;
    if (tax <= 0 && finalGross > 0) {
      finalNet = finalGross / 1.19;
      finalTax = finalGross - finalNet;
    } else if (finalGross !== computedGross) {
      // Auftrags-Brutto hat Vorrang (Rabatte/Rundung) – Netto entsprechend anpassen
      finalNet = finalGross - finalTax;
    }
    return { net: finalNet, tax: finalTax, gross: finalGross };
  }, [items, order]);

  async function generate(mode: 'download' | 'print' | 'view' = 'download') {
    if (!items || items.length === 0) {
      toast.error('Keine Artikel im Auftrag vorhanden.');
      return;
    }
    setGenerating(true);
    try {
      // Zentrale Nummer ziehen (atomar). Wenn der Kreis 'order' an die
      // Vorgangs-Stammnummer gekoppelt ist, wird die Stammnummer als Suffix
      // verwendet. Bei inaktivem Kreis fällt der Helper auf die ursprüngliche
      // Auftragsnummer zurück.
      const abNr = await nextNumber(
        'order',
        () => confirmationNumber || String(order?.order_number || ''),
        { caseNumber },
      );
      if (abNr && abNr !== confirmationNumber) setConfirmationNumber(abNr);

      // Stammnummer auf dem Auftrag persistieren, damit Lieferschein, Rechnung
      // usw. dieselbe Vorgangsnummer erben.
      if (caseNumber && order?.id && !order?.case_number) {
        try {
          await supabase.from('orders').update({ case_number: caseNumber } as any).eq('id', order.id);
        } catch { /* nicht kritisch */ }
      }

      const doc = createPDF({ unit: 'mm', format: 'a4' });
      const PAGE_W = 210;
      const PAGE_H = 297;
      const LEFT = 30;
      const RIGHT = 195;
      const CONTENT_W = RIGHT - LEFT;
      const TOP_CONTENT = 55;
      const BOTTOM_LIMIT = 265;

      const templateUrl = await loadTemplate();
      const logoUrl = await loadLogo();
      // 300px @ 72dpi ≈ 105.83mm, proportional Höhe via Bild-Seitenverhältnis (1899x408)
      const LOGO_W = 105.83 * 0.75 * 0.9;
      const LOGO_H = LOGO_W * (408 / 1899);
      const LOGO_X = PAGE_W - 10 - LOGO_W; // 10mm Rand rechts
      const LOGO_Y = 10;
      const drawTemplate = () => {
        doc.addImage(templateUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
        doc.addImage(logoUrl, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H, undefined, 'FAST');
      };
      drawTemplate();

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(20, 60, 110);
      doc.text('Auftragsbestätigung', LEFT, TOP_CONTENT);

      // Meta (right side)
      const metaX = 130;
      let metaY = TOP_CONTENT;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const meta: Array<[string, string]> = [];
      if (abNr) meta.push(['AB-Nr.', abNr]);
      meta.push(['Auftragsnr.', String(order?.order_number || '—')]);
      meta.push(['Bestelldatum', fmtDate(order?.order_date)]);
      
      meta.push(['Kundennr.', String(customer?.external_customer_id || customer?.id?.slice(0, 8) || '—')]);
      if (deliveryWeek) meta.push(['Liefertermin', deliveryWeek]);
      for (const [k, v] of meta) {
        doc.setFont('helvetica', 'bold');
        doc.text(k, metaX, metaY);
        doc.setFont('helvetica', 'normal');
        doc.text(v, metaX + 32, metaY);
        metaY += 5;
      }

      // Addresses
      let ay = TOP_CONTENT + 12;
      const billing = customer?.billing_address || customer?.shipping_address || {};
      const shipping = customer?.shipping_address || customer?.billing_address || {};

      const drawAddress = (title: string, x: number, addr: any, yStart: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(20, 60, 110);
        doc.text(title, x, yStart);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        let y = yStart + 5;
        if (customer?.company_name) { doc.text(String(customer.company_name), x, y); y += 4.4; }
        if (customer?.contact_name) { doc.text(String(customer.contact_name), x, y); y += 4.4; }
        for (const ln of addrLines(addr)) { doc.text(ln, x, y); y += 4.4; }
        if (title.toLowerCase().includes('rechnung')) {
          if (customer?.email) { doc.text(String(customer.email), x, y); y += 4.4; }
          if (customer?.phone) { doc.text(String(customer.phone), x, y); y += 4.4; }
        }
        return y;
      };

      // Rechnungsadresse links; Lieferadresse rechts unter dem Meta-Block (unter "Kundennr.")
      const yBilling = drawAddress('Rechnungsadresse', LEFT, billing, ay);
      const yShipping = drawAddress('Lieferadresse', metaX, shipping, metaY + 4);
      let cy = Math.max(yBilling, yShipping) + 8;


      // Auftragsbestätigung intro (über den Artikeln, unter der Adresse)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 60, 110);
      doc.text('Auftragsbestätigung', LEFT, cy);
      cy += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      const introText =
        'Wir bestätigen den vorstehend aufgeführten Auftrag verbindlich. Sollten Abweichungen zu Ihrer Bestellung ' +
        'bestehen, teilen Sie uns dies bitte umgehend schriftlich mit. Es gelten unsere Allgemeinen ' +
        'Geschäftsbedingungen sowie die getroffenen individuellen Vereinbarungen.';
      const introWrapped = doc.splitTextToSize(introText, CONTENT_W);
      doc.text(introWrapped, LEFT, cy);
      cy += introWrapped.length * 4.4 + 4;

      // Optionale freie Notizen
      if (notes.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(60, 60, 60);
        const wrapped = doc.splitTextToSize(notes.trim(), CONTENT_W);
        doc.text(wrapped, LEFT, cy);
        cy += wrapped.length * 4.4 + 4;
      }

      // Items table
      autoTable(doc, {
        startY: cy,
        margin: { left: LEFT, right: PAGE_W - RIGHT, top: TOP_CONTENT, bottom: PAGE_H - BOTTOM_LIMIT },
        head: [['Pos', 'Artikel', 'Menge', 'Einzelpreis', 'MwSt', 'Summe']],
        body: items.map((i, idx) => {
          const name = String(i.item_name || '—');
          const sku = i.sku ? ` (${i.sku})` : '';
          const desc = i.description ? `\n${i.description}` : '';
          const qty = Number(i.quantity) || 0;
          const rate = Number(i.rate) || 0;
          const lineNet = qty * rate;
          const taxAmount = Number((i as any).tax_amount);
          let taxPct = Number((i as any).tax_percentage);
          if (!Number.isFinite(taxPct) || taxPct <= 0) {
            if (Number.isFinite(taxAmount) && taxAmount > 0 && lineNet > 0) {
              taxPct = Math.round((taxAmount / lineNet) * 100);
            } else {
              taxPct = 19;
            }
          }
          return [
            idx + 1,
            `${name}${sku}${desc}`,
            qty,
            fmtMoney(rate, currency),
            `${taxPct}%`,
            fmtMoney(lineNet, currency),
          ];
        }),
        styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
        headStyles: { fillColor: [183, 217, 255], textColor: [20, 60, 110] },
        alternateRowStyles: { fillColor: [245, 249, 255] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { halign: 'right', cellWidth: 16 },
          3: { halign: 'right', cellWidth: 25 },
          4: { halign: 'right', cellWidth: 16 },
          5: { halign: 'right', cellWidth: 25 },
        },
        rowPageBreak: 'auto',
        willDrawPage: () => {
          const pageNo = (doc as any).internal.getCurrentPageInfo().pageNumber;
          if (pageNo > 1) drawTemplate();
        },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 8;
      if (finalY > BOTTOM_LIMIT - 50) {
        doc.addPage();
        drawTemplate();
        finalY = TOP_CONTENT;
      }

      // Totals box
      const totalsX = 130;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text('Netto:', totalsX, finalY);
      doc.text(fmtMoney(totals.net, currency), RIGHT, finalY, { align: 'right' });
      doc.text('MwSt:', totalsX, finalY + 5);
      doc.text(fmtMoney(totals.tax, currency), RIGHT, finalY + 5, { align: 'right' });
      doc.setDrawColor(20, 60, 110);
      doc.line(totalsX, finalY + 8, RIGHT, finalY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 60, 110);
      doc.text('Gesamt:', totalsX, finalY + 14);
      doc.text(fmtMoney(totals.gross, currency), RIGHT, finalY + 14, { align: 'right' });

      // Confirmation block (oben über den Artikeln bereits gesetzt)
      let py = finalY + 20;

      // Zahlungsweise / Zahlungsbedingungen
      if (paymentTerms && paymentTerms.trim()) {
        if (py > BOTTOM_LIMIT - 25) {
          doc.addPage();
          drawTemplate();
          py = TOP_CONTENT;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(20, 60, 110);
        doc.text('Zahlungsweise', LEFT, py);
        py += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(60, 60, 60);
        const ptWrapped = doc.splitTextToSize(paymentTerms.trim(), CONTENT_W);
        doc.text(ptWrapped, LEFT, py);
        py += ptWrapped.length * 4.6 + 6;
      }

      // Zahlungsberechnung (aus Angebot)
      {
        const price = parseFloat(payPrice) || 0;
        const down = parseFloat(payDown) || 0;
        const base = Math.max(0, price - down);
        const isFinanced = payType !== 'Direktkauf';
        const rate = isFinanced && payTerm > 0 ? base / payTerm : 0;

        if (price > 0 || isFinanced) {
          if (py > BOTTOM_LIMIT - 45) {
            doc.addPage();
            drawTemplate();
            py = TOP_CONTENT;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(20, 60, 110);
          doc.text(`Zahlungsberechnung — ${payType}${linkedOfferNr ? `  (Angebot ${linkedOfferNr})` : ''}`, LEFT, py);
          py += 6;

          const rows: Array<[string, string]> = [
            ['Kaufpreis', fmtMoney(price, currency)],
          ];
          if (down > 0 || isFinanced) rows.push(['Anzahlung', fmtMoney(down, currency)]);
          if (isFinanced) {
            rows.push(['Laufzeit', `${payTerm} Monate`]);
            rows.push(['Basis (Finanzierungsbetrag)', fmtMoney(base, currency)]);
            rows.push(['Monatliche Rate', fmtMoney(rate, currency)]);
          } else {
            rows.push(['Zu zahlen', fmtMoney(base, currency)]);
          }

          autoTable(doc, {
            startY: py,
            margin: { left: LEFT, right: PAGE_W - RIGHT },
            body: rows,
            theme: 'grid',
            styles: { fontSize: 9.5, cellPadding: 2, textColor: [40, 40, 40] },
            columnStyles: {
              0: { cellWidth: 70, fontStyle: 'bold', textColor: [20, 60, 110] },
              1: { halign: 'right' },
            },
            tableWidth: CONTENT_W,
          });
          py = (doc as any).lastAutoTable.finalY + 8;
        }
      }




      // Sign-off
      if (py > BOTTOM_LIMIT - 18) {
        doc.addPage();
        drawTemplate();
        py = TOP_CONTENT;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 60, 110);
      doc.text('Mit freundlichen Grüßen', LEFT, py);
      py += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Alix Lasers Deutschland', LEFT, py);

      // Page numbers + header on page 2+
      const orderNo = String(order?.order_number || '');
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text(`Auftragsbestätigung ${orderNo}`, LEFT, TOP_CONTENT - 8);
          doc.setDrawColor(200, 200, 200);
          doc.line(LEFT, TOP_CONTENT - 5, RIGHT, TOP_CONTENT - 5);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Auftragsbestätigung ${orderNo}  ·  Seite ${i} von ${totalPages}`,
          RIGHT, PAGE_H - 4, { align: 'right' },
        );
      }

      const fileName = `Auftragsbestaetigung_${orderNo || order?.id}.pdf`;
      if (mode === 'print') {
        const blobUrl = doc.output('bloburl') as unknown as string;
        const win = window.open(blobUrl, '_blank');
        if (win) {
          win.addEventListener('load', () => { try { win.focus(); win.print(); } catch {} });
        } else {
          toast.error('Popup wurde blockiert. Bitte Popups erlauben.');
        }
        toast.success('Druckvorschau geöffnet.');
      } else {
        doc.save(fileName);
        toast.success('Auftragsbestätigung erstellt.');
      }
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-primary" /> Auftragsbestätigung
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => generate('print')}
            disabled={generating || !items?.length}
            variant="outline"
          >
            <Printer className="w-4 h-4 mr-2" />
            Drucken
          </Button>
          <Button
            onClick={() => generate('download')}
            disabled={generating || !items?.length}
            className="gold-gradient text-primary-foreground"
          >
            {generating
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <FileDown className="w-4 h-4 mr-2" />}
            PDF herunterladen
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Bestätigungsdatum</Label>
          <Input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} className="bg-secondary border-border mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Liefertermin / KW (optional)</Label>
          <div className="flex gap-2 mt-1">
            <Input value={deliveryWeek} onChange={e => setDeliveryWeek(e.target.value)} placeholder="z. B. KW 32 / 2026" className="bg-secondary border-border" />
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="shrink-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
                <Calendar
                  mode="single"
                  initialFocus
                  onSelect={(d) => {
                    if (!d) return;
                    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                    const dayNum = date.getUTCDay() || 7;
                    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
                    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
                    const weekNr = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
                    setDeliveryWeek(`KW ${String(weekNr).padStart(2, '0')} / ${date.getUTCFullYear()}`);
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex items-end text-xs text-muted-foreground">
          <div className="rounded-md bg-secondary/60 border border-border px-3 py-2 w-full">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-3 h-3" /> Empfänger
            </div>
            <div className="truncate">{customer?.email || '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Einleitungstext</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="bg-secondary border-border mt-1" />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Zahlungsweise (aus Kundenkonto)</Label>
        <Textarea
          value={paymentTerms}
          onChange={e => setPaymentTerms(e.target.value)}
          rows={2}
          placeholder="z. B. 14 Tage netto"
          className="bg-secondary border-border mt-1"
        />
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-wide text-primary">ZAHLUNGSBERECHNUNG</div>
          {linkedOfferNr && (
            <div className="text-xs text-muted-foreground">aus Angebot <span className="font-mono">{linkedOfferNr}</span></div>
          )}
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
            <Select value={payType} onValueChange={(v: any) => setPayType(v)}>
              <SelectTrigger className="bg-secondary border-border mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Direktkauf">Direktkauf</SelectItem>
                <SelectItem value="Ratenzahlung">Ratenzahlung</SelectItem>
                <SelectItem value="Leasing">Leasing</SelectItem>
                <SelectItem value="Mietkauf">Mietkauf</SelectItem>
                <SelectItem value="Alix Flex">Alix Flex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Gesamtbetrag (€)</Label>
            <Input type="number" inputMode="decimal" value={payPrice} onChange={e => setPayPrice(e.target.value)} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Anzahlung (€)</Label>
            <Input type="number" inputMode="decimal" value={payDown} onChange={e => setPayDown(e.target.value)} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Laufzeit (Monate)</Label>
            <Input type="number" min={1} value={payTerm} onChange={e => setPayTerm(Number(e.target.value) || 0)} disabled={payType === 'Direktkauf'} className="bg-secondary border-border mt-1" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm pt-1">
          <div className="rounded-md bg-background/60 border border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">Basis (Finanzierungsbetrag)</div>
            <div className="font-semibold text-foreground">{fmtMoney(Math.max(0, (parseFloat(payPrice) || 0) - (parseFloat(payDown) || 0)), currency)}</div>
          </div>
          <div className="rounded-md bg-background/60 border border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">{payType === 'Direktkauf' ? 'Zu zahlen' : 'Monatliche Rate'}</div>
            <div className="font-semibold text-foreground">
              {(() => {
                const base = Math.max(0, (parseFloat(payPrice) || 0) - (parseFloat(payDown) || 0));
                if (payType === 'Direktkauf') return fmtMoney(base, currency);
                const r = payTerm > 0 ? base / payTerm : 0;
                return `${fmtMoney(r, currency)} × ${payTerm} Mt.`;
              })()}
            </div>
          </div>
        </div>
      </div>




      <div className="rounded-lg border border-border bg-secondary/40 p-4">
        <div className="text-xs text-muted-foreground mb-2">Vorschau der Eckdaten</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {confirmationNumber && (
            <div><span className="text-muted-foreground">AB-Nr. (nächste):</span> <span className="font-medium font-mono text-primary">{confirmationNumber}</span></div>
          )}
          <div><span className="text-muted-foreground">Auftragsnr.:</span> <span className="font-medium">{order?.order_number || '—'}</span></div>
          <div><span className="text-muted-foreground">Kunde:</span> <span className="font-medium">{customer?.company_name || customer?.contact_name || '—'}</span></div>
          <div><span className="text-muted-foreground">Positionen:</span> <span className="font-medium">{items?.length || 0}</span></div>
          <div><span className="text-muted-foreground">Gesamt:</span> <span className="font-medium">{fmtMoney(totals.gross, currency)}</span></div>
        </div>
      </div>
    </div>
  );
}
