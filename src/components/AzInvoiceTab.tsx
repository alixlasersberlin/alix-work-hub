import { useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2, Receipt, AlertCircle, Mail, BookmarkCheck, BookOpen, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import templateAsset from '@/assets/az-rechnung-template.jpg.asset.json';
import logoAsset from '@/assets/alix-logo-gold-pdf.png.asset.json';
import { postPaymentToJournal } from '@/lib/finance/journal';

type BuildMode = 'download' | 'blob';

interface Props {
  order: any;
  customer: any;
  items: any[];
  onReload?: () => void;
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
let _logoCache: string | null = null;
async function loadDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function loadTemplate(): Promise<string> {
  if (_tplCache) return _tplCache;
  _tplCache = await loadDataUrl(templateAsset.url);
  return _tplCache;
}
async function loadLogo(): Promise<string> {
  if (_logoCache) return _logoCache;
  _logoCache = await loadDataUrl(logoAsset.url);
  return _logoCache;
}

export default function AzInvoiceTab({ order, customer, items, onReload }: Props) {
  const currency = order?.currency || 'EUR';
  const orderNo = String(order?.order_number || '');

  // Anzahlung aus Auftrag übernehmen
  const orderDeposit = Number(order?.deposit_amount) || 0;
  const orderTotal = useMemo(() => {
    const t = Number(order?.total_amount);
    if (Number.isFinite(t) && t > 0) return t;
    let sum = 0;
    for (const i of items || []) sum += (Number(i.quantity) || 0) * (Number(i.rate) || 0) * (1 + (Number(i.tax_percentage) || 0) / 100);
    return sum;
  }, [order, items]);

  const [invoiceNumber, setInvoiceNumber] = useState<string>(`AZ-${orderNo || 'NEU'}`);
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [depositAmount, setDepositAmount] = useState<string>(orderDeposit > 0 ? String(orderDeposit) : '');
  const [taxPercentage, setTaxPercentage] = useState<number>(() => {
    const saved = order?.az_tax_percentage;
    return saved === null || saved === undefined ? 19 : Number(saved);
  });
  const [savingTax, setSavingTax] = useState(false);
  const [positionLabel, setPositionLabel] = useState<string>(
    `Anzahlung gemäß Auftrag ${orderNo}`.trim()
  );
  const [intro, setIntro] = useState<string>(
    'Vielen Dank für Ihre Bestellung. Vereinbarungsgemäß stellen wir Ihnen hiermit die Anzahlung in Rechnung.'
  );
  const [generating, setGenerating] = useState(false);
  const [booking, setBooking] = useState(false);
  const [postingToBuchhaltung, setPostingToBuchhaltung] = useState(false);
  const [sending, setSending] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState<{ invoice_number: string; issue_date?: string | null } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (orderDeposit > 0) setDepositAmount(String(orderDeposit));
  }, [orderDeposit]);

  // Fallback: Wenn im Auftrag kein deposit_amount hinterlegt ist, aus finance_deposits ziehen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (orderDeposit > 0) return;
      if (!order?.id && !orderNo) return;
      try {
        let query = supabase
          .from('finance_deposits' as any)
          .select('gross_amount, order_id, order_number')
          .limit(1);
        const orFilters: string[] = [];
        if (order?.id) orFilters.push(`order_id.eq.${order.id}`);
        if (orderNo) orFilters.push(`order_number.eq.${orderNo}`);
        if (orFilters.length) query = query.or(orFilters.join(','));
        const { data } = await query;
        const gross = Number((data?.[0] as any)?.gross_amount) || 0;
        if (!cancelled && gross > 0) {
          setDepositAmount(prev => (Number(prev) > 0 ? prev : String(gross)));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [order?.id, orderNo, orderDeposit]);

  // Duplikatscheck: existiert bereits eine AZ-Rechnung für diesen Auftrag?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!order?.id && !orderNo) { setCheckingExisting(false); return; }
      setCheckingExisting(true);
      try {
        let query = supabase
          .from('finance_deposits' as any)
          .select('invoice_number, deposit_number, issue_date, order_id, order_number')
          .limit(1);
        const orFilters: string[] = [];
        if (order?.id) orFilters.push(`order_id.eq.${order.id}`);
        if (orderNo) {
          orFilters.push(`order_number.eq.${orderNo}`);
          orFilters.push(`invoice_number.eq.AZ-${orderNo}`);
          orFilters.push(`deposit_number.eq.AZ-${orderNo}`);
        }
        if (orFilters.length) query = query.or(orFilters.join(','));
        const { data } = await query;
        if (!cancelled && data && data.length > 0) {
          const row: any = data[0];
          setExistingInvoice({
            invoice_number: row.invoice_number || row.deposit_number || `AZ-${orderNo}`,
            issue_date: row.issue_date ?? null,
          });
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setCheckingExisting(false); }
    })();
    return () => { cancelled = true; };
  }, [order?.id, orderNo]);


  const grossDeposit = Number(depositAmount) || 0;
  const netDeposit = grossDeposit / (1 + (taxPercentage || 0) / 100);
  const taxAmount = grossDeposit - netDeposit;
  const hasDeposit = grossDeposit > 0.0001;

  async function buildPdf(mode: BuildMode): Promise<{ doc: any; fileName: string; blob?: Blob }> {
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
      // Logo: Originalseitenverhältnis ~1920x360 → 5.33:1
      const LOGO_W = 45 * 1.2;
      const LOGO_H = LOGO_W / (1920 / 360);
      const LOGO_X = RIGHT - LOGO_W;
      const LOGO_Y = 12;
      const drawTemplate = () => {
        doc.addImage(templateUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
        doc.addImage(logoUrl, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H, undefined, 'FAST');
      };
      drawTemplate();

      // Titel
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(20, 60, 110);
      doc.text('Anzahlungsrechnung', LEFT, TOP_CONTENT);

      // Meta rechts
      const metaX = 130;
      let metaY = TOP_CONTENT;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const meta: Array<[string, string]> = [
        ['Rechnungsnr.', invoiceNumber || '—'],
        ['Rechnungsdatum', fmtDate(invoiceDate)],
        ['Fällig am', fmtDate(dueDate)],
        ['Auftragsnr.', orderNo || '—'],
        ['Kundennr.', (() => {
          const ext = customer?.external_customer_id;
          const cleanExt = ext && !String(ext).startsWith('manual-') ? String(ext) : '';
          return String((customer as any)?.raw_data?.contact_number || (customer as any)?.raw_data?.customer_number || cleanExt || orderNo || customer?.id?.slice(0, 8) || '—');
        })()],
      ];
      for (const [k, v] of meta) {
        doc.setFont('helvetica', 'bold');
        doc.text(k, metaX, metaY);
        doc.setFont('helvetica', 'normal');
        doc.text(v, metaX + 32, metaY);
        metaY += 5;
      }

      // Rechnungsadresse
      let ay = TOP_CONTENT + 12;
      const billing = customer?.billing_address || customer?.shipping_address || {};
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 60, 110);
      doc.text('Rechnungsadresse', LEFT, ay);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(40, 40, 40);
      let y = ay + 5;
      if (customer?.company_name) { doc.text(String(customer.company_name), LEFT, y); y += 4.4; }
      if (customer?.contact_name) { doc.text(String(customer.contact_name), LEFT, y); y += 4.4; }
      for (const ln of addrLines(billing)) { doc.text(ln, LEFT, y); y += 4.4; }
      if (customer?.email) { doc.text(String(customer.email), LEFT, y); y += 4.4; }
      let cy = y + 6;

      // Einleitung
      if (intro.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(60, 60, 60);
        const wrapped = doc.splitTextToSize(intro.trim(), CONTENT_W);
        doc.text(wrapped, LEFT, cy);
        cy += wrapped.length * 4.4 + 4;
      }

      // Eine einzige Position: die Anzahlung
      autoTable(doc, {
        startY: cy,
        margin: { left: LEFT, right: PAGE_W - RIGHT, top: TOP_CONTENT, bottom: PAGE_H - BOTTOM_LIMIT },
        head: [['Pos', 'Beschreibung', 'Menge', 'Einzelpreis netto', 'MwSt', 'Summe netto']],
        body: [[
          1,
          positionLabel || `Anzahlung Auftrag ${orderNo}`,
          1,
          fmtMoney(netDeposit, currency),
          `${taxPercentage}%`,
          fmtMoney(netDeposit, currency),
        ]],
        styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
        headStyles: { fillColor: [183, 217, 255], textColor: [20, 60, 110] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { halign: 'right', cellWidth: 16 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 16 },
          5: { halign: 'right', cellWidth: 30 },
        },
        willDrawPage: () => {
          const pageNo = (doc as any).internal.getCurrentPageInfo().pageNumber;
          if (pageNo > 1) drawTemplate();
        },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 8;

      // Totals – Label weiter links, damit Betrag rechts nicht überlappt
      const totalsLabelX = 110;
      const totalsValueX = RIGHT;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text('Netto:', totalsLabelX, finalY);
      doc.text(fmtMoney(netDeposit, currency), totalsValueX, finalY, { align: 'right' });
      doc.text(`MwSt (${taxPercentage}%):`, totalsLabelX, finalY + 5);
      doc.text(fmtMoney(taxAmount, currency), totalsValueX, finalY + 5, { align: 'right' });
      doc.setDrawColor(20, 60, 110);
      doc.line(totalsLabelX, finalY + 8, totalsValueX, finalY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 60, 110);
      doc.text('Rechnungsbetrag (brutto):', totalsLabelX, finalY + 14);
      doc.text(fmtMoney(grossDeposit, currency), totalsValueX, finalY + 14, { align: 'right' });

      // Hinweisblock
      let py = finalY + 26;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 60, 110);
      doc.text('Hinweis', LEFT, py);
      py += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      const hint =
        `Dies ist eine Anzahlungsrechnung zum Auftrag ${orderNo}. Der Betrag von ` +
        `${fmtMoney(grossDeposit, currency)} (brutto) wird mit der Schlussrechnung verrechnet. ` +
        `Bitte überweisen Sie den Rechnungsbetrag bis zum ${fmtDate(dueDate)} unter Angabe der ` +
        `Rechnungsnummer ${invoiceNumber}.`;
      const wrapped = doc.splitTextToSize(hint, CONTENT_W);
      doc.text(wrapped, LEFT, py);
      py += wrapped.length * 4.6 + 6;

      // Sign-off
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 60, 110);
      doc.text('Mit freundlichen Grüßen', LEFT, py);
      py += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('Alix Lasers Deutschland', LEFT, py);
      py += 10;

      // Bankdaten
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 60, 110);
      doc.text('Bankverbindung', LEFT, py);
      py += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 60, 60);
      const bank: Array<[string, string]> = [
        ['Kontoinhaber', 'Alix Lasers GmbH'],
        ['Bank', 'Deutsche Bank'],
        ['IBAN', 'DE07 1007 0100 0142 6600 00'],
        ['SWIFT/BIC', 'DEUTDEBB101'],
      ];
      for (const [k, v] of bank) {
        doc.setFont('helvetica', 'bold');
        doc.text(k + ':', LEFT, py);
        doc.setFont('helvetica', 'normal');
        doc.text(v, LEFT + 28, py);
        py += 4.6;
      }

      // Seitenzahlen
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text(`Anzahlungsrechnung ${invoiceNumber}`, LEFT, TOP_CONTENT - 8);
          doc.setDrawColor(200, 200, 200);
          doc.line(LEFT, TOP_CONTENT - 5, RIGHT, TOP_CONTENT - 5);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Anzahlungsrechnung ${invoiceNumber}  ·  Seite ${i} von ${totalPages}`,
          RIGHT, PAGE_H - 4, { align: 'right' },
        );
      }

    const fileName = `Anzahlungsrechnung_${invoiceNumber || orderNo}.pdf`;
    if (mode === 'download') {
      doc.save(fileName);
      return { doc, fileName };
    }
    const blob: Blob = doc.output('blob');
    return { doc, fileName, blob };
  }

  async function saveTaxPercentage(silent = false) {
    if (!order?.id) return false;
    setSavingTax(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ az_tax_percentage: taxPercentage } as any)
        .eq('id', order.id);
      if (error) throw error;
      if (!silent) toast.success(`MwSt-Einstellung gespeichert: ${taxPercentage}%`);
      return true;
    } catch (e: any) {
      toast.error('MwSt konnte nicht gespeichert werden: ' + (e?.message || 'Unbekannter Fehler'));
      return false;
    } finally {
      setSavingTax(false);
    }
  }

  async function recordNoteAndOrderDeposit() {
    if (!order?.id) return;
    try {
      await supabase.from('order_notes').insert({
        order_id: order.id,
        note_type: 'internal',
        note_text:
          `Anzahlungsrechnung ${invoiceNumber} über ${fmtMoney(grossDeposit, currency)} ` +
          `(brutto, ${taxPercentage}% MwSt) erstellt. Rechnungsdatum ${fmtDate(invoiceDate)}, ` +
          `fällig am ${fmtDate(dueDate)}.`,
      } as any);
    } catch (e) {
      console.error('order_notes insert failed', e);
    }
    try {
      if (!Number.isFinite(orderDeposit) || orderDeposit <= 0) {
        await supabase.from('orders').update({ deposit_amount: grossDeposit } as any).eq('id', order.id);
      }
    } catch { /* nicht kritisch */ }
    // MwSt-Einstellung mitspeichern
    await saveTaxPercentage(true);
  }

  async function bookToFinance(): Promise<boolean> {
    // Duplikate vermeiden: gleiche Referenz/Order/Typ schon vorhanden?
    try {
      const { data: existing } = await supabase
        .from('finance_transactions' as any)
        .select('id')
        .eq('transaction_type', 'Anzahlung')
        .eq('reference', invoiceNumber)
        .limit(1);
      if (existing && existing.length > 0) {
        toast.info(`Anzahlung ${invoiceNumber} ist bereits in Finance & Controlling gebucht.`);
        return true;
      }
    } catch { /* weiter */ }
    const payload: any = {
      customer_id: customer?.id ?? null,
      order_id: order?.id ?? null,
      amount: grossDeposit,
      currency,
      booking_date: invoiceDate,
      reference: invoiceNumber,
      transaction_type: 'Anzahlung',
      notes:
        `Anzahlungsrechnung ${invoiceNumber} – ${positionLabel || `Anzahlung Auftrag ${orderNo}`}. ` +
        `Brutto ${fmtMoney(grossDeposit, currency)} (MwSt ${taxPercentage}%). Fällig ${fmtDate(dueDate)}.`,
    };
    const { error } = await supabase.from('finance_transactions' as any).insert(payload);
    if (error) {
      toast.error('Konnte Finance-Buchung nicht anlegen: ' + error.message);
      return false;
    }
    return true;
  }

  async function postToBuchhaltung(): Promise<boolean> {
    if (blockIfDuplicate()) return false;
    if (!hasDeposit) {
      toast.error('Keine Anzahlung vereinbart.');
      return false;
    }
    setPostingToBuchhaltung(true);
    try {
      // Duplikate vermeiden
      const { data: existing } = await supabase
        .from('finance_deposits' as any)
        .select('id')
        .eq('source', 'alixwork')
        .eq('invoice_number', invoiceNumber)
        .limit(1);
      if (existing && existing.length > 0) {
        toast.info(`Anzahlung ${invoiceNumber} ist bereits in der Buchhaltung erfasst.`);
        return true;
      }

      const netAmt = Number(netDeposit.toFixed(2));
      const vatAmt = Number(taxAmount.toFixed(2));
      const grossAmt = Number(grossDeposit.toFixed(2));

      const payload: any = {
        source: 'alixwork',
        source_ref: order?.id ?? null,
        deposit_number: invoiceNumber,
        invoice_number: invoiceNumber,
        customer_id: customer?.id ?? null,
        customer_name: customer?.company_name || customer?.contact_name || null,
        company_name: customer?.company_name ?? null,
        contact_name: customer?.contact_name ?? null,
        order_id: order?.id ?? null,
        order_number: orderNo || null,
        currency,
        net_amount: netAmt,
        vat_amount: vatAmt,
        gross_amount: grossAmt,
        paid_amount: 0,
        issue_date: invoiceDate,
        due_date: dueDate,
        status: 'offen',
        release_status: 'nicht_freigegeben',
        note: `Anzahlungsrechnung ${invoiceNumber} – ${positionLabel || `Anzahlung Auftrag ${orderNo}`} (MwSt ${taxPercentage}%).`,
      };
      const { data: inserted, error } = await supabase.from('finance_deposits' as any).insert(payload).select('id').maybeSingle();
      if (error) throw error;
      await postPaymentToJournal({
        order_id: order?.id ?? null,
        order_number: orderNo || null,
        customer_id: customer?.id ?? null,
        invoice_number: invoiceNumber,
        reference: invoiceNumber,
        amount_gross: grossAmt,
        amount_net: netAmt,
        amount_vat: vatAmt,
        booking_date: invoiceDate,
        description: `Anzahlungsrechnung ${invoiceNumber} · Auftrag ${orderNo || '—'} (MwSt ${taxPercentage}%)`,
        source_table: 'finance_deposits',
        source_id: (inserted as any)?.id ?? null,
        vorgang: 'Anzahlungsrechnung',
      });
      toast.success(`In Buchhaltung übernommen: ${invoiceNumber} wurde unter Offene Anzahlungen erfasst.`);
      onReload?.();
      return true;

    } catch (e: any) {
      console.error('[AzInvoice] postToBuchhaltung failed:', e);
      toast.error('Konnte nicht in Buchhaltung schreiben: ' + (e?.message || 'Unbekannter Fehler'));
      return false;
    } finally {
      setPostingToBuchhaltung(false);
    }
  }

  function blockIfDuplicate(): boolean {
    if (existingInvoice) {
      toast.error(`Für diesen Auftrag wurde bereits die Anzahlungsrechnung ${existingInvoice.invoice_number} gestellt. Ein erneutes Ausstellen ist nicht möglich.`);
      return true;
    }
    return false;
  }

  async function generate() {
    // Hinweis: PDF-Erstellung ist idempotent und darf auch nach bereits gestellter Rechnung erfolgen (Reprint).
    if (!hasDeposit) {
      toast.error('Keine Anzahlung vereinbart – es wird keine Anzahlungsrechnung erstellt.');
      return;
    }
    setGenerating(true);
    try {
      await buildPdf('download');
      await recordNoteAndOrderDeposit();
      toast.success(existingInvoice
        ? `PDF neu erzeugt (${invoiceNumber}). Es wurde keine zweite Rechnung angelegt.`
        : 'Anzahlungsrechnung erstellt und im Auftrag vermerkt.');
      onReload?.();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setGenerating(false);
    }
  }

  async function generateAndBook() {
    if (blockIfDuplicate()) return;
    if (!hasDeposit) {
      toast.error('Keine Anzahlung vereinbart.');
      return;
    }
    setBooking(true);
    try {
      await buildPdf('download');
      await recordNoteAndOrderDeposit();
      const ok = await bookToFinance();
      if (ok) toast.success('Anzahlung gestellt, gespeichert und in Finance & Controlling übernommen.');
      onReload?.();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setBooking(false);
    }
  }

  async function sendByEmail(): Promise<boolean> {
    if (!hasDeposit && !existingInvoice) {
      toast.error('Keine Anzahlung vereinbart.');
      return false;
    }
    if (!customer?.email) {
      toast.error('Kunde hat keine E-Mail-Adresse hinterlegt.');
      return false;
    }
    setSending(true);
    try {
      const { blob, fileName } = await buildPdf('blob');
      if (blob) {
        try {
          const u = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = u; a.download = fileName; document.body.appendChild(a); a.click();
          a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
        } catch { /* optional */ }
      }

      let downloadUrl = '';
      if (blob && order?.id) {
        try {
          const safeNo = String(invoiceNumber || 'AZ').replace(/[^\w.-]+/g, '_');
          const storagePath = `${order.id}/anzahlung/${Date.now()}_${safeNo}.pdf`;
          const up = await supabase.storage
            .from('order-invoices')
            .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });
          if (up.error) throw up.error;

          const token = (crypto.randomUUID().replace(/-/g, '').slice(0, 10));

          const { data: userData } = await supabase.auth.getUser();
          const { error: docErr } = await supabase.from('order_documents').insert({
            order_id: order.id,
            file_name: fileName,
            file_path: storagePath,
            file_type: 'application/pdf',
            document_type: 'Anzahlungsrechnung',
            uploaded_by: userData.user?.id ?? null,
            download_token: token,
          } as any);
          if (docErr) throw docErr;

          downloadUrl = `https://alixwork.de/d/${token}`;
        } catch (upErr: any) {
          console.error('[AzInvoice] PDF-Upload/Doc-Insert fehlgeschlagen:', upErr);
          toast.warning('PDF konnte nicht abgelegt werden – E-Mail wird ohne Download-Link versendet.');
        }
      }

      const subject = `Anzahlungsrechnung ${invoiceNumber} – Auftrag ${orderNo}`;
      const body = [
        `Sehr geehrte Damen und Herren${customer?.contact_name ? `, ${customer.contact_name}` : ''},`,
        '',
        `anbei erhalten Sie die Anzahlungsrechnung ${invoiceNumber} zum Auftrag ${orderNo}.`,
        '',
        `Rechnungsbetrag (brutto): ${fmtMoney(grossDeposit, currency)} (MwSt ${taxPercentage}%)`,
        `Rechnungsdatum: ${fmtDate(invoiceDate)}`,
        `Fällig am: ${fmtDate(dueDate)}`,
        '',
        'Bankverbindung:',
        'Kontoinhaber: Alix Lasers GmbH',
        'Bank: Deutsche Bank',
        'IBAN: DE07 1007 0100 0142 6600 00',
        'SWIFT/BIC: DEUTDEBB101',
        '',
        'Bitte geben Sie bei der Überweisung die Rechnungsnummer als Verwendungszweck an.',
        '',
        'Mit freundlichen Grüßen',
        'Alix Lasers Deutschland',
      ].join('\n');

      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'customer-shipping-notice',
          recipientEmail: customer.email,
          idempotencyKey: `az-invoice-${order?.id || orderNo}-${invoiceNumber}-${Date.now()}`,
          bcc: ['k.trinh@alix-operation.de', 'natalia.p@alix-operation.de'],
          templateData: {
            subject,
            body,
            downloadUrl,
            downloadLabel: 'Anzahlungsrechnung herunterladen',
          },
        },
      });
      if (error) throw error;

      await recordNoteAndOrderDeposit();
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from('order_notes').insert({
          order_id: order?.id,
          note_type: 'email',
          is_internal: true,
          note_text: [
            `[Manuell versendet] Anzahlungsrechnung ${invoiceNumber}`,
            `An: ${customer.email}`,
            `BCC: k.trinh@alix-operation.de, natalia.p@alix-operation.de`,
            `Betreff: ${subject}`,
            '',
            body,
          ].join('\n'),
          created_by: userData.user?.id ?? null,
        } as any);
      } catch { /* nicht kritisch */ }

      toast.success(`Anzahlungsrechnung an ${customer.email} versendet (BCC: k.trinh, natalia.p).`);
      onReload?.();
      return true;
    } catch (e: any) {
      toast.error('Fehler beim Versenden: ' + (e?.message || 'Unbekannter Fehler'));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function saveAndSendEmail() {
    console.log('[AzInvoice] saveAndSendEmail clicked', {
      existingInvoice, hasDeposit, grossDeposit, customerEmail: customer?.email,
    });
    if (blockIfDuplicate()) return;
    if (!hasDeposit) {
      toast.error('Keine Anzahlung vereinbart.');
      return;
    }
    if (!customer?.email) {
      toast.error('Kunde hat keine E-Mail-Adresse hinterlegt.');
      return;
    }
    const booked = await postToBuchhaltung();
    if (!booked) {
      toast.error('Buchung fehlgeschlagen – E-Mail wurde NICHT versendet.');
      return;
    }
    const sent = await sendByEmail();
    if (sent) {
      toast.success('Vorgang abgeschlossen: Anzahlung gebucht und E-Mail versendet.');
    }
  }


  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" /> AZ Rechnung (Anzahlungsrechnung)
          {existingInvoice && (
            <span
              className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm ring-1 ring-red-700"
              title={`Anzahlungsrechnung ${existingInvoice.invoice_number}${existingInvoice.issue_date ? ` vom ${fmtDate(existingInvoice.issue_date)}` : ''} wurde bereits gestellt.`}
            >
              <Ban className="w-3.5 h-3.5" />
              RECHNUNG GESTELLT
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={generate}
            disabled={generating || booking || sending || postingToBuchhaltung || !hasDeposit || checkingExisting}
            title={existingInvoice ? 'Rechnung bereits gestellt – PDF kann neu erzeugt werden (kein neuer Buchungssatz).' : undefined}
          >
            {generating
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <FileDown className="w-4 h-4 mr-2" />}
            PDF Entwurf erstellen
          </Button>
          <Button
            onClick={saveAndSendEmail}
            disabled={generating || booking || sending || postingToBuchhaltung || !hasDeposit || !!existingInvoice || checkingExisting || !customer?.email}
            className="gold-gradient text-primary-foreground"
            title={!customer?.email ? 'Kunde hat keine E-Mail-Adresse' : 'Anzahlung festschreiben, in "Offene Anzahlungen" buchen und per E-Mail an Kunde (BCC k.trinh, natalia.p) senden'}
          >
            {(booking || postingToBuchhaltung || sending)
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <BookmarkCheck className="w-4 h-4 mr-2" />}
            Anzahlung Speichern und Email senden
          </Button>
          <Button
            variant="outline"
            onClick={sendByEmail}
            disabled={generating || booking || sending || postingToBuchhaltung || (!hasDeposit && !existingInvoice) || !customer?.email || checkingExisting}
            title={!customer?.email ? 'Kunde hat keine E-Mail-Adresse' : (existingInvoice ? 'Bereits gestellte Rechnung erneut per E-Mail versenden (kein neuer Buchungssatz).' : (!hasDeposit ? 'Keine Anzahlung vereinbart.' : undefined))}
          >
            {sending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Mail className="w-4 h-4 mr-2" />}
            {existingInvoice ? 'Rechnung per E-Mail versenden' : 'Anzahlung per E-Mail versenden'}
          </Button>
        </div>
      </div>

      {existingInvoice && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <Ban className="w-4 h-4 mt-0.5" />
          <div>
            Für diesen Auftrag wurde bereits die Anzahlungsrechnung{' '}
            <strong>{existingInvoice.invoice_number}</strong>
            {existingInvoice.issue_date ? <> vom <strong>{fmtDate(existingInvoice.issue_date)}</strong></> : null}{' '}
            gestellt. Ein erneutes Ausstellen ist gesperrt, um Doppelrechnungen zu vermeiden.
          </div>
        </div>
      )}


      {!hasDeposit && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>
            Für diesen Auftrag ist <strong>keine Anzahlung</strong> vereinbart. Es wird nichts abgezogen
            und keine Anzahlungsrechnung erzeugt. Tragen Sie unten optional einen Betrag ein, um trotzdem
            eine Anzahlungsrechnung zu erstellen.
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Rechnungsnummer</Label>
          <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="bg-secondary border-border mt-1 font-mono" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Rechnungsdatum</Label>
          <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="bg-secondary border-border mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Fällig am</Label>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-secondary border-border mt-1" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
        <div className="text-xs font-semibold tracking-wide text-primary">POSITION ANZAHLUNG</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
            <Input value={positionLabel} onChange={e => setPositionLabel(e.target.value)} className="bg-secondary border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Anzahlung (brutto, €)</Label>
            <Input type="number" inputMode="decimal" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="bg-secondary border-border mt-1" />
            {orderDeposit > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">aus Auftrag übernommen: {fmtMoney(orderDeposit, currency)}</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">MwSt (%)</Label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={taxPercentage === 0}
                  onChange={(e) => setTaxPercentage(e.target.checked ? 0 : 19)}
                  className="accent-primary"
                />
                Ohne MwSt (0%)
              </label>
            </div>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                inputMode="decimal"
                value={taxPercentage}
                onChange={e => setTaxPercentage(Number(e.target.value) || 0)}
                className="bg-secondary border-border"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveTaxPercentage(false)}
                disabled={savingTax}
                title="MwSt-Einstellung für diesen Auftrag speichern"
              >
                {savingTax ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Speichern'}
              </Button>
            </div>
            {order?.az_tax_percentage !== null && order?.az_tax_percentage !== undefined && (
              <p className="text-[11px] text-muted-foreground mt-1">
                gespeichert: {Number(order.az_tax_percentage)}%
              </p>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 pt-1 text-sm">

          <div className="rounded-md bg-background/60 border border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">Netto</div>
            <div className="font-semibold text-foreground">{fmtMoney(netDeposit, currency)}</div>
          </div>
          <div className="rounded-md bg-background/60 border border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">MwSt</div>
            <div className="font-semibold text-foreground">{fmtMoney(taxAmount, currency)}</div>
          </div>
          <div className="rounded-md bg-background/60 border border-primary/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">Brutto</div>
            <div className="font-semibold text-primary">{fmtMoney(grossDeposit, currency)}</div>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Einleitungstext</Label>
        <Textarea value={intro} onChange={e => setIntro(e.target.value)} rows={3} className="bg-secondary border-border mt-1" />
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm">
        <div className="text-xs text-muted-foreground mb-2">Vorschau Eckdaten</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <div><span className="text-muted-foreground">Auftragsnr.:</span> <span className="font-medium">{orderNo || '—'}</span></div>
          <div><span className="text-muted-foreground">Auftragsbetrag:</span> <span className="font-medium">{fmtMoney(orderTotal, currency)}</span></div>
          <div><span className="text-muted-foreground">Kunde:</span> <span className="font-medium">{customer?.company_name || customer?.contact_name || '—'}</span></div>
          <div><span className="text-muted-foreground">Anzahlung lt. Auftrag:</span> <span className="font-medium">{orderDeposit > 0 ? fmtMoney(orderDeposit, currency) : '— keine vereinbart —'}</span></div>
        </div>
      </div>
    </div>
  );
}
