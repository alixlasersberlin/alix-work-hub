import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Receipt, Search, Upload, Download, Building2, Calendar, CheckCircle2, Trash2, BadgeEuro } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Lang = 'de' | 'en' | 'zh';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'zh', label: 'ZH', flag: '🇨🇳' },
];

const T: Record<Lang, Record<string, string>> = {
  de: {
    title: 'Factory Invoice',
    subtitle: 'Lieferanten-Rechnungen zu freigegebenen Bestellungen hochladen',
    orders: 'Bestellungen',
    noPermission: 'Sie haben keine Berechtigung, Factory-Invoices hochzuladen. Nur die Rollen',
    and: 'und',
    mayUpload: 'dürfen Uploads durchführen.',
    searchPh: 'Suche: Lieferant, Auftragsnr., Modell, Farbe…',
    empty: 'Keine Bestellungen vorhanden.',
    reclamation: 'Reklamation',
    invoice: 'Invoice',
    upload: 'Upload Invoice',
    replace: 'Ersetzen',
    pdf: 'PDF',
    selectPdf: 'Bitte PDF-Datei wählen',
    uploaded: 'Invoice hochgeladen',
    uploadFailed: 'Upload fehlgeschlagen',
    downloadFailed: 'Download fehlgeschlagen',
    delete: 'Löschen',
    deleteTitle: 'Invoice löschen?',
    deleteDesc: 'Die hochgeladene Factory-Invoice-PDF wird unwiderruflich entfernt.',
    cancel: 'Abbrechen',
    confirmDelete: 'Endgültig löschen',
    deleted: 'Invoice gelöscht',
    deleteFailed: 'Löschen fehlgeschlagen',
    paymentOk: 'PAYMENT OK',
    paymentReceived: 'Bezahlt',
    paymentSet: 'Zahlung als erhalten markiert',
    paymentReset: 'Zahlung zurückgesetzt',
    paymentFailed: 'Aktualisierung fehlgeschlagen',
  },
  en: {
    title: 'Factory Invoice',
    subtitle: 'Upload supplier invoices for approved orders',
    orders: 'Orders',
    noPermission: 'You do not have permission to upload factory invoices. Only the roles',
    and: 'and',
    mayUpload: 'may perform uploads.',
    searchPh: 'Search: supplier, order no., model, color…',
    empty: 'No orders available.',
    reclamation: 'Claim',
    invoice: 'Invoice',
    upload: 'Upload Invoice',
    replace: 'Replace',
    pdf: 'PDF',
    selectPdf: 'Please select a PDF file',
    uploaded: 'Invoice uploaded',
    uploadFailed: 'Upload failed',
    downloadFailed: 'Download failed',
    delete: 'Delete',
    deleteTitle: 'Delete invoice?',
    deleteDesc: 'The uploaded factory invoice PDF will be permanently removed.',
    cancel: 'Cancel',
    confirmDelete: 'Delete permanently',
    deleted: 'Invoice deleted',
    deleteFailed: 'Delete failed',
    paymentOk: 'PAYMENT OK',
    paymentReceived: 'Paid',
    paymentSet: 'Payment marked as received',
    paymentReset: 'Payment reset',
    paymentFailed: 'Update failed',
  },
  zh: {
    title: 'Factory Invoice',
    subtitle: '为已批准的订单上传供应商发票',
    orders: '订单',
    noPermission: '您无权上传工厂发票。仅角色',
    and: '和',
    mayUpload: '可以上传。',
    searchPh: '搜索：供应商、订单号、型号、颜色…',
    empty: '暂无订单。',
    reclamation: '索赔',
    invoice: '发票',
    upload: '上传发票',
    replace: '替换',
    pdf: 'PDF',
    selectPdf: '请选择 PDF 文件',
    uploaded: '发票已上传',
    uploadFailed: '上传失败',
    downloadFailed: '下载失败',
    delete: '删除',
    deleteTitle: '删除发票？',
    deleteDesc: '已上传的工厂发票 PDF 将被永久删除。',
    cancel: '取消',
    confirmDelete: '永久删除',
    deleted: '发票已删除',
    deleteFailed: '删除失败',
    paymentOk: 'PAYMENT OK',
    paymentReceived: '已付款',
    paymentSet: '付款已标记为收到',
    paymentReset: '付款已重置',
    paymentFailed: '更新失败',
  },
};

interface Row {
  id: string;
  order_number: string;
  production_order_number: string | null;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  supplier_id: string;
  approval_status: string;
  approved_at: string | null;
  invoice_pdf_path: string | null;
  payment_status: string | null;
  is_reclamation: boolean;
  supplier?: { name: string | null } | null;
}

export default function FactoryInvoice() {
  const { roles } = useAuth();
  const canUpload = roles.includes('Super Admin') || roles.includes('FACTORY INVOICE');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('production_lang') as Lang) || 'de');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<Row | null>(null);

  const t = T[lang];

  useEffect(() => { localStorage.setItem('production_lang', lang); }, [lang]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('id, order_number, production_order_number, status, liefertermin, modellname, farbe, bearbeiter, supplier_id, approval_status, approved_at, invoice_pdf_path, is_reclamation, supplier:suppliers(name)')
      .eq('approval_status', 'approved')
      .order('approved_at', { ascending: false });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      `${r.production_order_number || ''} ${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.supplier?.name || ''}`
        .toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handlePickFile = (row: Row) => {
    if (!canUpload) return;
    activeRowRef.current = row;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const row = activeRowRef.current;
    e.target.value = '';
    if (!file || !row) return;
    if (file.type !== 'application/pdf') {
      toast.error(t.selectPdf);
      return;
    }
    setUploadingId(row.id);
    try {
      const path = `invoices/${row.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('production-orders')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;
      const { error: rpcErr } = await supabase.rpc('set_factory_invoice_pdf', {
        _production_order_id: row.id,
        _path: path,
      });
      if (rpcErr) throw rpcErr;
      toast.success(t.uploaded);
      await load();
    } catch (err: any) {
      toast.error(err?.message || t.uploadFailed);
    } finally {
      setUploadingId(null);
      activeRowRef.current = null;
    }
  };

  const downloadInvoice = async (row: Row) => {
    if (!row.invoice_pdf_path) return;
    const { data, error } = await supabase.storage.from('production-orders').download(row.invoice_pdf_path);
    if (error || !data) return toast.error(error?.message || t.downloadFailed);
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${row.production_order_number || row.order_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDeleteInvoice = async () => {
    const row = deleteRow;
    if (!row || !row.invoice_pdf_path) return;
    setDeletingId(row.id);
    try {
      const { error: rmErr } = await supabase.storage
        .from('production-orders')
        .remove([row.invoice_pdf_path]);
      if (rmErr) throw rmErr;
      const { error: rpcErr } = await supabase.rpc('clear_factory_invoice_pdf', {
        _production_order_id: row.id,
      });
      if (rpcErr) throw rpcErr;
      toast.success(t.deleted);
      setDeleteRow(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || t.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Receipt className="w-6 h-6" /> {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors",
                  lang === l.code
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>{l.flag}</span><span>{l.label}</span>
              </button>
            ))}
          </div>
          <Badge variant="outline" className="text-xs">
            {filtered.length} {t.orders}
          </Badge>
        </div>
      </div>

      {!canUpload && (
        <Card className="p-3 border-yellow-500/40 bg-yellow-500/5 text-xs text-yellow-500">
          {t.noPermission} <b>Super Admin</b> {t.and} <b>FACTORY INVOICE</b> {t.mayUpload}
        </Card>
      )}

      <Card className="p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPh}
            className="pl-9 h-9"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {t.empty}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.production_order_number || r.order_number}</span>
                    {r.is_reclamation && (
                      <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-500">{t.reclamation}</Badge>
                    )}
                    {r.invoice_pdf_path && (
                      <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500 gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t.invoice}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                    {r.supplier?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {r.supplier.name}
                      </span>
                    )}
                    {r.modellname && <span>· {r.modellname}</span>}
                    {r.farbe && <span>· {r.farbe}</span>}
                    {r.bearbeiter && <span>· {r.bearbeiter}</span>}
                    {r.liefertermin && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(r.liefertermin), 'dd.MM.yyyy')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.invoice_pdf_path && (
                    <Button variant="outline" size="sm" onClick={() => downloadInvoice(r)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> {t.pdf}
                    </Button>
                  )}
                  {canUpload && r.invoice_pdf_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => setDeleteRow(r)}
                      disabled={deletingId === r.id}
                    >
                      {deletingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {t.delete}
                    </Button>
                  )}
                  {canUpload && (
                    <Button
                      size="sm"
                      className="gold-gradient"
                      onClick={() => handlePickFile(r)}
                      disabled={uploadingId === r.id}
                    >
                      {uploadingId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {r.invoice_pdf_path ? t.replace : t.upload}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AlertDialog open={!!deleteRow} onOpenChange={(v) => !v && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDesc}
              {deleteRow && (
                <div className="mt-2 text-xs font-mono text-foreground">
                  {deleteRow.production_order_number || deleteRow.order_number}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvoice}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
