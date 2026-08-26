import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { downloadStampedPdf, stampedPdfBlob } from '@/lib/facsimile/jsPdfHelpers';

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

const DRAFT_PREFIX = 'az-draft:';
const draftKey = (orderId?: string | null, orderNo?: string) =>
  `${DRAFT_PREFIX}${orderId || orderNo || 'neu'}`;

const MODE_PREFIX = 'az-mode:';
const modeKeyFn = (orderId?: string | null, orderNo?: string) =>
  `${MODE_PREFIX}${orderId || orderNo || 'neu'}`;
type SplitMode = 'single' | 'multi';
function readMode(key: string): SplitMode | null {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return v === 'single' || v === 'multi' ? v : null;
  } catch { return null; }
}
function writeMode(key: string, m: SplitMode) {
  try { window.localStorage.setItem(key, m); } catch { /* ignore */ }
}

type AzDraft = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  depositAmount: string;
  taxPercentage: number;
  positionLabel: string;
  intro: string;
  savedAt: string;
};

function readDraft(key: string): AzDraft | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    return JSON.parse(raw) as AzDraft;
  } catch { return null; }
}
function writeDraft(key: string, d: AzDraft) {
  try { window.localStorage.setItem(key, JSON.stringify(d)); } catch { /* ignore */ }
}
function removeDraft(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export default function AzInvoiceTab({ order, customer, items, onReload }: Props) {
  const currency = order?.currency || 'EUR';
  const orderNo = String(order?.order_number || '');
  const dKey = draftKey(order?.id, orderNo);
  const mKey = modeKeyFn(order?.id, orderNo);
  const initialDraft = useMemo(() => readDraft(dKey), [dKey]);
  const [hasDraft, setHasDraft] = useState<boolean>(!!initialDraft);
  const [splitMode, setSplitModeState] = useState<SplitMode | null>(() => readMode(mKey));
  const setSplitMode = (m: SplitMode) => { writeMode(mKey, m); setSplitModeState(m); };

  // Anzahlung aus Auftrag übernehmen
  const orderDeposit = Number(order?.deposit_amount) || 0;
  const orderTotal = useMemo(() => {
    const t = Number(order?.total_amount);
    if (Number.isFinite(t) && t > 0) return t;
    let sum = 0;
    for (const i of items || []) sum += (Number(i.quantity) || 0) * (Number(i.rate) || 0) * (1 + (Number(i.tax_percentage) || 0) / 100);
    return sum;
  }, [order, items]);

  const [invoiceNumber, setInvoiceNumber] = useState<string>(initialDraft?.invoiceNumber || `AZ-${orderNo || 'NEU'}`);
  const [invoiceDate, setInvoiceDate] = useState<string>(initialDraft?.invoiceDate || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>(initialDraft?.dueDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  })());
  const [depositAmount, setDepositAmount] = useState<string>(
    initialDraft?.depositAmount ?? (orderDeposit > 0 ? String(orderDeposit) : ''),
  );
  const [taxPercentage, setTaxPercentage] = useState<number>(() => {
    if (initialDraft) return Number(initialDraft.taxPercentage);
    const saved = order?.az_tax_percentage;
    return saved === null || saved === undefined ? 19 : Number(saved);
  });
  const [savingTax, setSavingTax] = useState(false);
  const [positionLabel, setPositionLabel] = useState<string>(
    initialDraft?.positionLabel || `Anzahlung gemäß Auftrag ${orderNo}`.trim(),
  );
  const [intro, setIntro] = useState<string>(
    initialDraft?.intro ||
    'Vielen Dank für Ihre Bestellung. Vereinbarungsgemäß stellen wir Ihnen hiermit die Anzahlung in Rechnung.',
  );
  const [generating, setGenerating] = useState(false);
  const [booking, setBooking] = useState(false);
  const [postingToBuchhaltung, setPostingToBuchhaltung] = useState(false);
  const [sending, setSending] = useState(false);
  const [existingInvoices, setExistingInvoices] = useState<Array<{ invoice_number: string; issue_date?: string | null; due_date?: string | null; gross_amount?: number | null; status?: string | null; net_amount?: number | null; vat_amount?: number | null; note?: string | null }>>([]);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [confirm, setConfirm] = useState<null | 'saveSend' | 'sendOnly'>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);


  // Prüft, ob die aktuell eingegebene Rechnungsnummer bereits vergeben ist
  const currentIsDuplicate = existingInvoices.find(
    (x) => (x.invoice_number || '').trim().toLowerCase() === invoiceNumber.trim().toLowerCase()
  );

  const releaseStalePointerLock = () => {
    if (typeof document === 'undefined') return;
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = 'auto';
    }
  };

  useEffect(() => {
    releaseStalePointerLock();
    return releaseStalePointerLock;
  }, [confirm]);

  useEffect(() => {
    if (hasDraft) return;
    if (orderDeposit > 0) setDepositAmount(String(orderDeposit));
  }, [orderDeposit, hasDraft]);

  // Fallback: Wenn im Auftrag kein deposit_amount hinterlegt ist, aus finance_deposits ziehen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasDraft) return;
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
  }, [order?.id, orderNo, orderDeposit, hasDraft]);

  // Entwurf automatisch speichern (persistiert alle Formularfelder pro Auftrag).
  useEffect(() => {
    if (checkingExisting) return; // erst nach initialem Load, sonst überschreiben wir mit Defaults
    const d: AzDraft = {
      invoiceNumber, invoiceDate, dueDate, depositAmount,
      taxPercentage, positionLabel, intro,
      savedAt: new Date().toISOString(),
    };
    writeDraft(dKey, d);
    if (!hasDraft) setHasDraft(true);
  }, [dKey, invoiceNumber, invoiceDate, dueDate, depositAmount, taxPercentage, positionLabel, intro, checkingExisting]);

  function clearDraft() {
    removeDraft(dKey);
    setHasDraft(false);
  }

  // Alle bereits gestellten AZ-Rechnungen für diesen Auftrag laden
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!order?.id && !orderNo) { setCheckingExisting(false); return; }
      setCheckingExisting(true);
      try {
        let query = supabase
          .from('finance_deposits' as any)
          .select('invoice_number, deposit_number, issue_date, due_date, order_id, order_number, gross_amount, net_amount, vat_amount, status, note')
          .order('issue_date', { ascending: true });
        const orFilters: string[] = [];
        if (order?.id) orFilters.push(`order_id.eq.${order.id}`);
        if (orderNo) {
          orFilters.push(`order_number.eq.${orderNo}`);
        }
        if (orFilters.length) query = query.or(orFilters.join(','));
        const { data } = await query;
        if (!cancelled) {
          const list = (data || []).map((row: any) => ({
            invoice_number: row.invoice_number || row.deposit_number || `AZ-${orderNo}`,
            issue_date: row.issue_date ?? null,
            due_date: row.due_date ?? null,
            net_amount: row.net_amount ?? null,
            vat_amount: row.vat_amount ?? null,
            note: row.note ?? null,
            gross_amount: row.gross_amount ?? null,
            status: row.status ?? null,
          }));
          setExistingInvoices(list);
          const base = `AZ-${orderNo}`;
          // Split-Mode aus bestehenden Rechnungen ableiten (falls noch nicht gesetzt).
          let effectiveMode: SplitMode | null = readMode(mKey);
          if (list.length > 0 && !effectiveMode) {
            const hasSuffixed = list.some(inv => /-\d+$/.test((inv.invoice_number || '').trim()));
            effectiveMode = hasSuffixed ? 'multi' : 'single';
            writeMode(mKey, effectiveMode);
            setSplitModeState(effectiveMode);
          }
          // Vorschlag nur für Multi-Modus (durchgängige Nummerierung mit Suffix)
          if (list.length > 0 && !hasDraft && effectiveMode === 'multi') {
            // höchsten vorhandenen Suffix ermitteln (statt list.length, robust bei Lücken)
            const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(`^${esc}-(\\d+)$`);
            let maxN = 0;
            for (const inv of list) {
              const m = (inv.invoice_number || '').trim().match(rx);
              if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
            }
            const next = Math.max(maxN + 1, list.length + 1);
            setInvoiceNumber(`${base}-${next}`);
            setPositionLabel(`Anzahlung Rate ${next} gemäß Auftrag ${orderNo}`.trim());
            const sum = list.reduce((s, r: any) => s + (Number(r.gross_amount) || 0), 0);
            const rest = Math.max(0, (Number(orderDeposit) || 0) - sum);
            if (rest > 0) setDepositAmount(String(Number(rest.toFixed(2))));
            else setDepositAmount('');
          }
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

  // Summe aller bereits erfassten Anzahlungsraten (ohne die aktuell im Formular offene neue Rate)
  const sumExistingRates = existingInvoices.reduce((s, r: any) => s + (Number(r.gross_amount) || 0), 0);
  // Restbetrag lt. Auftragsanzahlung
  const openRestDeposit = Math.max(0, Number((orderDeposit - sumExistingRates).toFixed(2)));
  // Aktuelle Rate wird geprüft, sofern sie nicht bereits in existingInvoices geführt wird (currentIsDuplicate)
  const currentCountsTowardsSum = !currentIsDuplicate;
  const projectedSum = sumExistingRates + (currentCountsTowardsSum ? grossDeposit : 0);
  const exceedsDeposit = orderDeposit > 0 && projectedSum - orderDeposit > 0.01;

  type PdfOverride = {
    invoiceNumber?: string;
    invoiceDate?: string | null;
    dueDate?: string | null;
    gross?: number;
    taxPercentage?: number;
    positionLabel?: string;
  };

  async function buildPdf(mode: BuildMode, override?: PdfOverride): Promise<{ doc: any; fileName: string; blob?: Blob }> {
    const invNo = override?.invoiceNumber ?? invoiceNumber;
    const invDate = override?.invoiceDate ?? invoiceDate;
    const dDate = override?.dueDate ?? dueDate;
    const taxPct = override?.taxPercentage ?? taxPercentage;
    const grossAmtP = override?.gross ?? grossDeposit;
    const netAmtP = grossAmtP / (1 + (taxPct || 0) / 100);
    const taxAmtP = grossAmtP - netAmtP;
    const posLabel = override?.positionLabel ?? positionLabel;
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
        ['Rechnungsnr.', invNo || '—'],
        ['Rechnungsdatum', fmtDate(invDate)],
        ['Fällig am', fmtDate(dDate)],
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

      // Absenderzeile (Pflichtangaben §14 UStG) – klein über der Rechnungsadresse
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(
        'Alix Lasers GmbH · Zeppelin Straße 3 · 12529 Berlin- Schönefeld · USt-IdNr. DE321691012',
        LEFT, TOP_CONTENT + 8,
      );

      // Rechnungsadresse
      let ay = TOP_CONTENT + 16;
      const billing = customer?.billing_address || customer?.shipping_address || {};
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(20, 60, 110);
      doc.text('Rechnungsadresse', LEFT, ay);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(40, 40, 40);
      let y = ay + 5;
      const compName = customer?.company_name ? String(customer.company_name).trim() : '';
      const contName = customer?.contact_name ? String(customer.contact_name).trim() : '';
      if (compName) { doc.text(compName, LEFT, y); y += 4.4; }
      // Kontaktname nur ausgeben, wenn er sich vom Firmennamen unterscheidet.
      if (contName && contName.toLowerCase() !== compName.toLowerCase()) {
        doc.text(contName, LEFT, y); y += 4.4;
      }
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
          posLabel || `Anzahlung Auftrag ${orderNo}`,
          1,
          fmtMoney(netAmtP, currency),
          `${taxPct}%`,
          fmtMoney(netAmtP, currency),
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
      doc.text(fmtMoney(netAmtP, currency), totalsValueX, finalY, { align: 'right' });
      doc.text(`MwSt (${taxPct}%):`, totalsLabelX, finalY + 5);
      doc.text(fmtMoney(taxAmtP, currency), totalsValueX, finalY + 5, { align: 'right' });
      doc.setDrawColor(20, 60, 110);
      doc.line(totalsLabelX, finalY + 8, totalsValueX, finalY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 60, 110);
      doc.text('Rechnungsbetrag (brutto):', totalsLabelX, finalY + 14);
      doc.text(fmtMoney(grossAmtP, currency), totalsValueX, finalY + 14, { align: 'right' });

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
        `${fmtMoney(grossAmtP, currency)} (brutto) wird auf die im Mietkaufvertrag vereinbarte Gesamtanzahlung angerechnet. ` +
        `Bitte überweisen Sie den Rechnungsbetrag bis zum ${fmtDate(dDate)} unter Angabe der ` +
        `Rechnungsnummer ${invNo}.`;
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
          doc.text(`Anzahlungsrechnung ${invNo}`, LEFT, TOP_CONTENT - 8);
          doc.setDrawColor(200, 200, 200);
          doc.line(LEFT, TOP_CONTENT - 5, RIGHT, TOP_CONTENT - 5);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        // Absender-Pflichtangaben im Footer auf jeder Seite
        doc.text(
          'Alix Lasers GmbH · Zeppelin Straße 3 · 12529 Berlin- Schönefeld · USt-IdNr. DE321691012',
          LEFT, PAGE_H - 12,
        );
        doc.text(
          'Amtsgericht Berlin-Charlottenburg · HRB 245388 · Geschäftsführerin: ABLM Management UG (haftungsbeschränkt)',
          LEFT, PAGE_H - 8,
        );
        doc.setFontSize(8);
        doc.text(
          `Anzahlungsrechnung ${invNo}  ·  Seite ${i} von ${totalPages}`,
          RIGHT, PAGE_H - 4, { align: 'right' },
        );
      }

    const fileName = `Anzahlungsrechnung_${invNo || orderNo}.pdf`;
    const autoFile = { order_id: order?.id ?? null, customer_id: customer?.id ?? null, title: `Anzahlungsrechnung ${invNo ?? ''}`.trim() };
    if (mode === 'download') {
      await downloadStampedPdf(doc, 'invoice', fileName, invNo ?? undefined, autoFile);
      return { doc, fileName };
    }
    const blob: Blob = await stampedPdfBlob(doc, 'invoice', invNo ?? undefined, autoFile);
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

  async function saveDraftDeposit(): Promise<void> {
    if (!hasDeposit) return;
    try {
      const netAmt = Number(netDeposit.toFixed(2));
      const vatAmt = Number(taxAmount.toFixed(2));
      const grossAmt = Number(grossDeposit.toFixed(2));
      const sourceRef = order?.id ? `order:${order.id}:${invoiceNumber}` : `inv:${invoiceNumber}`;
      const { data: existing } = await supabase
        .from('finance_deposits' as any)
        .select('id, status')
        .eq('source', 'alixwork')
        .eq('source_ref', sourceRef)
        .limit(1);
      if (existing && existing.length > 0) return; // Bereits Entwurf/Offen vorhanden
      const payload: any = {
        source: 'alixwork',
        source_ref: sourceRef,
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
        status: 'entwurf',
        release_status: 'nicht_freigegeben',
        note: `Entwurf Anzahlungsrechnung ${invoiceNumber} – ${positionLabel || `Anzahlung Auftrag ${orderNo}`} (MwSt ${taxPercentage}%).`,
      };
      const { error } = await supabase.from('finance_deposits' as any).insert(payload);
      if (error) console.warn('[AzInvoice] saveDraftDeposit failed:', error.message);
    } catch (e: any) {
      console.warn('[AzInvoice] saveDraftDeposit exception:', e?.message);
    }
  }

  async function postToBuchhaltung(): Promise<boolean> {
    if (blockIfDuplicate()) return false;
    if (!hasDeposit) {
      toast.error('Keine Anzahlung vereinbart.');
      return false;
    }
    setPostingToBuchhaltung(true);
    try {
      const sourceRef = order?.id ? `order:${order.id}:${invoiceNumber}` : `inv:${invoiceNumber}`;
      // Bestehenden Datensatz suchen – ggf. Entwurf zu "Offen" hochstufen
      const { data: existing } = await supabase
        .from('finance_deposits' as any)
        .select('id, status')
        .eq('source', 'alixwork')
        .eq('source_ref', sourceRef)
        .limit(1);
      const existingRow: any = existing?.[0];
      if (existingRow && existingRow.status !== 'entwurf') {
        toast.info(`Anzahlung ${invoiceNumber} ist bereits in der Buchhaltung erfasst.`);
        return true;
      }

      const netAmt = Number(netDeposit.toFixed(2));
      const vatAmt = Number(taxAmount.toFixed(2));
      const grossAmt = Number(grossDeposit.toFixed(2));

      const payload: any = {
        source: 'alixwork',
        source_ref: sourceRef,
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
      let insertedId: string | null = null;
      if (existingRow) {
        const { error: updErr } = await supabase.from('finance_deposits' as any)
          .update({ ...payload, status: 'offen' })
          .eq('id', existingRow.id);
        if (updErr) throw updErr;
        insertedId = existingRow.id;
      } else {
        const { data: inserted, error } = await supabase.from('finance_deposits' as any).insert(payload).select('id').maybeSingle();
        if (error) throw error;
        insertedId = (inserted as any)?.id ?? null;
      }
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
        source_id: insertedId,
        vorgang: 'Anzahlungsrechnung',
      });
      toast.success(`In Buchhaltung übernommen: ${invoiceNumber} wurde unter Offene Anzahlungen erfasst.`);
      clearDraft();
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
    if (currentIsDuplicate) {
      toast.error(`Für diesen Auftrag wurde bereits die Anzahlungsrechnung ${currentIsDuplicate.invoice_number} gestellt. Ein erneutes Ausstellen ist nicht möglich.`);
      return true;
    }
    if (exceedsDeposit) {
      toast.error(
        `Die Summe aller Anzahlungsraten (${fmtMoney(projectedSum, currency)}) überschreitet die Anzahlung lt. Auftrag (${fmtMoney(orderDeposit, currency)}). ` +
        `Offener Restbetrag: ${fmtMoney(openRestDeposit, currency)}.`,
      );
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
      await saveDraftDeposit();
      toast.success(currentIsDuplicate
        ? `PDF neu erzeugt (${invoiceNumber}). Es wurde keine zweite Rechnung angelegt.`
        : `Entwurf ${invoiceNumber} gespeichert – erscheint als „Entwurf" in „Offene Anzahlungen".`);
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

  async function sendByEmail(override?: PdfOverride): Promise<boolean> {
    const invNo = override?.invoiceNumber ?? invoiceNumber;
    const invDate = override?.invoiceDate ?? invoiceDate;
    const dDate = override?.dueDate ?? dueDate;
    const taxPct = override?.taxPercentage ?? taxPercentage;
    const gross = override?.gross ?? grossDeposit;
    const isResend = !!override;
    console.log('[AzInvoice] sendByEmail called', {
      hasDeposit, currentIsDuplicate, isResend, customerEmail: customer?.email,
    });
    if (!isResend && !hasDeposit && !currentIsDuplicate) {
      toast.error('Keine Anzahlung vereinbart.');
      return false;
    }
    if (!customer?.email) {
      toast.error('Kunde hat keine E-Mail-Adresse hinterlegt.');
      return false;
    }
    setSending(true);
    try {
      const { blob, fileName } = await buildPdf('blob', override);

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
          const safeNo = String(invNo || 'AZ').replace(/[^\w.-]+/g, '_');
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

      const subject = `Anzahlungsrechnung ${invNo} – Auftrag ${orderNo}`;
      const body = [
        `Sehr geehrte Damen und Herren${customer?.contact_name ? `, ${customer.contact_name}` : ''},`,
        '',
        `anbei erhalten Sie die Anzahlungsrechnung ${invNo} zum Auftrag ${orderNo}.`,
        '',
        `Rechnungsbetrag (brutto): ${fmtMoney(gross, currency)} (MwSt ${taxPct}%)`,
        `Rechnungsdatum: ${fmtDate(invDate)}`,
        `Fällig am: ${fmtDate(dDate)}`,
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
          idempotencyKey: `az-invoice-${order?.id || orderNo}-${invNo}-${Date.now()}`,
          bcc: ['k.trinh@alix-operation.de'],
          templateData: {
            subject,
            body,
            downloadUrl,
            downloadLabel: 'Anzahlungsrechnung herunterladen',
          },
        },
      });
      if (error) throw error;

      if (!isResend) await recordNoteAndOrderDeposit();
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from('order_notes').insert({
          order_id: order?.id,
          note_type: 'email',
          is_internal: true,
          note_text: [
            `[Manuell versendet] Anzahlungsrechnung ${invNo}`,
            `An: ${customer.email}`,
            `BCC: k.trinh@alix-operation.de`,
            `Betreff: ${subject}`,
            '',
            body,
          ].join('\n'),
          created_by: userData.user?.id ?? null,
        } as any);
      } catch { /* nicht kritisch */ }

      // Status nach erfolgreichem Versand von "Entwurf" auf "Versendet / Offen" setzen
      try {
        let upd: any = supabase
          .from('finance_deposits' as any)
          .update({ status: 'offen' })
          .eq('status', 'entwurf')
          .eq('invoice_number', invNo);
        if (order?.id) upd = upd.eq('order_id', order.id);
        const { error: statusErr } = await upd;
        if (statusErr) {
          console.warn('[AzInvoice] Statusupdate fehlgeschlagen:', statusErr.message);
        } else {
          setExistingInvoices(prev => prev.map(row =>
            row.invoice_number === invNo && row.status === 'entwurf'
              ? { ...row, status: 'offen' }
              : row));
        }
      } catch (statusEx: any) {
        console.warn('[AzInvoice] Statusupdate Exception:', statusEx?.message);
      }

      toast.success(`Anzahlungsrechnung an ${customer.email} versendet (BCC: k.trinh) – Status: versendet.`);
      if (!isResend) clearDraft();
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
      currentIsDuplicate, hasDeposit, grossDeposit, customerEmail: customer?.email,
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

  function openConfirm(mode: 'saveSend' | 'sendOnly', e?: React.MouseEvent<HTMLButtonElement>) {
    e?.preventDefault();
    e?.stopPropagation();
    releaseStalePointerLock();

    const busy = generating || booking || sending || postingToBuchhaltung;
    console.log(`[AzInvoice] click ${mode} button`, {
      generating,
      booking,
      sending,
      postingToBuchhaltung,
      hasDeposit,
      currentIsDuplicate,
      checkingExisting,
      customerEmail: customer?.email,
    });

    if (busy) {
      toast.info('Der aktuelle Vorgang läuft noch. Bitte kurz warten.');
      return;
    }
    if (!customer?.email) {
      toast.error('Kunde hat keine E-Mail-Adresse hinterlegt.');
      return;
    }
    if (mode === 'saveSend') {
      if (!hasDeposit) {
        toast.error('Keine Anzahlung vereinbart.');
        return;
      }
      if (currentIsDuplicate) {
        toast.error(`Anzahlungsrechnung ${currentIsDuplicate.invoice_number} wurde bereits gestellt. Bitte „Rechnung per E-Mail versenden" nutzen.`);
        return;
      }
    }
    if (mode === 'sendOnly' && !hasDeposit && !currentIsDuplicate) {
      toast.error('Keine Anzahlung vereinbart.');
      return;
    }

    setConfirm(mode);
  }

  /** Baut ein PdfOverride aus einer bereits erfassten Anzahlungsrate. */
  function overrideFromRate(inv: typeof existingInvoices[number], index: number): PdfOverride {
    const gross = Number(inv.gross_amount) || 0;
    const net = Number(inv.net_amount) || 0;
    const vat = Number(inv.vat_amount) || 0;
    let taxPct = taxPercentage;
    if (net > 0 && vat >= 0) taxPct = Math.round((vat / net) * 1000) / 10;
    const hasSuffix = /-\d+$/.test((inv.invoice_number || '').trim());
    return {
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.issue_date || invoiceDate,
      dueDate: inv.due_date || dueDate,
      gross,
      taxPercentage: taxPct,
      positionLabel: hasSuffix
        ? `Anzahlung Rate ${index + 1} gemäß Auftrag ${orderNo}`.trim()
        : `Anzahlung gemäß Auftrag ${orderNo}`.trim(),
    };
  }

  async function downloadRate(inv: typeof existingInvoices[number], index: number) {
    if (rowBusy) return;
    setRowBusy(`dl:${inv.invoice_number}`);
    try {
      await buildPdf('download', overrideFromRate(inv, index));
      toast.success(`PDF ${inv.invoice_number} heruntergeladen.`);
    } catch (e: any) {
      toast.error('PDF konnte nicht erzeugt werden: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setRowBusy(null);
    }
  }

  async function resendRate(inv: typeof existingInvoices[number], index: number) {
    if (rowBusy) return;
    if (!customer?.email) {
      toast.error('Kunde hat keine E-Mail-Adresse hinterlegt.');
      return;
    }
    setRowBusy(`mail:${inv.invoice_number}`);
    try {
      await sendByEmail(overrideFromRate(inv, index));
    } finally {
      setRowBusy(null);
    }
  }

  function addNewRate() {

    const base = `AZ-${orderNo}`;
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`^${esc}-(\\d+)$`);
    let maxN = 0;
    let hasBase = false;
    for (const inv of existingInvoices) {
      const n = (inv.invoice_number || '').trim();
      if (n === base) { hasBase = true; continue; }
      const m = n.match(rx);
      if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
    }
    // Edge Case „nachträglicher Sinneswandel":
    // wenn bereits eine unsuffigierte Rechnung existiert (Single-Modus),
    // startet die neue Rate bei -2 (die -1 wird nie vergeben, um die bereits
    // versendete Rechnung ohne Suffix nicht zu tangieren).
    let next: number;
    if (hasBase && maxN === 0) {
      next = 2;
    } else {
      next = Math.max(maxN + 1, 2);
    }
    setSplitMode('multi');
    setInvoiceNumber(`${base}-${next}`);
    setPositionLabel(
      hasBase && next === 2
        ? `Anzahlung Rate 2 (nachträglich) gemäß Auftrag ${orderNo}`.trim()
        : `Anzahlung Rate ${next} gemäß Auftrag ${orderNo}`.trim()
    );
    const d = new Date();
    setInvoiceDate(d.toISOString().slice(0, 10));
    const due = new Date(d); due.setDate(due.getDate() + 14);
    setDueDate(due.toISOString().slice(0, 10));
    if (openRestDeposit > 0) setDepositAmount(String(openRestDeposit));
    else setDepositAmount('');
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 card-glow space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" /> AZ Rechnung (Anzahlungsrechnung)
          {currentIsDuplicate && (
            <span
              className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm ring-1 ring-red-700"
              title={`Anzahlungsrechnung ${currentIsDuplicate.invoice_number}${currentIsDuplicate.issue_date ? ` vom ${fmtDate(currentIsDuplicate.issue_date)}` : ''} wurde bereits gestellt.`}
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
            title={currentIsDuplicate ? 'Rechnung bereits gestellt – PDF kann neu erzeugt werden (kein neuer Buchungssatz).' : undefined}
          >
            {generating
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <FileDown className="w-4 h-4 mr-2" />}
            PDF Entwurf erstellen
          </Button>
          <Button
            type="button"
            onMouseDown={() => releaseStalePointerLock()}
            onClick={(e) => openConfirm('saveSend', e)}
            disabled={generating || booking || sending || postingToBuchhaltung}
            className="gold-gradient text-primary-foreground"
            title={!customer?.email ? 'Kunde hat keine E-Mail-Adresse' : 'Anzahlung festschreiben, in "Offene Anzahlungen" buchen und per E-Mail an Kunde (BCC k.trinh) senden'}
            style={{ pointerEvents: 'auto' }}
          >
            {(booking || postingToBuchhaltung || sending)
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <BookmarkCheck className="w-4 h-4 mr-2" />}
            Anzahlung Speichern und Email senden
          </Button>
          <Button
            type="button"
            variant="outline"
            onMouseDown={() => releaseStalePointerLock()}
            onClick={(e) => openConfirm('sendOnly', e)}
            disabled={generating || booking || sending || postingToBuchhaltung}
            title={!customer?.email ? 'Kunde hat keine E-Mail-Adresse' : (currentIsDuplicate ? 'Bereits gestellte Rechnung erneut per E-Mail versenden (kein neuer Buchungssatz).' : (!hasDeposit ? 'Keine Anzahlung vereinbart.' : undefined))}
            style={{ pointerEvents: 'auto' }}
          >
            {sending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Mail className="w-4 h-4 mr-2" />}
            {currentIsDuplicate ? 'Rechnung per E-Mail versenden' : 'Anzahlung per E-Mail versenden'}
          </Button>
          {(splitMode === 'multi' || (splitMode === 'single' && existingInvoices.length > 0)) && (
            <Button
              type="button"
              variant="outline"
              onClick={addNewRate}
              title={
                splitMode === 'single'
                  ? 'Nachträglich eine weitere Rate ergänzen (startet bei -2, die bereits versendete Rechnung bleibt unverändert ohne Suffix).'
                  : 'Weitere Anzahlungsrate anlegen – Rechnungsnummer wird hochgezählt und Restbetrag vorbelegt.'
              }
            >
              + Weitere Anzahlung
            </Button>
          )}
          {hasDraft && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearDraft();
                toast.info('Entwurf verworfen. Felder werden beim nächsten Öffnen neu vorbelegt.');
              }}
              title="Gespeicherten lokalen Entwurf löschen"
            >
              Entwurf verwerfen
            </Button>
          )}

        </div>
      </div>

      {/* Mode-Chooser: nur solange keine Anzahlungsrechnung existiert UND noch keine Wahl getroffen wurde. */}
      {!checkingExisting && !splitMode && existingInvoices.length === 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
          <div className="text-sm font-semibold text-primary">
            Wie soll die Anzahlung gestellt werden?
          </div>
          <p className="text-xs text-muted-foreground">
            Bitte einmalig festlegen. Diese Wahl bestimmt die Rechnungsnummerierung:
            <br />
            <strong>Eine Rechnung</strong> → <span className="font-mono">AZ-{orderNo || '…'}</span> (ohne Suffix).
            <br />
            <strong>Mehrere Raten</strong> → <span className="font-mono">AZ-{orderNo || '…'}-1</span>, <span className="font-mono">-2</span>, …
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gold-gradient text-primary-foreground"
              onClick={() => {
                setSplitMode('single');
                const base = `AZ-${orderNo}`;
                setInvoiceNumber(base);
                setPositionLabel(`Anzahlung gemäß Auftrag ${orderNo}`.trim());
                if (orderDeposit > 0) setDepositAmount(String(orderDeposit));
              }}
            >
              Anzahlung in einer Rechnung stellen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSplitMode('multi');
                const base = `AZ-${orderNo}`;
                setInvoiceNumber(`${base}-1`);
                setPositionLabel(`Anzahlung Rate 1 gemäß Auftrag ${orderNo}`.trim());
              }}
            >
              Anzahlung in mehreren Raten stellen
            </Button>
          </div>
        </div>
      )}


      {confirm && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 2147483647,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)',
            pointerEvents: 'auto',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !(booking || postingToBuchhaltung || sending)) setConfirm(null); }}
        >
          <div
            style={{
              background: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              padding: 24,
              maxWidth: 520,
              width: 'calc(100% - 32px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {confirm === 'saveSend' ? 'Anzahlung speichern und per E-Mail senden?' : 'Anzahlungsrechnung per E-Mail senden?'}
            </h3>
            <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 16, lineHeight: 1.5 }}>
              <div><strong>Rechnungsnummer:</strong> {invoiceNumber}</div>
              <div><strong>Betrag (brutto):</strong> {fmtMoney(grossDeposit, currency)} (MwSt {taxPercentage}%)</div>
              <div><strong>Empfänger:</strong> {customer?.email || '—'}</div>
              <div><strong>BCC:</strong> k.trinh@alix-operation.de</div>
              {confirm === 'saveSend' && (
                <div style={{ marginTop: 8 }}>
                  Die Rechnung wird festgeschrieben, in <em>Offene Anzahlungen</em> gebucht
                  und anschließend per E-Mail versendet.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button
                variant="outline"
                onClick={() => setConfirm(null)}
                disabled={booking || postingToBuchhaltung || sending}
              >
                Abbrechen
              </Button>
              <Button
                className="gold-gradient text-primary-foreground"
                disabled={booking || postingToBuchhaltung || sending}
                onClick={async () => {
                  const mode = confirm;
                  if (mode === 'saveSend') await saveAndSendEmail();
                  else if (mode === 'sendOnly') await sendByEmail();
                  setConfirm(null);
                }}
              >
                {(booking || postingToBuchhaltung || sending)
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : null}
                Bestätigen &amp; senden
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}


      {existingInvoices.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold tracking-wide text-primary">
              ANZAHLUNGSRATEN ({existingInvoices.length})
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={openRestDeposit <= 0}
              title={openRestDeposit <= 0 ? 'Anzahlung lt. Auftrag ist vollständig in Raten aufgeteilt.' : 'Neue Rate anlegen – Restbetrag wird vorbelegt.'}
              onClick={addNewRate}
            >
              + Weitere Anzahlungsrate hinzufügen
            </Button>
          </div>
          <ul className="space-y-1">
            {existingInvoices.map((inv, i) => (
              <li key={`${inv.invoice_number}-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border/50 last:border-0 py-1">
                <span className="font-mono text-foreground">Rate {i + 1} · {inv.invoice_number}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {inv.issue_date ? fmtDate(inv.issue_date) : '—'}
                    {inv.gross_amount != null ? ` · ${fmtMoney(Number(inv.gross_amount), currency)}` : ''}
                    {inv.status ? ` · ${inv.status === 'entwurf' ? 'Entwurf' : inv.status === 'offen' ? 'Versendet' : inv.status}` : ''}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    disabled={!!rowBusy}
                    title={`PDF der Anzahlungsrechnung ${inv.invoice_number} erneut herunterladen`}
                    onClick={() => downloadRate(inv, i)}
                  >
                    {rowBusy === `dl:${inv.invoice_number}`
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <FileDown className="w-3.5 h-3.5" />}
                    <span className="ml-1">PDF</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    disabled={!!rowBusy || !customer?.email}
                    title={customer?.email
                      ? `Anzahlungsrechnung ${inv.invoice_number} erneut an ${customer.email} senden`
                      : 'Kunde hat keine E-Mail-Adresse hinterlegt.'}
                    onClick={() => resendRate(inv, i)}
                  >
                    {rowBusy === `mail:${inv.invoice_number}`
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Mail className="w-3.5 h-3.5" />}
                    <span className="ml-1">E-Mail</span>
                  </Button>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 grid sm:grid-cols-3 gap-2 text-[11px]">
            <div className="rounded bg-background/60 border border-border px-2 py-1">
              <div className="text-muted-foreground">Anzahlung lt. Auftrag</div>
              <div className="font-semibold text-foreground">{fmtMoney(orderDeposit, currency)}</div>
            </div>
            <div className="rounded bg-background/60 border border-border px-2 py-1">
              <div className="text-muted-foreground">Bereits in Raten</div>
              <div className="font-semibold text-foreground">{fmtMoney(sumExistingRates, currency)}</div>
            </div>
            <div className={`rounded border px-2 py-1 ${openRestDeposit > 0 ? 'bg-primary/10 border-primary/40' : 'bg-background/60 border-border'}`}>
              <div className="text-muted-foreground">Offener Restbetrag</div>
              <div className={`font-semibold ${openRestDeposit > 0 ? 'text-primary' : 'text-foreground'}`}>{fmtMoney(openRestDeposit, currency)}</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Mehrere Anzahlungsraten sind erlaubt. Rechnungsdatum darf in der Zukunft liegen. Die Summe aller Raten darf die Anzahlung lt. Auftrag nicht überschreiten.
          </p>
        </div>
      )}

      {exceedsDeposit && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>
            Die geplante Rate ({fmtMoney(grossDeposit, currency)}) übersteigt zusammen mit den bereits erfassten Raten ({fmtMoney(sumExistingRates, currency)}) die Anzahlung lt. Auftrag ({fmtMoney(orderDeposit, currency)}).
            Offener Restbetrag: <strong>{fmtMoney(openRestDeposit, currency)}</strong>.
          </div>
        </div>
      )}

      {currentIsDuplicate && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          <Ban className="w-4 h-4 mt-0.5" />
          <div>
            Die Rechnungsnummer <strong>{currentIsDuplicate.invoice_number}</strong>
            {currentIsDuplicate.issue_date ? <> vom <strong>{fmtDate(currentIsDuplicate.issue_date)}</strong></> : null}{' '}
            ist bereits vergeben. Bitte eine andere Nummer wählen (z. B. „+ Weitere Anzahlungsrate hinzufügen").
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
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Rechnungsnummer</Label>
            {(splitMode === 'multi' || (splitMode === 'single' && existingInvoices.length > 0)) && (
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                title={
                  splitMode === 'single'
                    ? 'Nachträglich eine weitere Rate ergänzen (startet bei -2).'
                    : 'Nächste Rate anlegen – Nummer wird hochgezählt und Restbetrag vorbelegt.'
                }
                onClick={addNewRate}
              >
                + Weitere Rate
              </button>
            )}
          </div>
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
