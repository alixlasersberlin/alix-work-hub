import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Loader2, Factory, Users as UsersIcon, FileText, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Mode = 'order' | 'reclamation';

type Lang = 'de' | 'en' | 'zh';

const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

const T: Record<Lang, Record<string, string>> = {
  de: {
    title: 'ORDER – Produktionsbestellungen',
    subtitle: 'Bestellungen an die Produktion verwalten und versenden',
    suppliers: 'Zulieferer',
    newOrder: 'Neue Bestellung',
    empty: 'Noch keine Bestellungen vorhanden.',
    confirmDelete: 'Bestellung wirklich löschen?',
    deleted: 'Bestellung gelöscht',
    language: 'Sprache',
    orderNo: 'Bestell-/Auftragsnr.',
    internalNo: 'Interne Nummer',
    supplier: 'Zulieferer',
    model: 'Modell',
    handler: 'Bearbeiter',
    delivery: 'Liefertermin',
    payment: 'Payment',
    status: 'Status',
    actions: 'Aktionen',
    intern: 'Intern',
    p_Ja: 'Ja', p_Nein: 'Nein', p_Teilweise: 'Teilweise', p_Garantie: 'Garantie',
  },
  en: {
    title: 'ORDER – Production Orders',
    subtitle: 'Manage and dispatch production orders',
    suppliers: 'Suppliers',
    newOrder: 'New order',
    empty: 'No orders yet.',
    confirmDelete: 'Really delete this order?',
    deleted: 'Order deleted',
    language: 'Language',
    orderNo: 'Order no.',
    internalNo: 'Internal no.',
    supplier: 'Supplier',
    model: 'Model',
    handler: 'Handler',
    delivery: 'Delivery date',
    payment: 'Payment',
    status: 'Status',
    actions: 'Actions',
    intern: 'Internal',
    p_Ja: 'Yes', p_Nein: 'No', p_Teilweise: 'Partial', p_Garantie: 'Warranty',
  },
  zh: {
    title: 'ORDER – 生产订单',
    subtitle: '管理并发送生产订单',
    suppliers: '供应商',
    newOrder: '新建订单',
    empty: '暂无订单。',
    confirmDelete: '确定要删除此订单吗？',
    deleted: '订单已删除',
    language: '语言',
    orderNo: '订单号',
    internalNo: '内部编号',
    supplier: '供应商',
    model: '型号',
    handler: '处理人',
    delivery: '交货日期',
    payment: '付款',
    status: '状态',
    actions: '操作',
    intern: '内部',
    p_Ja: '是', p_Nein: '否', p_Teilweise: '部分',
  },
};

export default function ProductionOrders({ mode = 'order' }: { mode?: Mode } = {}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('production_lang') as Lang) || 'de');
  const t = T[lang];
  const navigate = useNavigate();
  const isReclamation = mode === 'reclamation';
  const basePath = isReclamation ? '/order/reklamation' : '/order';

  useEffect(() => { localStorage.setItem('production_lang', lang); }, [lang]);

  const tPayment = (p: string) => t[`p_${p}`] ?? p;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('production_orders')
      .select('*, supplier:suppliers(name, email)')
      .eq('is_reclamation', isReclamation)
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else {
      const list = data || [];
      const enriched = list.map(r => ({
        ...r,
        display_order_number: r.production_order_number || r.order_number,
      }));
      setRows(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [isReclamation]);

  const remove = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    const { error } = await supabase.from('production_orders').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success(t.deleted);
    load();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold gold-text flex items-center gap-2">
            {isReclamation
              ? <><AlertTriangle className="w-5 h-5 md:w-6 md:h-6" /> Reklamation – Bestellungen</>
              : <><Factory className="w-5 h-5 md:w-6 md:h-6" /> {t.title}</>}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            {isReclamation ? 'Reklamationsbestellungen verwalten und versenden' : t.subtitle}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!isReclamation && (
            <Button variant="outline" size="sm" className="md:size-default" onClick={() => navigate('/order/zulieferer')}>
              <UsersIcon className="w-4 h-4 mr-2" /> {t.suppliers}
            </Button>
          )}
          <Button size="sm" className="md:size-default" onClick={() => navigate(`${basePath}/neu`)}>
            <Plus className="w-4 h-4 mr-2" /> {isReclamation ? 'Neue Reklamation' : t.newOrder}
          </Button>
        </div>
      </div>

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

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">{t.empty}</div>
        ) : (
          <>
            {/* Mobile / Tablet: Karten-Ansicht */}
            <div className="lg:hidden divide-y divide-border">
              {rows.map(r => {
                const ps = r.payment_status || 'Nein';
                const psCls = ps === 'Ja'
                  ? 'bg-green-500/15 text-green-500'
                  : ps === 'Teilweise'
                    ? 'bg-yellow-500/15 text-yellow-500'
                    : 'bg-destructive/15 text-destructive';
                return (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-foreground">{r.display_order_number || r.order_number}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.supplier?.name || '—'}</div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${psCls}`}>{tPayment(ps)}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary">{r.status}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div><span className="text-muted-foreground">{t.intern}:</span> <span className="font-mono uppercase">{r.sonderwuensche || '—'}</span></div>
                      <div><span className="text-muted-foreground">{t.model}:</span> {r.modellname || '—'}</div>
                      <div><span className="text-muted-foreground">{t.handler}:</span> {r.bearbeiter}</div>
                      <div><span className="text-muted-foreground">{t.delivery}:</span> {r.liefertermin ? format(new Date(r.liefertermin), 'dd.MM.yyyy') : '—'}</div>
                    </div>
                    <div className="flex justify-end gap-1 pt-1 border-t border-border/50">
                      <Button asChild size="sm" variant="ghost"><Link to={`${basePath}/${r.id}`}><FileText className="w-4 h-4" /></Link></Button>
                      <Button asChild size="sm" variant="ghost"><Link to={`${basePath}/${r.id}/bearbeiten`}><Pencil className="w-4 h-4" /></Link></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Tabelle */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left">
                    <th className="p-3">{t.orderNo}</th>
                    <th className="p-3">{t.internalNo}</th>
                    <th className="p-3">{t.supplier}</th>
                    <th className="p-3">{t.model}</th>
                    <th className="p-3">{t.handler}</th>
                    <th className="p-3">{t.delivery}</th>
                    <th className="p-3">{t.payment}</th>
                    <th className="p-3">{t.status}</th>
                    <th className="p-3 text-right">{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-mono">{r.display_order_number || r.order_number}</td>
                      <td className="p-3 font-mono uppercase">{r.sonderwuensche || '—'}</td>
                      <td className="p-3">{r.supplier?.name || '—'}</td>
                      <td className="p-3">{r.modellname || '—'}</td>
                      <td className="p-3">{r.bearbeiter}</td>
                      <td className="p-3">{r.liefertermin ? format(new Date(r.liefertermin), 'dd.MM.yyyy') : '—'}</td>
                      <td className="p-3">
                        {(() => {
                          const ps = r.payment_status || 'Nein';
                          const cls = ps === 'Ja'
                            ? 'bg-green-500/15 text-green-500'
                            : ps === 'Teilweise'
                              ? 'bg-yellow-500/15 text-yellow-500'
                              : 'bg-destructive/15 text-destructive';
                          return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{tPayment(ps)}</span>;
                        })()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{r.status}</span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button asChild size="sm" variant="ghost"><Link to={`${basePath}/${r.id}`}><FileText className="w-4 h-4" /></Link></Button>
                        <Button asChild size="sm" variant="ghost"><Link to={`${basePath}/${r.id}/bearbeiten`}><Pencil className="w-4 h-4" /></Link></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
