import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Factory, Download, Search, Pencil, Camera, Calendar, User, Palette, Zap, Hash, ImageIcon, ArrowUpDown } from 'lucide-react';
import { differenceInCalendarDays, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type PhotoSide = 'front' | 'right' | 'left';

interface ProductionOrderRow {
  id: string;
  order_number: string;
  production_order_number: string | null;
  status: string;
  liefertermin: string;
  modellname: string | null;
  farbe: string | null;
  bearbeiter: string | null;
  power_handstueck: string | null;
  sonderwuensche: string | null;
  anmerkungen: string | null;
  seriennummer: string | null;
  payment_status: string | null;
  pdf_path: string | null;
  photo_front_path: string | null;
  photo_right_path: string | null;
  photo_left_path: string | null;
  supplier_id: string;
  created_at: string;
  sent_at: string | null;
  supplier?: { name: string | null } | null;
}

const STATUS_OPTIONS = [
  'offen',
  'in Bearbeitung',
  'fertig',
  'versendet',
];

type Lang = 'de' | 'en' | 'zh';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

const T: Record<Lang, Record<string, string>> = {
  de: {
    title: 'PRODUCTION', worklist: 'Arbeitsliste', loggedInAs: 'Angemeldet als',
    searchPh: 'Suche: Auftragsnr., Modell, Farbe, Seriennr., Bearbeiter…',
    allStatus: 'Alle Status', refresh: 'Aktualisieren', noOrders: 'Keine Bestellungen gefunden.',
    deliveryDate: 'Liefertermin', edit: 'Bearbeiten', pdf: 'PDF',
    model: 'Modell', color: 'Farbe', powerHs: 'Power-Handstück', operator: 'Bearbeiter',
    serial: 'Seriennummer', wishes: 'Interne Nummer', notes: 'Anmerkungen', status: 'Status', payment: 'Payment Status',
    editTitle: 'Auftrag bearbeiten', photos: 'Fotos', allRequired: '(alle 3 erforderlich)',
    front: 'Vorne', right: 'Rechts', left: 'Links',
    pickPhoto: 'Foto wählen', orCamera: 'oder Kamera',
    cancel: 'Abbrechen', save: 'Speichern', language: 'Sprache',
    photosRequired: 'Bitte alle 3 Fotos (Vorne, Rechts, Links) hochladen.',
    saved: 'Auftrag gespeichert', statusUpdated: 'Status aktualisiert',
    noPdf: 'Kein PDF verfügbar', downloadFailed: 'Download fehlgeschlagen',
    s_offen: 'offen', s_inBearbeitung: 'in Bearbeitung', s_fertig: 'fertig', s_versendet: 'versendet',
    p_Ja: 'Ja', p_Nein: 'Nein', p_Teilweise: 'Teilweise',
    wishesPh: 'Max. 10 (A-Z, 0-9)',
  },
  en: {
    title: 'PRODUCTION', worklist: 'Worklist', loggedInAs: 'Signed in as',
    searchPh: 'Search: order no., model, color, serial, operator…',
    allStatus: 'All statuses', refresh: 'Refresh', noOrders: 'No orders found.',
    deliveryDate: 'Delivery date', edit: 'Edit', pdf: 'PDF',
    model: 'Model', color: 'Color', powerHs: 'Power handpiece', operator: 'Operator',
    serial: 'Serial number', wishes: 'Internal number', notes: 'Notes', status: 'Status', payment: 'Payment status',
    editTitle: 'Edit order', photos: 'Photos', allRequired: '(all 3 required)',
    front: 'Front', right: 'Right', left: 'Left',
    pickPhoto: 'Choose photo', orCamera: 'or camera',
    cancel: 'Cancel', save: 'Save', language: 'Language',
    photosRequired: 'Please upload all 3 photos (Front, Right, Left).',
    saved: 'Order saved', statusUpdated: 'Status updated',
    noPdf: 'No PDF available', downloadFailed: 'Download failed',
    s_offen: 'open', s_inBearbeitung: 'in progress', s_fertig: 'done', s_versendet: 'shipped',
    p_Ja: 'Yes', p_Nein: 'No', p_Teilweise: 'Partial',
    wishesPh: 'Max. 10 (A-Z, 0-9)',
  },
  zh: {
    title: '生产', worklist: '工作清单', loggedInAs: '登录身份',
    searchPh: '搜索：订单号、型号、颜色、序列号、操作员…',
    allStatus: '所有状态', refresh: '刷新', noOrders: '未找到订单。',
    deliveryDate: '交货日期', edit: '编辑', pdf: 'PDF',
    model: '型号', color: '颜色', powerHs: '动力手柄', operator: '操作员',
    serial: '序列号', wishes: '内部编号', notes: '备注', status: '状态', payment: '付款状态',
    editTitle: '编辑订单', photos: '照片', allRequired: '（需全部 3 张）',
    front: '正面', right: '右侧', left: '左侧',
    pickPhoto: '选择照片', orCamera: '或使用相机',
    cancel: '取消', save: '保存', language: '语言',
    photosRequired: '请上传全部 3 张照片（正面、右侧、左侧）。',
    saved: '订单已保存', statusUpdated: '状态已更新',
    noPdf: '无可用 PDF', downloadFailed: '下载失败',
    s_offen: '待处理', s_inBearbeitung: '处理中', s_fertig: '完成', s_versendet: '已发货',
    p_Ja: '是', p_Nein: '否', p_Teilweise: '部分',
    wishesPh: '最多 10 个字符（A-Z，0-9）',
  },
};

const statusKey = (s: string) => {
  switch (s) {
    case 'offen': return 's_offen';
    case 'in Bearbeitung': return 's_inBearbeitung';
    case 'fertig': return 's_fertig';
    case 'versendet': return 's_versendet';
    default: return s;
  }
};

export default function ProductionPortal() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ProductionOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductionOrderRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductionOrderRow>>({});
  const [saving, setSaving] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<Record<PhotoSide, string | null>>({ front: null, right: null, left: null });
  const [uploadingSide, setUploadingSide] = useState<PhotoSide | null>(null);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('production_lang') as Lang) || 'de');
  const t = T[lang];
  const tStatus = (s: string) => t[statusKey(s)] ?? s;
  const tPayment = (p: string) => t[`p_${p}`] ?? p;
  useEffect(() => { localStorage.setItem('production_lang', lang); }, [lang]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name)')
      .order('liefertermin', { ascending: true });
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from('production_orders')
      .update({ status: newStatus })
      .eq('id', id);
    setUpdatingId(null);
    if (error) return toast.error(error.message);
    toast.success(t.statusUpdated);
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const signedPhotoUrl = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from('production-photos').createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };

  const openEdit = async (row: ProductionOrderRow) => {
    setEditing(row);
    setEditForm({
      modellname: row.modellname,
      farbe: row.farbe,
      power_handstueck: row.power_handstueck,
      bearbeiter: row.bearbeiter,
      seriennummer: row.seriennummer,
      sonderwuensche: row.sonderwuensche,
      anmerkungen: row.anmerkungen,
      status: row.status,
      payment_status: row.payment_status || 'Nein',
      photo_front_path: row.photo_front_path,
      photo_right_path: row.photo_right_path,
      photo_left_path: row.photo_left_path,
    });
    setPhotoPreviews({ front: null, right: null, left: null });
    const [front, right, left] = await Promise.all([
      signedPhotoUrl(row.photo_front_path),
      signedPhotoUrl(row.photo_right_path),
      signedPhotoUrl(row.photo_left_path),
    ]);
    setPhotoPreviews({ front, right, left });
  };

  const handlePhotoUpload = async (side: PhotoSide, file: File) => {
    if (!editing) return;
    setUploadingSide(side);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${editing.supplier_id}/${editing.id}/${side}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('production-photos')
      .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (error) {
      setUploadingSide(null);
      return toast.error(error.message);
    }
    const key = `photo_${side}_path` as 'photo_front_path' | 'photo_right_path' | 'photo_left_path';
    setEditForm(f => ({ ...f, [key]: path }));
    const url = await signedPhotoUrl(path);
    setPhotoPreviews(p => ({ ...p, [side]: url }));
    setUploadingSide(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.photo_front_path || !editForm.photo_right_path || !editForm.photo_left_path) {
      return toast.error(t.photosRequired);
    }
    setSaving(true);
    const payload = {
      modellname: editForm.modellname ?? null,
      farbe: editForm.farbe ?? '',
      power_handstueck: editForm.power_handstueck ?? '',
      bearbeiter: editForm.bearbeiter ?? '',
      seriennummer: editForm.seriennummer ?? null,
      sonderwuensche: editForm.sonderwuensche ?? null,
      anmerkungen: editForm.anmerkungen ?? null,
      status: editForm.status ?? editing.status,
      payment_status: editForm.payment_status ?? 'Nein',
      photo_front_path: editForm.photo_front_path,
      photo_right_path: editForm.photo_right_path,
      photo_left_path: editForm.photo_left_path,
    };
    const { error } = await supabase
      .from('production_orders')
      .update(payload)
      .eq('id', editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t.saved);
    setRows(prev => prev.map(r => r.id === editing.id ? { ...r, ...payload } as ProductionOrderRow : r));
    setEditing(null);
  };

  const downloadPdf = async (path: string | null, orderNumber: string) => {
    if (!path) return toast.error(t.noPdf);
    const { data, error } = await supabase.storage.from('production-orders').download(path);
    if (error || !data) return toast.error(error?.message || t.downloadFailed);
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q) return true;
    const hay = `${r.production_order_number || ''} ${r.order_number} ${r.modellname || ''} ${r.farbe || ''} ${r.bearbeiter || ''} ${r.seriennummer || ''}`.toLowerCase();
    return hay.includes(q);
  });

  const supplierName = rows[0]?.supplier?.name;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <Factory className="w-6 h-6" /> {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.worklist} {supplierName ? `– ${supplierName}` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {t.loggedInAs} <span className="text-foreground font-medium">{profile?.full_name || profile?.email}</span>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPh}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t.status} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatus}</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {t.refresh}
        </Button>
      </Card>

      {/* Language switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">{t.language}:</span>
        {LANGS.map(l => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
              lang === l.code
                ? "bg-primary/10 text-primary border-primary/40 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <span className="text-base leading-none">{l.flag}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t.noOrders}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(row => (
            <Card key={row.id} className="p-5 space-y-3 card-glow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-foreground font-mono">{row.production_order_number || row.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.deliveryDate}: <span className="text-foreground font-medium">
                      {row.liefertermin ? format(new Date(row.liefertermin), 'dd.MM.yyyy') : '—'}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                    <Pencil className="w-4 h-4 mr-1" /> {t.edit}
                  </Button>
                  {row.pdf_path && (
                    <Button size="sm" variant="outline" onClick={() => downloadPdf(row.pdf_path, row.production_order_number || row.order_number)}>
                      <Download className="w-4 h-4 mr-1" /> {t.pdf}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">{t.model}:</span>{' '}
                  <span className="text-foreground">{row.modellname || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.color}:</span>{' '}
                  <span className="text-foreground">{row.farbe || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.powerHs}:</span>{' '}
                  <span className="text-foreground">{row.power_handstueck || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t.operator}:</span>{' '}
                  <span className="text-foreground">{row.bearbeiter || '—'}</span>
                </div>
                {row.seriennummer && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.serial}:</span>{' '}
                    <span className="text-foreground">{row.seriennummer}</span>
                  </div>
                )}
                {row.sonderwuensche && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.wishes}:</span>{' '}
                    <span className="text-foreground">{row.sonderwuensche}</span>
                  </div>
                )}
                {row.anmerkungen && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.notes}:</span>{' '}
                    <span className="text-foreground">{row.anmerkungen}</span>
                  </div>
                )}
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-muted-foreground">{t.payment}:</span>
                  {(() => {
                    const ps = row.payment_status || 'Nein';
                    const cls = ps === 'Ja'
                      ? 'bg-green-500/15 text-green-500'
                      : ps === 'Teilweise'
                        ? 'bg-yellow-500/15 text-yellow-500'
                        : 'bg-destructive/15 text-destructive';
                    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{tPayment(ps)}</span>;
                  })()}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">{t.status}:</span>
                <Select
                  value={row.status}
                  onValueChange={(v) => setTimeout(() => updateStatus(row.id, v), 0)}
                  disabled={updatingId === row.id}
                >
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatingId === row.id && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.editTitle} {editing && `– ${editing.production_order_number || editing.order_number}`}</DialogTitle>
            <DialogDescription className="sr-only">{t.editTitle}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>{t.model}</Label>
              <Input value={editForm.modellname ?? ''} onChange={e => setEditForm(f => ({ ...f, modellname: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.color}</Label>
              <Input value={editForm.farbe ?? ''} onChange={e => setEditForm(f => ({ ...f, farbe: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.powerHs}</Label>
              <Input value={editForm.power_handstueck ?? ''} onChange={e => setEditForm(f => ({ ...f, power_handstueck: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.operator}</Label>
              <Input value={editForm.bearbeiter ?? ''} onChange={e => setEditForm(f => ({ ...f, bearbeiter: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.serial}</Label>
              <Input value={editForm.seriennummer ?? ''} onChange={e => setEditForm(f => ({ ...f, seriennummer: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.status}</Label>
              <Select value={editForm.status ?? 'offen'} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{tStatus(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.payment} <span className="text-destructive">*</span></Label>
              <Select value={editForm.payment_status ?? 'Nein'} onValueChange={v => setEditForm(f => ({ ...f, payment_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ja">{tPayment('Ja')}</SelectItem>
                  <SelectItem value="Nein">{tPayment('Nein')}</SelectItem>
                  <SelectItem value="Teilweise">{tPayment('Teilweise')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>{t.photos} <span className="text-destructive">*</span> <span className="text-xs text-muted-foreground font-normal">{t.allRequired}</span></Label>
              <div className="grid grid-cols-3 gap-3">
                {(['front','right','left'] as PhotoSide[]).map(side => {
                  const labels: Record<PhotoSide,string> = { front: t.front, right: t.right, left: t.left };
                  const key = `photo_${side}_path` as 'photo_front_path' | 'photo_right_path' | 'photo_left_path';
                  const hasPhoto = !!editForm[key];
                  const preview = photoPreviews[side];
                  const inputId = `photo-${side}`;
                  return (
                    <div key={side} className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground text-center">{labels[side]}</div>
                      <label
                        htmlFor={inputId}
                        className={cn(
                          "relative aspect-square w-full rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors",
                          hasPhoto ? "border-primary/40" : "border-border"
                        )}
                      >
                        {preview ? (
                          <img src={preview} alt={labels[side]} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground text-[11px] gap-1 p-2 text-center">
                            <Camera className="w-5 h-5" />
                            <span>{t.pickPhoto}<br/>{t.orCamera}</span>
                          </div>
                        )}
                        {uploadingSide === side && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          </div>
                        )}
                      </label>
                      <input
                        id={inputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(side, file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t.wishes}</Label>
              <Input
                value={editForm.sonderwuensche ?? ''}
                onChange={e => setEditForm(f => ({ ...f, sonderwuensche: e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) }))}
                maxLength={10}
                placeholder={t.wishesPh}
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t.notes}</Label>
              <Textarea rows={3} value={editForm.anmerkungen ?? ''} onChange={e => setEditForm(f => ({ ...f, anmerkungen: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>{t.cancel}</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
