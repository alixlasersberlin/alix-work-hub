import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Banknote, Plus, Download, Upload, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';
import CmrReadOnlyBanner from '@/components/cmr/CmrReadOnlyBanner';

type Doc = {
  id: string; doc_number: string | null; customer_id: string | null; customer_name: string | null;
  doc_date: string; due_date: string | null; gross_total: number; paid_total: number; currency: string; status: string;
};
type Pay = { id: string; document_id: string | null; paid_on: string; amount: number; method: string | null; reference: string | null };

export default function CmrBuchhaltung() {
  const { tenantId, settings, loading, canWrite} = useCmrTenant();
  const [invoices, setInvoices] = useState<Doc[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<'offen' | 'alle' | 'zahlungen' | 'ust'>('offen');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('cmr_documents' as any).select('*').eq('tenant_id', tenantId)
        .in('doc_type', ['rechnung', 'proforma', 'gutschrift']).order('doc_date', { ascending: false }).limit(500),
      supabase.from('cmr_payments' as any).select('*').eq('tenant_id', tenantId).order('paid_on', { ascending: false }).limit(500),
    ]);
    setInvoices(((d as any) || []) as Doc[]);
    setPayments(((p as any) || []) as Pay[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const open_ = useMemo(() => invoices.filter((i) => Number(i.gross_total) - Number(i.paid_total) > 0.01), [invoices]);
  const sums = useMemo(() => ({
    invoiced: invoices.reduce((s, i) => s + Number(i.gross_total || 0), 0),
    paid: invoices.reduce((s, i) => s + Number(i.paid_total || 0), 0),
    open: open_.reduce((s, i) => s + (Number(i.gross_total) - Number(i.paid_total)), 0),
  }), [invoices, open_]);

  /** Fälligkeitsstruktur (Aging) der offenen Posten. */
  const aging = useMemo(() => {
    const buckets = [
      { label: 'Nicht fällig', min: -Infinity, max: 0 },
      { label: '1–30 Tage', min: 1, max: 30 },
      { label: '31–60 Tage', min: 31, max: 60 },
      { label: '61–90 Tage', min: 61, max: 90 },
      { label: '> 90 Tage', min: 91, max: Infinity },
    ].map((b) => ({ ...b, amount: 0, count: 0 }));
    open_.forEach((i) => {
      const openAmt = Number(i.gross_total) - Number(i.paid_total);
      const days = i.due_date ? Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000) : 0;
      const b = buckets.find((x) => days >= x.min && days <= x.max) ?? buckets[0];
      b.amount += openAmt;
      b.count += 1;
    });
    return buckets;
  }, [open_]);


  /** Umsatzsteuer-Auswertung je Monat (nur CMR-Belege). */
  const ustRows = useMemo(() => {
    const map = new Map<string, { net: number; tax: number; gross: number }>();
    invoices.forEach((i) => {
      const key = String(i.doc_date).slice(0, 7);
      const sign = (i as any).doc_type === 'gutschrift' ? -1 : 1;
      const e = map.get(key) ?? { net: 0, tax: 0, gross: 0 };
      const gross = Number(i.gross_total || 0);
      const net = Number((i as any).net_total ?? 0);
      e.gross += sign * gross;
      e.net += sign * net;
      e.tax += sign * Number((i as any).tax_total ?? gross - net);
      map.set(key, e);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, v]) => ({ month, ...v }));
  }, [invoices]);

  const exportCsv = () => {
    const sep = ';';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let name = 'CMR_Export.csv';
    let csv = '';
    if (tab === 'zahlungen') {
      name = 'CMR_Zahlungen.csv';
      csv = ['Datum', 'Beleg', 'Betrag', 'Zahlungsart', 'Referenz'].join(sep) + '\n';
      csv += payments.map((p) => [
        p.paid_on, invoices.find((i) => i.id === p.document_id)?.doc_number ?? '', Number(p.amount).toFixed(2), p.method ?? '', p.reference ?? '',
      ].map(esc).join(sep)).join('\n');
    } else if (tab === 'ust') {
      name = 'CMR_Umsatzsteuer.csv';
      csv = ['Monat', 'Netto', 'MwSt.', 'Brutto'].join(sep) + '\n';
      csv += ustRows.map((r) => [r.month, r.net.toFixed(2), r.tax.toFixed(2), r.gross.toFixed(2)].map(esc).join(sep)).join('\n');
    } else {
      name = tab === 'offen' ? 'CMR_Offene_Posten.csv' : 'CMR_Rechnungen.csv';
      csv = ['Nummer', 'Kunde', 'Datum', 'Faellig', 'Status', 'Brutto', 'Bezahlt', 'Offen', 'Waehrung'].join(sep) + '\n';
      csv += (tab === 'offen' ? open_ : invoices).map((d) => [
        d.doc_number ?? '', d.customer_name ?? '', d.doc_date, d.due_date ?? '', d.status,
        Number(d.gross_total).toFixed(2), Number(d.paid_total).toFixed(2),
        (Number(d.gross_total) - Number(d.paid_total)).toFixed(2), d.currency || cur,
      ].map(esc).join(sep)).join('\n');
    }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  /** DATEV-ähnlicher Buchungsstapel-Export (CSV, semikolongetrennt). */
  const exportDatev = () => {
    const sep = ';';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'Belegdatum', 'Belegfeld 1', 'Buchungstext'];
    const rows = invoices.map((d) => {
      const isCredit = (d as any).doc_type === 'gutschrift';
      const amount = Math.abs(Number(d.gross_total || 0));
      return [
        amount.toFixed(2).replace('.', ','),
        isCredit ? 'H' : 'S',
        d.currency || cur,
        '1400',
        '8400',
        String(d.doc_date).slice(8, 10) + String(d.doc_date).slice(5, 7),
        d.doc_number ?? '',
        `${isCredit ? 'Gutschrift' : 'Rechnung'} ${d.customer_name ?? ''}`.trim(),
      ];
    });
    const csv = [head, ...rows].map((r) => r.map(esc).join(sep)).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CMR_DATEV_Buchungsstapel_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /** Jahresabschluss-Paket als PDF (Umsätze, Steuern, offene Posten). */
  const exportYearPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const year = new Date().getFullYear();
    const inYear = invoices.filter((d) => String(d.doc_date).startsWith(String(year)));
    const sign = (d: any) => (d.doc_type === 'gutschrift' ? -1 : 1);
    const net = inYear.reduce((s, d: any) => s + sign(d) * Number(d.net_total || 0), 0);
    const tax = inYear.reduce((s, d: any) => s + sign(d) * Number(d.tax_total || 0), 0);
    const gross = inYear.reduce((s, d: any) => s + sign(d) * Number(d.gross_total || 0), 0);
    const paid = inYear.reduce((s, d) => s + Number(d.paid_total || 0), 0);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 56;
    doc.setFontSize(16);
    doc.text(`${settings?.company_name ?? 'CMR'} – Jahresabschluss ${year}`, 40, y);
    y += 24;
    doc.setFontSize(10);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 40, y);
    y += 28;

    doc.setFontSize(12);
    doc.text('Übersicht', 40, y); y += 18;
    doc.setFontSize(10);
    const rows: [string, string][] = [
      ['Anzahl Belege', String(inYear.length)],
      ['Netto-Umsatz', cmrMoney(net, cur)],
      ['Umsatzsteuer', cmrMoney(tax, cur)],
      ['Brutto-Umsatz', cmrMoney(gross, cur)],
      ['Zahlungseingänge', cmrMoney(paid, cur)],
      ['Offene Posten', cmrMoney(sums.open, cur)],
    ];
    rows.forEach(([k, v]) => { doc.text(k, 40, y); doc.text(v, 400, y, { align: 'right' }); y += 16; });

    y += 18;
    doc.setFontSize(12); doc.text('Monatsauswertung', 40, y); y += 18;
    doc.setFontSize(9);
    doc.text('Monat', 40, y); doc.text('Netto', 250, y, { align: 'right' });
    doc.text('MwSt.', 330, y, { align: 'right' }); doc.text('Brutto', 420, y, { align: 'right' });
    y += 14;
    ustRows.filter((r) => r.month.startsWith(String(year))).forEach((r) => {
      if (y > 780) { doc.addPage(); y = 56; }
      doc.text(r.month, 40, y);
      doc.text(cmrMoney(r.net, cur), 250, y, { align: 'right' });
      doc.text(cmrMoney(r.tax, cur), 330, y, { align: 'right' });
      doc.text(cmrMoney(r.gross, cur), 420, y, { align: 'right' });
      y += 14;
    });

    y += 18;
    if (y > 720) { doc.addPage(); y = 56; }
    doc.setFontSize(12); doc.text('Offene Posten', 40, y); y += 18;
    doc.setFontSize(9);
    open_.forEach((d) => {
      if (y > 780) { doc.addPage(); y = 56; }
      doc.text(`${d.doc_number ?? '—'} · ${(d.customer_name ?? '').slice(0, 40)}`, 40, y);
      doc.text(cmrMoney(Number(d.gross_total) - Number(d.paid_total), cur), 420, y, { align: 'right' });
      y += 13;
    });

    doc.save(`CMR_Jahresabschluss_${year}.pdf`);
  };

  /** Bankdatei importieren (CSV, CAMT.053 XML oder MT940) und Zahlungen automatisch zuordnen. */
  const [importRows, setImportRows] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);

  const matchDoc = (ref: string) =>
    invoices.find((d) => d.doc_number && ref.toUpperCase().includes(String(d.doc_number).toUpperCase()));

  const buildRow = (paid_on: string, amount: number, reference: string) => {
    const match = matchDoc(reference);
    return {
      paid_on, amount, reference,
      document_id: match?.id ?? null,
      doc_number: match?.doc_number ?? null,
      customer_id: match?.customer_id ?? null,
    };
  };

  /** CAMT.053 (ISO 20022 XML) parsen – nur Gutschriften (CRDT). */
  const parseCamt = (text: string) => {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    const entries = Array.from(xml.getElementsByTagName('*')).filter((n) => n.localName === 'Ntry');
    const rows: any[] = [];
    entries.forEach((e) => {
      const get = (name: string, root: Element = e) =>
        Array.from(root.getElementsByTagName('*')).find((n) => n.localName === name)?.textContent?.trim() ?? '';
      if (get('CdtDbtInd') !== 'CRDT') return;
      const amount = Number(get('Amt')) || 0;
      const date = get('BookgDt') ? get('Dt') : '';
      const ref = [get('Ustrd'), get('AddtlNtryInf'), get('Nm')].filter(Boolean).join(' ');
      if (amount > 0) rows.push(buildRow((date || new Date().toISOString()).slice(0, 10), amount, ref));
    });
    return rows;
  };

  /** MT940 (SWIFT) parsen – nur Habenbuchungen (:61: … C …). */
  const parseMt940 = (text: string) => {
    const rows: any[] = [];
    const lines = text.split(/\r?\n/);
    let cur_: any = null;
    lines.forEach((l) => {
      if (l.startsWith(':61:')) {
        if (cur_) rows.push(buildRow(cur_.date, cur_.amount, cur_.ref.trim()));
        const m = l.slice(4).match(/^(\d{6})(\d{4})?(C|D)([A-Z]?)([\d,.]+)/);
        cur_ = null;
        if (m && m[3] === 'C') {
          const yy = m[1].slice(0, 2), mm = m[1].slice(2, 4), dd = m[1].slice(4, 6);
          cur_ = { date: `20${yy}-${mm}-${dd}`, amount: Number(m[5].replace(',', '.')) || 0, ref: '' };
        }
      } else if (cur_ && (l.startsWith(':86:') || (!l.startsWith(':') && l.trim()))) {
        cur_.ref += ' ' + l.replace(/^:86:/, '');
      }
    });
    if (cur_) rows.push(buildRow(cur_.date, cur_.amount, cur_.ref.trim()));
    return rows.filter((r) => r.amount > 0);
  };

  const parseBankCsv = async (file: File) => {
    const text = await file.text();
    const name = file.name.toLowerCase();

    if (name.endsWith('.xml') || text.trimStart().startsWith('<?xml')) {
      const rows = parseCamt(text);
      if (!rows.length) { toast.error('Keine Gutschriften in der CAMT-Datei gefunden.'); return; }
      setImportRows(rows); return;
    }
    if (name.endsWith('.sta') || name.endsWith('.mt940') || name.endsWith('.940') || text.includes(':61:')) {
      const rows = parseMt940(text);
      if (!rows.length) { toast.error('Keine Habenbuchungen in der MT940-Datei gefunden.'); return; }
      setImportRows(rows); return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) { toast.error('Datei ist leer.'); return; }
    const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
    const split = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const header = split(lines[0]).map((h) => h.toLowerCase());
    const idx = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const iDate = idx('datum', 'date', 'buchung');
    const iAmount = idx('betrag', 'amount', 'umsatz');
    const iText = idx('verwendung', 'zweck', 'referenz', 'reference', 'text');

    const toNumber = (s: string) => Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
    const toDate = (s: string) => {
      const t = String(s).trim();
      const de = t.match(/^(\d{2})[.\/](\d{2})[.\/](\d{2,4})$/);
      if (de) return `${de[3].length === 2 ? '20' + de[3] : de[3]}-${de[2]}-${de[1]}`;
      return t.slice(0, 10);
    };

    const parsed = lines.slice(1).map((l) => {
      const c = split(l);
      const amount = iAmount >= 0 ? toNumber(c[iAmount]) : 0;
      const ref = iText >= 0 ? c[iText] ?? '' : c.join(' ');
      return buildRow(iDate >= 0 ? toDate(c[iDate]) : new Date().toISOString().slice(0, 10), amount, ref);
    }).filter((r) => r.amount > 0);

    if (!parsed.length) { toast.error('Keine Zahlungseingänge erkannt.'); return; }
    setImportRows(parsed);
  };


  const commitImport = async () => {
    if (!tenantId || !importRows) return;
    const rows = importRows.filter((r) => r.document_id);
    if (!rows.length) { toast.error('Keine zugeordneten Zahlungen zum Buchen.'); return; }
    setImporting(true);
    const { error } = await supabase.from('cmr_payments' as any).insert(
      rows.map((r) => ({
        tenant_id: tenantId,
        document_id: r.document_id,
        customer_id: r.customer_id,
        paid_on: r.paid_on,
        amount: Number(r.amount) || 0,
        currency: cur,
        method: 'Bankimport',
        reference: r.reference?.slice(0, 200) ?? null,
      })),
    );
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} Zahlung(en) gebucht`);
    setImportRows(null);
    load();
  };


  const startPayment = (d: Doc) => {
    setForm({
      document_id: d.id, customer_id: d.customer_id, label: `${d.doc_number} · ${d.customer_name ?? ''}`,
      amount: Math.max(0, Number(d.gross_total) - Number(d.paid_total)),
      discount_amount: 0,
      openAmount: Math.max(0, Number(d.gross_total) - Number(d.paid_total)),
      paid_on: new Date().toISOString().slice(0, 10), method: 'Überweisung', reference: '',
    });
    setOpen(true);
  };

  const savePayment = async () => {
    if (!tenantId || !form) return;
    setSaving(true);
    const { error } = await supabase.from('cmr_payments' as any).insert({
      tenant_id: tenantId,
      document_id: form.document_id,
      customer_id: form.customer_id,
      paid_on: form.paid_on,
      amount: Number(form.amount) || 0,
      discount_amount: Number(form.discount_amount) || 0,
      currency: cur,
      method: form.method || null,
      reference: form.reference || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Zahlungseingang erfasst');
    setOpen(false);
    load();
  };

  /** Offener (noch nicht verrechneter) Betrag einer Gutschrift. */
  const creditOpen = (d: Doc) => Math.max(0, Number(d.gross_total || 0) - Number(d.paid_total || 0));

  const startCredit = (d: Doc) => {
    const targets = invoices.filter(
      (i) => (i as any).doc_type !== 'gutschrift'
        && Number(i.gross_total) - Number(i.paid_total) > 0.01
        && (!d.customer_id || !i.customer_id || i.customer_id === d.customer_id),
    );
    setCredit({
      doc: d,
      targets,
      target_id: targets[0]?.id ?? '',
      amount: Math.min(creditOpen(d), targets[0] ? Number(targets[0].gross_total) - Number(targets[0].paid_total) : creditOpen(d)),
    });
  };

  /** Verrechnet eine Gutschrift gegen eine offene Rechnung (beidseitige Buchung). */
  const saveCredit = async () => {
    if (!tenantId || !credit) return;
    const target = credit.targets.find((t: Doc) => t.id === credit.target_id);
    if (!target) { toast.error('Bitte eine offene Rechnung wählen'); return; }
    const amount = Math.round((Number(credit.amount) || 0) * 100) / 100;
    if (amount <= 0) { toast.error('Betrag muss größer als 0 sein'); return; }
    if (amount > creditOpen(credit.doc) + 0.01) { toast.error('Betrag übersteigt die Gutschrift'); return; }
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('cmr_payments' as any).insert([
      {
        tenant_id: tenantId, document_id: target.id, customer_id: target.customer_id,
        paid_on: today, amount, currency: cur, method: 'Gutschrift',
        reference: `Gutschrift ${credit.doc.doc_number ?? ''}`.trim(),
        credit_document_id: credit.doc.id,
      },
      {
        tenant_id: tenantId, document_id: credit.doc.id, customer_id: credit.doc.customer_id,
        paid_on: today, amount, currency: cur, method: 'Verrechnung',
        reference: `Verrechnet mit ${target.doc_number ?? ''}`.trim(),
        credit_document_id: credit.doc.id,
      },
    ]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Gutschrift verrechnet');
    setCredit(null);
    load();
  };

  /** Jahresabschluss-Paket als ZIP: Belege, Zahlungen, USt-Auswertung, Summen-/Saldenliste und DATEV-Stapel. */
  const exportYearZip = async () => {
    const { default: JSZip } = await import('jszip');
    const year = new Date().getFullYear();
    const sep = ';';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const toCsv = (head: string[], rows: unknown[][]) =>
      '\ufeff' + [head, ...rows].map((r) => r.map(esc).join(sep)).join('\r\n');

    const inYear = invoices.filter((d) => String(d.doc_date).startsWith(String(year)));
    const paysYear = payments.filter((p) => String(p.paid_on).startsWith(String(year)));

    const belege = toCsv(
      ['Nummer', 'Belegart', 'Kunde', 'Datum', 'Faellig', 'Status', 'Netto', 'MwSt', 'Brutto', 'Bezahlt', 'Offen', 'Waehrung'],
      inYear.map((d: any) => [
        d.doc_number ?? '', d.doc_type, d.customer_name ?? '', d.doc_date, d.due_date ?? '', d.status,
        Number(d.net_total || 0).toFixed(2), Number(d.tax_total || 0).toFixed(2),
        Number(d.gross_total || 0).toFixed(2), Number(d.paid_total || 0).toFixed(2),
        (Number(d.gross_total || 0) - Number(d.paid_total || 0)).toFixed(2), d.currency || cur,
      ]),
    );
    const zahlungen = toCsv(
      ['Datum', 'Beleg', 'Betrag', 'Zahlungsart', 'Referenz'],
      paysYear.map((p) => [
        p.paid_on, invoices.find((i) => i.id === p.document_id)?.doc_number ?? '',
        Number(p.amount).toFixed(2), p.method ?? '', p.reference ?? '',
      ]),
    );
    const ust = toCsv(
      ['Monat', 'Netto', 'MwSt', 'Brutto'],
      ustRows.filter((r) => r.month.startsWith(String(year))).map((r) => [r.month, r.net.toFixed(2), r.tax.toFixed(2), r.gross.toFixed(2)]),
    );
    const sign = (d: any) => (d.doc_type === 'gutschrift' ? -1 : 1);
    const netSum = inYear.reduce((s, d: any) => s + sign(d) * Number(d.net_total || 0), 0);
    const taxSum = inYear.reduce((s, d: any) => s + sign(d) * Number(d.tax_total || 0), 0);
    const grossSum = inYear.reduce((s, d: any) => s + sign(d) * Number(d.gross_total || 0), 0);
    const paidSum = paysYear.reduce((s, p) => s + Number(p.amount || 0), 0);
    const susa = toCsv(
      ['Konto', 'Bezeichnung', 'Soll', 'Haben', 'Saldo'],
      [
        ['8400', 'Umsatzerlöse', '0.00', netSum.toFixed(2), (-netSum).toFixed(2)],
        ['1776', 'Umsatzsteuer', '0.00', taxSum.toFixed(2), (-taxSum).toFixed(2)],
        ['1400', 'Forderungen a. L. u. L.', grossSum.toFixed(2), paidSum.toFixed(2), (grossSum - paidSum).toFixed(2)],
        ['1200', 'Bank', paidSum.toFixed(2), '0.00', paidSum.toFixed(2)],
      ],
    );
    const datev = toCsv(
      ['Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'Belegdatum', 'Belegfeld 1', 'Buchungstext'],
      inYear.map((d: any) => [
        Math.abs(Number(d.gross_total || 0)).toFixed(2).replace('.', ','),
        d.doc_type === 'gutschrift' ? 'H' : 'S', d.currency || cur, '1400', '8400',
        String(d.doc_date).slice(8, 10) + String(d.doc_date).slice(5, 7),
        d.doc_number ?? '', `${d.doc_type === 'gutschrift' ? 'Gutschrift' : 'Rechnung'} ${d.customer_name ?? ''}`.trim(),
      ]),
    );

    const zip = new JSZip();
    const folder = zip.folder(`Jahresabschluss_${year}`)!;
    folder.file('01_Belege.csv', belege);
    folder.file('02_Zahlungen.csv', zahlungen);
    folder.file('03_Umsatzsteuer.csv', ust);
    folder.file('04_Summen_und_Salden.csv', susa);
    folder.file('05_DATEV_Buchungsstapel.csv', datev);
    folder.file('00_Info.txt',
      `${settings?.company_name ?? 'CMR'} – Jahresabschluss ${year}\n`
      + `Erstellt am ${new Date().toLocaleString('de-DE')}\n\n`
      + `Belege: ${inYear.length}\nNetto: ${netSum.toFixed(2)} ${cur}\nUmsatzsteuer: ${taxSum.toFixed(2)} ${cur}\n`
      + `Brutto: ${grossSum.toFixed(2)} ${cur}\nZahlungseingänge: ${paidSum.toFixed(2)} ${cur}\n`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CMR_Jahresabschluss_${year}.zip`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Jahrespaket ${year} erstellt`);
  };


  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const list = tab === 'offen' ? open_ : invoices;

  return (
    <div className="space-y-4">
      {!canWrite && <CmrReadOnlyBanner />}
      <PageHeader title="CMR Buchhaltung" subtitle="Getrennte Buchhaltung der Cloud Marketing Research – ohne Vermischung mit Alix Lasers." />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Fakturiert</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.invoiced, cur)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Bezahlt</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.paid, cur)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Offene Posten</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.open, cur)}</div></Card>
      </div>

      <div className="flex gap-2">
        {(['offen', 'alle', 'zahlungen', 'ust'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t === 'offen' ? 'Offene Posten' : t === 'alle' ? 'Alle Rechnungen' : t === 'zahlungen' ? 'Zahlungseingänge' : 'Umsatzsteuer'}
          </Button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv,.xml,text/xml,.sta,.mt940,.940"
              className="hidden"
              disabled={!canWrite}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parseBankCsv(f); e.currentTarget.value = ''; }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm hover:bg-muted">
              <Upload className="w-3.5 h-3.5 mr-1" /> Bankimport (CSV/CAMT/MT940)
            </span>

          </label>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV Export
          </Button>
          <Button size="sm" variant="outline" onClick={exportDatev}>
            <Download className="w-3.5 h-3.5 mr-1" /> DATEV
          </Button>
          <Button size="sm" variant="outline" onClick={exportYearPdf}>
            <FileDown className="w-3.5 h-3.5 mr-1" /> Jahresabschluss
          </Button>
        </div>
      </div>


      {tab === 'ust' ? (
        <Card className="divide-y">
          <div className="p-3 grid grid-cols-4 text-[11px] uppercase tracking-wide text-muted-foreground">
            <div>Monat</div><div className="text-right">Netto</div><div className="text-right">MwSt.</div><div className="text-right">Brutto</div>
          </div>
          {ustRows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Belege im Zeitraum.</div>}
          {ustRows.map((r) => (
            <div key={r.month} className="p-3 grid grid-cols-4 text-sm">
              <div>{r.month}</div>
              <div className="text-right">{cmrMoney(r.net, cur)}</div>
              <div className="text-right">{cmrMoney(r.tax, cur)}</div>
              <div className="text-right font-semibold">{cmrMoney(r.gross, cur)}</div>
            </div>
          ))}
        </Card>
      ) : tab !== 'zahlungen' ? (
        <>
        {tab === 'offen' && (
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Fälligkeitsstruktur</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {aging.map((b) => (
                <div key={b.label} className="rounded-md border border-border/60 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{b.label}</div>
                  <div className="mt-1 font-semibold tabular-nums">{cmrMoney(b.amount, cur)}</div>
                  <div className="text-[11px] text-muted-foreground">{b.count} Beleg(e)</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="divide-y">
          {list.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Banknote className="w-5 h-5" /> Keine Belege vorhanden.
            </div>
          )}
          {list.map((d) => (
            <div key={d.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{d.doc_number ?? '—'} · {d.customer_name ?? 'Ohne Kunde'}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(d.doc_date).toLocaleDateString('de-DE')}
                  {d.due_date ? ` · fällig ${new Date(d.due_date).toLocaleDateString('de-DE')}` : ''} · {d.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{cmrMoney(d.gross_total, d.currency || cur)}</div>
                <div className="text-xs text-muted-foreground">offen {cmrMoney(Number(d.gross_total) - Number(d.paid_total), cur)}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => startPayment(d)} disabled={!canWrite}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Zahlung
              </Button>
            </div>
          ))}
        </Card>
        </>
      ) : (

        <Card className="divide-y">
          {payments.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Zahlungseingänge erfasst.</div>}
          {payments.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm">{invoices.find((i) => i.id === p.document_id)?.doc_number ?? 'Ohne Beleg'}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.paid_on).toLocaleDateString('de-DE')}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''}
                </div>
              </div>
              <div className="text-sm font-semibold">{cmrMoney(p.amount, cur)}</div>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Zahlungseingang erfassen</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{form.label}</div>
              <div><Label>Betrag ({cur})</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div>
                <Label>Skonto ({cur})</Label>
                <Input type="number" step="0.01" value={form.discount_amount ?? 0} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Restforderung nach Buchung: {cmrMoney(Math.max(0, Number(form.openAmount || 0) - (Number(form.amount) || 0) - (Number(form.discount_amount) || 0)), cur)}
                </p>
              </div>

              <div><Label>Datum</Label><Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} /></div>
              <div><Label>Zahlungsart</Label><Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></div>
              <div><Label>Referenz</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={savePayment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Buchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importRows} onOpenChange={(o) => !o && setImportRows(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bankimport – Vorschau</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {importRows?.filter((r) => r.document_id).length ?? 0} von {importRows?.length ?? 0} Buchungen wurden anhand der Belegnummer im Verwendungszweck zugeordnet. Nur zugeordnete Zeilen werden gebucht.
          </p>
          <div className="max-h-80 overflow-y-auto divide-y">
            {(importRows ?? []).map((r, i) => (
              <div key={i} className="py-2 text-sm flex items-center gap-3">
                <span className="w-24 text-xs text-muted-foreground">{r.paid_on}</span>
                <span className="flex-1 truncate">{r.reference}</span>
                <span className="w-28 text-right tabular-nums">{cmrMoney(r.amount, cur)}</span>
                <span className={`w-32 text-right text-xs ${r.doc_number ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  {r.doc_number ?? 'ohne Zuordnung'}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportRows(null)}>Abbrechen</Button>
            <Button onClick={commitImport} disabled={importing}>
              {importing && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Zahlungen buchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
