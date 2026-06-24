import { useEffect, useMemo, useState } from 'react';
import { Wallet, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { getTransactions } from '@/lib/finance/api';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import templateAsset from '@/assets/az-rechnung-template.jpg.asset.json';
import logoAsset from '@/assets/alix-logo-gold-pdf.png.asset.json';

const fmtPdfMoney = (n: number, currency = 'EUR') =>
  (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency });

const fmtPdfDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('de-DE') : '—';

function addrLines(a: any): string[] {
  if (!a || typeof a !== 'object') return [];
  const zipCity = [a.zip || a.postal_code || '', a.city || ''].filter(Boolean).join(' ');
  return [a.address || a.street, a.street2 || a.address2, zipCity, a.country].filter(Boolean).map(String);
}

let templateCache: string | null = null;
let logoCache: string | null = null;

async function loadDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function buildDepositPdf(row: any, order: any, customer: any) {
  const currency = order?.currency || 'EUR';
  const orderNo = String(order?.order_number || '').trim();
  const invoiceNumber = String(row?.reference || `AZ-${orderNo || 'ANZAHLUNG'}`).trim();
  const grossDeposit = Number(row?.amount || order?.deposit_amount || 0);
  const taxPercentage = 19;
  const netDeposit = grossDeposit / (1 + taxPercentage / 100);
  const taxAmount = grossDeposit - netDeposit;
  const dueFromNotes = String(row?.notes || '').match(/Fällig\s+([^\.]+)/i)?.[1]?.trim();

  const doc = createPDF({ unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const LEFT = 30;
  const RIGHT = 195;
  const TOP_CONTENT = 55;
  const CONTENT_W = RIGHT - LEFT;

  templateCache ||= await loadDataUrl(templateAsset.url);
  logoCache ||= await loadDataUrl(logoAsset.url);
  const logoW = 54;
  const logoH = logoW / (1920 / 360);
  doc.addImage(templateCache, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
  doc.addImage(logoCache, 'PNG', RIGHT - logoW, 12, logoW, logoH, undefined, 'FAST');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 60, 110);
  doc.text('Anzahlungsrechnung', LEFT, TOP_CONTENT);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const meta: Array<[string, string]> = [
    ['Rechnungsnr.', invoiceNumber],
    ['Rechnungsdatum', fmtPdfDate(row?.booking_date)],
    ['Fällig am', dueFromNotes || '—'],
    ['Auftragsnr.', orderNo || '—'],
    ['Kundennr.', String(customer?.external_customer_id || customer?.id?.slice(0, 8) || '—')],
  ];
  let metaY = TOP_CONTENT;
  for (const [label, value] of meta) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 130, metaY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 162, metaY);
    metaY += 5;
  }

  let y = TOP_CONTENT + 17;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 60, 110);
  doc.text('Rechnungsadresse', LEFT, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  if (customer?.company_name) { doc.text(String(customer.company_name), LEFT, y); y += 4.4; }
  if (customer?.contact_name && customer.contact_name !== customer.company_name) { doc.text(String(customer.contact_name), LEFT, y); y += 4.4; }
  for (const line of addrLines(customer?.billing_address || customer?.shipping_address)) { doc.text(line, LEFT, y); y += 4.4; }
  if (customer?.email) { doc.text(String(customer.email), LEFT, y); y += 4.4; }

  const intro = 'Vielen Dank für Ihre Bestellung. Vereinbarungsgemäß stellen wir Ihnen hiermit die Anzahlung in Rechnung.';
  y += 8;
  doc.setTextColor(60, 60, 60);
  const introLines = doc.splitTextToSize(intro, CONTENT_W);
  doc.text(introLines, LEFT, y);
  y += introLines.length * 4.4 + 4;

  autoTable(doc, {
    startY: y,
    margin: { left: LEFT, right: PAGE_W - RIGHT },
    head: [['Pos', 'Beschreibung', 'Menge', 'Einzelpreis netto', 'MwSt', 'Summe netto']],
    body: [[1, `Anzahlung gemäß Auftrag ${orderNo || invoiceNumber}`, 1, fmtPdfMoney(netDeposit, currency), `${taxPercentage}%`, fmtPdfMoney(netDeposit, currency)]],
    styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [183, 217, 255], textColor: [20, 60, 110] },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 16 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 16 }, 5: { halign: 'right', cellWidth: 30 } },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text('Netto:', 110, y);
  doc.text(fmtPdfMoney(netDeposit, currency), RIGHT, y, { align: 'right' });
  doc.text(`MwSt (${taxPercentage}%):`, 110, y + 5);
  doc.text(fmtPdfMoney(taxAmount, currency), RIGHT, y + 5, { align: 'right' });
  doc.setDrawColor(20, 60, 110);
  doc.line(110, y + 8, RIGHT, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 60, 110);
  doc.text('Rechnungsbetrag (brutto):', 110, y + 14);
  doc.text(fmtPdfMoney(grossDeposit, currency), RIGHT, y + 14, { align: 'right' });

  y += 27;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  const hint = `Dies ist eine Anzahlungsrechnung zum Auftrag ${orderNo || '—'}. Der Betrag von ${fmtPdfMoney(grossDeposit, currency)} (brutto) wird mit der Schlussrechnung verrechnet. Bitte geben Sie bei der Überweisung die Rechnungsnummer ${invoiceNumber} an.`;
  const hintLines = doc.splitTextToSize(hint, CONTENT_W);
  doc.text(hintLines, LEFT, y);
  y += hintLines.length * 4.6 + 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 60, 110);
  doc.text('Bankverbindung', LEFT, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Kontoinhaber: Alix Lasers GmbH', LEFT, y); y += 4.6;
  doc.text('Bank: Deutsche Bank', LEFT, y); y += 4.6;
  doc.text('IBAN: DE07 1007 0100 0142 6600 00', LEFT, y); y += 4.6;
  doc.text('SWIFT/BIC: DEUTDEBB101', LEFT, y);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Anzahlungsrechnung ${invoiceNumber}  ·  Seite 1 von 1`, RIGHT, PAGE_H - 4, { align: 'right' });

  const blob: Blob = doc.output('blob');
  const safeInvoice = invoiceNumber.replace(/[^\w.-]+/g, '_');
  return { blob, fileName: `Anzahlungsrechnung_${safeInvoice}.pdf` };
}

export default function FinanceAnzahlungen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [openingRef, setOpeningRef] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const [txs, docsRes] = await Promise.all([
          getTransactions({ transaction_type: 'Anzahlung' }),
          supabase
            .from('order_documents')
            .select('id, order_id, file_name, document_type, created_at, download_token, file_path, orders:order_id(order_number, deposit_amount, currency, total_amount)')
            .or('document_type.ilike.%anzahlung%,file_name.ilike.%anzahlung%')
            .order('created_at', { ascending: false }),
        ]);
        const txList = txs || [];
        const seenOrderIds = new Set(txList.map((t: any) => t.order_id).filter(Boolean));
        const seenFilePaths = new Set(txList.map((t: any) => t.file_path).filter(Boolean));
        const docRows = (docsRes.data || [])
          .filter((d: any) => !seenFilePaths.has(d.file_path))
          .filter((d: any, idx: number, arr: any[]) =>
            arr.findIndex((x: any) => x.file_path === d.file_path) === idx
          )
          .map((d: any) => {
            const az = d.file_name?.match(/AZ[-_][A-Z0-9-]+/i)?.[0] ?? d.file_name?.replace(/\.pdf$/i, '');
            return {
              id: `doc-${d.id}`,
              order_id: d.order_id,
              reference: az,
              booking_date: d.created_at ? String(d.created_at).slice(0, 10) : null,
              amount: Number(d.orders?.deposit_amount || 0),
              notes: `Dokument · Auftrag ${d.orders?.order_number || '—'}${seenOrderIds.has(d.order_id) ? ' (bereits gebucht)' : ''}`,
              __doc: d,
              file_path: d.file_path,
              file_name: d.file_name,
              download_token: d.download_token,
            };
          });
        const merged = [...txList, ...docRows].sort((a: any, b: any) =>
          String(b.booking_date || '').localeCompare(String(a.booking_date || ''))
        );
        setRows(merged);
      } catch (e) {
        console.error('[Anzahlungen] load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const createMissingPdf = async (row: any) => {
    const orderId: string | null = row?.order_id ?? null;
    let order: any = null;
    if (orderId) {
      const { data, error: orderErr } = await supabase
        .from('orders')
        .select('id, order_number, customer_id, currency, deposit_amount, total_amount')
        .eq('id', orderId)
        .maybeSingle();
      if (orderErr) throw orderErr;
      order = data;
    }

    if (!order) {
      const orderNo = String(row?.reference || row?.notes || '').match(/SO-\d+|\d{4}-\d{5}|\d{6,}/)?.[0] ?? '';
      order = { id: orderId, order_number: orderNo, customer_id: null, currency: 'EUR', deposit_amount: row?.amount, total_amount: row?.amount };
    }

    let customer: any = null;
    if ((order as any).customer_id) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, email, external_customer_id, billing_address, shipping_address')
        .eq('id', (order as any).customer_id)
        .maybeSingle();
      if (error) throw error;
      customer = data;
    }

    const { blob, fileName } = await buildDepositPdf(row, order, customer);
    if (!orderId) {
      return { direct_url: URL.createObjectURL(blob), file_name: fileName };
    }

    try {
      const safeRef = String(row?.reference || 'AZ').replace(/[^\w.-]+/g, '_');
      const filePath = `${orderId}/anzahlung/${Date.now()}_${safeRef}.pdf`;
      const upload = await supabase.storage
        .from('order-invoices')
        .upload(filePath, blob, { contentType: 'application/pdf', upsert: true });
      if (upload.error) throw upload.error;

      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
      const { data: userData } = await supabase.auth.getUser();
      const { data: inserted, error: docErr } = await supabase
        .from('order_documents')
        .insert({
          order_id: orderId,
          file_name: fileName,
          file_path: filePath,
          file_type: 'application/pdf',
          document_type: 'Anzahlungsrechnung',
          uploaded_by: userData.user?.id ?? null,
          download_token: token,
        } as any)
        .select('download_token, file_path, file_name, created_at')
        .single();
      if (docErr) throw docErr;
      return inserted;
    } catch (persistErr) {
      console.warn('[Anzahlungen] PDF konnte nicht gespeichert werden, öffne direkt:', persistErr);
      return { direct_url: URL.createObjectURL(blob), file_name: fileName };
    }
  };

  const openPdf = async (row: any) => {
    const reference: string | null = row?.reference ?? null;
    const orderId: string | null = row?.order_id ?? null;
    if (!reference && !orderId) { toast({ title: 'Keine Referenz', variant: 'destructive' }); return; }
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      toast({ title: 'Popup blockiert', description: 'Bitte Popups für Alix Work erlauben und erneut öffnen.', variant: 'destructive' });
      return;
    }
    try { popup.opener = null; } catch { /* ignore */ }
    setOpeningRef(reference || orderId);
    try {
      let doc: any = row?.__doc
        ? { download_token: row.download_token, file_path: row.file_path, file_name: row.file_name }
        : null;
      // 1) Lookup per order_id (zuverlässigster Match, da AZ-Nummer ≠ Referenz)
      if (!doc && orderId) {
        const { data } = await supabase
          .from('order_documents')
          .select('download_token, file_path, file_name, created_at')
          .eq('document_type', 'Anzahlungsrechnung')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1);
        doc = data?.[0] ?? null;
      }
      // 2) Fallback: Suche per Referenz im Dateinamen
      if (!doc && reference) {
        const { data } = await supabase
          .from('order_documents')
          .select('download_token, file_path, file_name, created_at')
          .eq('document_type', 'Anzahlungsrechnung')
          .ilike('file_name', `%${reference}%`)
          .order('created_at', { ascending: false })
          .limit(1);
        doc = data?.[0] ?? null;
      }
      if (!doc) {
        doc = await createMissingPdf(row);
      }
      let url: string | null = null;
      if (doc?.direct_url) {
        url = doc.direct_url;
      } else if (doc?.download_token) {
        url = `/d/${doc.download_token}`;
      } else if (doc?.file_path) {
        const { data: signed, error: sErr } = await supabase.storage
          .from('order-invoices')
          .createSignedUrl(doc.file_path, 300);
        if (sErr) throw sErr;
        url = signed.signedUrl;
      }
      if (url) {
        popup.location.href = url;
        return;
      }
      popup.close();
      toast({ title: 'Keine PDF gefunden', description: `Für ${reference || orderId} liegt kein Dokument vor.`, variant: 'destructive' });
    } catch (e: any) {
      popup.close();
      toast({ title: 'Fehler', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setOpeningRef(null);
    }
  };
  const filtered = useMemo(() => rows.filter((r) => matchesQuery({ ...r, total: r.amount, balance: r.amount }, search)), [rows, search]);
  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);
  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={Wallet}
        title="Anzahlungen"
        subtitle={`${rows.length} Anzahlungen`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length}`} pulse={!loading} />}
      />
      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={filtered.length}
        visible={visible.length}
      />
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {loading ? (
          <div className="p-6"><SkeletonTable rows={8} cols={4} /></div>
        ) : visible.length === 0 ? (
          <div className="p-8"><EmptyState title="Keine Anzahlungen" description="Es wurden noch keine Anzahlungen erfasst." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Datum</th><th className="text-left px-4 py-3">Referenz</th><th className="text-right px-4 py-3">Betrag</th><th className="text-left px-4 py-3">Notiz</th><th className="text-right px-4 py-3">PDF</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(r => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-2">{r.booking_date ? new Date(r.booking_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}</td>
                  <td className="px-4 py-2">{r.reference || '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(r.amount)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.notes || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPdf(r)}
                      disabled={openingRef === (r.reference || r.order_id)}
                    >
                      {openingRef === r.reference ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />}
                      PDF Ansicht
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
