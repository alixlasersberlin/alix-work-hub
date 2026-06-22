import { SkeletonForm } from '@/components/infinity/Skeleton';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { withAt } from '@/lib/atSuffix';
import { sourceLabel, sourceFlag } from '@/lib/source-system';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, ClipboardList, Building2, FileText, History, Loader2, Inbox, Send, Pencil, X, Check, Shield, Package, CalendarIcon, CalendarClock, Truck, Euro, Mail, Landmark, Plus, Trash2, ShoppingCart, ShoppingBag, CheckCircle2, Hash, MessageSquare, ChevronDown, Briefcase, Wrench
} from 'lucide-react';
import { createRestbestellungMarker, hasPendingRestbestellung } from '@/lib/restbestellung';
import { sendDepositReceivedNotice } from '@/lib/send-deposit-received-notice';
import BankFinancingTab from '@/components/BankFinancingTab';
import AtPurchaseTab from '@/components/AtPurchaseTab';
import AtApprovalTab from '@/components/AtApprovalTab';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import InstallmentPlanDialog, { type InstallmentPlanDialogHandle } from '@/components/InstallmentPlanDialog';
import SepaMandatButton, { type SepaMandatHandle } from '@/components/SepaMandatButton';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderItemsEditDialog from '@/components/OrderItemsEditDialog';

import OrderDeferDialog from '@/components/OrderDeferDialog';
import MietkaufDialog, { type MietkaufDialogHandle } from '@/components/MietkaufDialog';
import DeliveryNoteTab from '@/components/DeliveryNoteTab';
import AuftragsbestaetigungTab from '@/components/AuftragsbestaetigungTab';
import OrderConfirmationTab from '@/components/OrderConfirmationTab';
import AzInvoiceTab from '@/components/AzInvoiceTab';
import CustomerSmsTab from '@/components/CustomerSmsTab';
import { sendCustomerShippingNotice } from '@/lib/send-customer-shipping-notice';
import { sendReviewInvitation } from '@/lib/review-invitation';
import { VipBadge } from '@/components/VipBadge';
import { isOrderVip } from '@/lib/vip';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, hasRole, hasAnyRole } = useAuth();

  const canWrite = isAdmin || hasRole('Auftragsverwaltung');

  const [order, setOrder] = useState<any>(null);
  // Österreich darf Anzahlungen nur bei -AT-Aufträgen (zoho_eu_2) erfassen
  const canWriteDeposit = canWrite || (order?.source_system === 'zoho_eu_2' && hasRole('Österreich'));
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [poCount, setPoCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'serials' | 'deposit' | 'financing' | 'at_purchase' | 'at_approval' | 'packages' | 'confirmation' | 'lieferschein' | 'auftragsbestaetigung' | 'az_invoice' | 'notes' | 'emails' | 'sms' | 'history' | 'raw'>('overview');
  const [serialDevices, setSerialDevices] = useState<Array<{ id: string; serial_number: string; model_name: string; notes: string | null; updated_at: string | null }>>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [depositOk, setDepositOk] = useState(false);
  const [depositBy, setDepositBy] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAdditional, setDepositAdditional] = useState('');
  const [depositBookingDate, setDepositBookingDate] = useState('');
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [additionalDeposits, setAdditionalDeposits] = useState<any[]>([]);
  const [newAddAmount, setNewAddAmount] = useState('');
  const [newAddDate, setNewAddDate] = useState('');
  const [newAddNote, setNewAddNote] = useState('');
  const [newAddGeleistet, setNewAddGeleistet] = useState<'ja' | 'nein'>('nein');
  const [addingDeposit, setAddingDeposit] = useState(false);

  // Note form
  const [newNote, setNewNote] = useState('');
  const [newNoteType, setNewNoteType] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editingShipDate, setEditingShipDate] = useState(false);
  const [shipDateValue, setShipDateValue] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [itemsEditOpen, setItemsEditOpen] = useState(false);

  const [deferOpen, setDeferOpen] = useState(false);
  const [restPending, setRestPending] = useState(false);

  const sepaRef = useRef<SepaMandatHandle>(null);
  const mietkaufRef = useRef<MietkaufDialogHandle>(null);
  const ratenplanRef = useRef<InstallmentPlanDialogHandle>(null);

  useEffect(() => {
    if (!id) return;
    hasPendingRestbestellung(id).then(setRestPending);
  }, [id]);

  // Auto-Tab via ?tab=az_invoice (oder anderer Key) beim Öffnen
  const validTabs = ['overview','items','serials','deposit','financing','at_purchase','at_approval','packages','confirmation','lieferschein','auftragsbestaetigung','az_invoice','notes','emails','sms','history','raw'] as const;
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (validTabs as readonly string[]).includes(t)) {
      setActiveTab(t as any);
    }
    // nur beim Mount auswerten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktiven Tab in den sichtbaren Bereich scrollen (horizontal scrollbare Tab-Leiste)
  useEffect(() => {
    const el = document.querySelector(`[data-tab-key="${activeTab}"]`) as HTMLElement | null;
    if (el) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch {
        el.scrollIntoView();
      }
    }
    // URL-Parameter aktuell halten, ohne History zuzumüllen
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      if (activeTab === 'overview') next.delete('tab');
      else next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab]);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  async function loadAll() {
    setLoading(true);
    const [oRes, nRes, hRes, iRes, adRes] = await Promise.all([
      supabase.from('orders').select('*, customers(*)').eq('id', id!).maybeSingle(),
      supabase.from('order_notes').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
      supabase.from('order_status_history').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
      supabase.from('order_items').select('*').eq('order_id', id!).order('item_order', { ascending: true }),
      supabase.from('order_additional_deposits' as any).select('*').eq('order_id', id!).order('booking_date', { ascending: true }),
    ]);
    setOrder(oRes.data);
    setCustomer(oRes.data?.customers);
    setNotes(nRes.data ?? []);
    setItems(iRes.data ?? []);
    setHistory(hRes.data ?? []);
    setAdditionalDeposits((adRes as any).data ?? []);
    setDepositOk(!!oRes.data?.deposit_ok);
    setDepositBy(oRes.data?.deposit_ok_by || '');
    setDepositAmount(oRes.data?.deposit_amount != null ? String(oRes.data.deposit_amount) : '');
    setDepositAdditional(oRes.data?.deposit_additional != null ? String(oRes.data.deposit_additional) : '');
    setDepositBookingDate((oRes.data as any)?.deposit_booking_date || '');

    // Anzahl Produktionsbestellungen f\u00fcr diese order_number
    if (oRes.data?.order_number) {
      const { count } = await supabase
        .from('production_orders')
        .select('id', { count: 'exact', head: true })
        .eq('order_number', oRes.data.order_number);
      setPoCount(count || 0);
    } else {
      setPoCount(0);
    }

    // Seriennummern: alle Lager-Geräte, die diesem Auftrag (aktuell oder historisch) zugeordnet sind/waren
    const { data: serialsData } = await supabase
      .from('lager_devices')
      .select('id, serial_number, model_name, notes, updated_at, reserved_order_id, delivered_order_id')
      .or(`reserved_order_id.eq.${id},delivered_order_id.eq.${id}`)
      .order('updated_at', { ascending: false });
    setSerialDevices((serialsData as any) ?? []);

    setLoading(false);
  }

  // Anzeige: originale Zoho-Auftragsnummer + "-AT" Suffix für Alix Austria
  const displayOrderNumbers = order?.order_number ? [withAt(order.order_number, order.source_system)] : [];
  const primaryDisplayNumber = withAt(order?.order_number, order?.source_system) || '';

  async function submitNote() {
    if (!newNote.trim() || !id || !user) return;
    setSubmitting(true);
    await supabase.from('order_notes').insert({
      order_id: id,
      note_text: newNote.trim(),
      note_type: newNoteType,
      created_by: user.id,
    });
    setNewNote('');
    setNewNoteType('general');
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', id).order('created_at', { ascending: false });
    setNotes(data ?? []);
    setSubmitting(false);
  }

  async function saveEditNote() {
    if (!editNoteId || !editNoteText.trim()) return;
    await supabase.from('order_notes').update({ note_text: editNoteText.trim() }).eq('id', editNoteId);
    setEditNoteId(null);
    const { data } = await supabase.from('order_notes').select('*').eq('order_id', id!).order('created_at', { ascending: false });
    setNotes(data ?? []);
  }

  async function saveDeposit() {
    if (depositOk && !depositBy.trim()) {
      toast.error('Bitte Mitarbeitername eintragen');
      return;
    }
    setSavingDeposit(true);
    const depositChanged = !!order?.deposit_ok !== depositOk || (order?.deposit_ok_by || '') !== depositBy.trim();
    const depositJustConfirmed = depositOk && !order?.deposit_ok;
    const parsedAmount = depositAmount.trim() ? parseFloat(depositAmount.replace(',', '.')) : null;
    const { error } = await supabase.from('orders').update({
      deposit_ok: depositOk,
      deposit_ok_by: depositOk ? depositBy.trim() : null,
      deposit_ok_at: depositOk ? (depositChanged ? new Date().toISOString() : order?.deposit_ok_at) : null,
      deposit_amount: parsedAmount,
      deposit_additional: depositAdditional.trim() ? parseFloat(depositAdditional.replace(',', '.')) : null,
      deposit_booking_date: depositOk && depositBookingDate ? depositBookingDate : null,
    } as any).eq('id', id!);
    setSavingDeposit(false);
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success('Anzahlung gespeichert');
    if (depositJustConfirmed) {
      const mail = await sendDepositReceivedNotice(id!, {
        depositAmount: parsedAmount,
        depositDate: depositBookingDate || new Date().toISOString(),
        trigger: 'automatisch',
      });
      if (mail.ok) toast.success(mail.message); else toast.error('Anzahlungs-Mail nicht versendet: ' + mail.message);
    }
    loadAll();
  }

  async function addAdditionalDeposit() {
    const amt = newAddAmount.trim() ? parseFloat(newAddAmount.replace(',', '.')) : NaN;
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Bitte gültigen Betrag eingeben'); return; }
    if (!newAddDate) { toast.error('Bitte Datum auswählen'); return; }
    setAddingDeposit(true);
    const isGeleistet = newAddGeleistet === 'ja';
    const { data: inserted, error } = await supabase.from('order_additional_deposits' as any).insert({
      order_id: id!,
      amount: amt,
      booking_date: newAddDate,
      note: newAddNote.trim() || null,
      geleistet: isGeleistet,
      created_by: user?.id ?? null,
    } as any).select('id').maybeSingle();
    setAddingDeposit(false);
    if (error) { toast.error('Fehler: ' + error.message); return; }
    const depId = (inserted as any)?.id as string | undefined;
    setNewAddAmount(''); setNewAddDate(''); setNewAddNote(''); setNewAddGeleistet('nein');
    toast.success('Weitere Anzahlung hinzugefügt');
    if (isGeleistet) {
      const mail = await sendDepositReceivedNotice(id!, {
        depositAmount: amt,
        depositDate: newAddDate,
        trigger: 'automatisch',
        keySuffix: depId ? `add-${depId}` : `add-${Date.now()}`,
      });
      if (mail.ok) toast.success(mail.message); else toast.error('Anzahlungs-Mail nicht versendet: ' + mail.message);
    }
    loadAll();
  }

  async function toggleDepositGeleistet(depId: string, value: boolean) {
    const prev = additionalDeposits.find(d => d.id === depId);
    const { error } = await supabase.from('order_additional_deposits' as any).update({ geleistet: value } as any).eq('id', depId);
    if (error) { toast.error('Fehler: ' + error.message); return; }
    setAdditionalDeposits(p => p.map(d => d.id === depId ? { ...d, geleistet: value } : d));
    if (value && !prev?.geleistet) {
      const mail = await sendDepositReceivedNotice(id!, {
        depositAmount: prev?.amount ?? null,
        depositDate: prev?.booking_date ?? new Date().toISOString(),
        trigger: 'automatisch',
        keySuffix: `add-${depId}`,
      });
      if (mail.ok) toast.success(mail.message); else toast.error('Anzahlungs-Mail nicht versendet: ' + mail.message);
    }
  }

  async function deleteAdditionalDeposit(depId: string) {
    if (!confirm('Diese Anzahlung wirklich löschen?')) return;
    const { error } = await supabase.from('order_additional_deposits' as any).delete().eq('id', depId);
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success('Anzahlung gelöscht');
    loadAll();
  }

  if (loading) return <SkeletonForm fields={10} />;
  if (!order) return <div className="p-8 text-center text-muted-foreground">Auftrag nicht gefunden.</div>;

  const formatAddr = (a: any) => {
    if (!a) return '—';
    if (typeof a === 'string') return a;
    const street = a.address || a.street || '';
    const zip = a.zip || '';
    const city = a.city || '';
    const country = a.country || '';
    const parts = [street, `${zip} ${city}`.trim(), country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };


  const packages: any[] = Array.isArray(order?.raw_data?.packages) ? order.raw_data.packages : [];

  const emailNotes = notes.filter((n: any) => n.note_type === 'email');
  const generalNotes = notes.filter((n: any) => n.note_type !== 'email');

  const isAtOrder = order?.source_system === 'zoho_eu_2';
  const canSeeAtPurchase = isAtOrder && (hasRole('Super Admin') || hasRole('Österreich'));
  const canSeeAtApproval = isAtOrder && (hasRole('Super Admin') || hasRole('Admin') || hasRole('Österreich'));

  const overviewTab = { key: 'overview', label: 'Übersicht', icon: ClipboardList };
  const tabMenus: Array<{ name: string; icon: any; tabs: any[] }> = [
    {
      name: 'Artikel',
      icon: Package,
      tabs: [
        { key: 'items', label: 'Artikel', icon: Package, count: items.length },
        { key: 'serials', label: 'Seriennummer', icon: Hash, count: serialDevices.length },
        { key: 'packages', label: 'Pakete', icon: Truck, count: packages.length },
      ],
    },
    {
      name: 'Auftrag',
      icon: FileText,
      tabs: [
        { key: 'confirmation', label: 'Auftragsbestätigung', icon: FileText },
        { key: 'lieferschein', label: 'Lieferschein', icon: FileText },
        { key: 'auftragsbestaetigung', label: 'Auftrag Unterzeichnet', icon: FileText },
        { key: 'az_invoice', label: 'AZ Rechnung', icon: Euro, badge: (Number(order?.deposit_amount) || 0) > 0 ? '€' : undefined },
        { key: 'deposit', label: 'Anzahlung', icon: Euro, badge: order?.deposit_ok ? '✓' : undefined },
        { key: 'financing', label: 'Finanzierung', icon: Landmark },
        ...(canSeeAtPurchase ? [{ key: 'at_purchase', label: 'Einkauf AT', icon: ShoppingBag }] : []),
        ...(canSeeAtApproval ? [{ key: 'at_approval', label: 'Freigabe AT', icon: CheckCircle2 }] : []),
      ],
    },
    {
      name: 'Kommunikation',
      icon: MessageSquare,
      tabs: [
        { key: 'notes', label: 'Notizen', icon: FileText, count: generalNotes.length },
        { key: 'emails', label: 'E-Mails', icon: Mail, count: emailNotes.length },
        { key: 'sms', label: 'SMS Versand', icon: MessageSquare },
        { key: 'history', label: 'Historie', icon: History, count: history.length },
        ...(isAdmin ? [{ key: 'raw', label: 'Rohdaten', icon: Shield }] : []),
      ],
    },
  ];

  // Aktions-Menüs (Backoffice & Bearbeitung) — vor Kommunikation
  type ActionItem = { key: string; label: string; icon: any; onClick: () => void | Promise<void>; disabled?: boolean; title?: string };
  const actionMenus: Array<{ name: string; icon: any; items: ActionItem[] }> = [
    ...(canWrite ? [{
      name: 'Backoffice',
      icon: Briefcase,
      items: [
        { key: 'edit', label: 'Ändern', icon: Pencil, onClick: () => setEditOpen(true) },
        {
          key: 'email-kunde', label: 'E-Mail an Kunde', icon: Mail,
          disabled: sendingEmail || !customer?.email,
          title: !customer?.email ? 'Kunde hat keine E-Mail-Adresse' : 'Voravisierung an Kunde senden',
          onClick: async () => {
            setSendingEmail(true);
            const r = await sendCustomerShippingNotice(order.id, undefined, 'manuell', 'customer_shipping_notice');
            setSendingEmail(false);
            if (r.ok) { toast.success(r.message); loadAll(); }
            else toast.error(r.message);
          },
        },
        ...(hasRole('Super Admin') ? [{
          key: 'auftragsbestaetigung-email', label: 'Auftragsbestätigung Email', icon: Mail,
          onClick: () => setSearchParams({ tab: 'confirmation' }),
        }] : []),
        { key: 'sepa', label: 'SEPA Mandat', icon: FileText, onClick: () => sepaRef.current?.trigger() },
        { key: 'mietkauf', label: 'Mietkauf', icon: FileText, onClick: () => mietkaufRef.current?.open() },
        { key: 'ratenplan', label: 'Ratenplan', icon: FileText, onClick: () => ratenplanRef.current?.open() },
      ] as ActionItem[],
    }] : []),
    ...(canWrite ? [{
      name: 'Bearbeitung',
      icon: Wrench,
      items: [
        ...(order.order_status !== 'geliefert' ? [{
          key: 'mark-delivered', label: 'Als geliefert markieren', icon: Truck,
          onClick: async () => {
            const { data: devs } = await supabase
              .from('lager_devices')
              .select('model_name, serial_number')
              .eq('reserved_order_id', order.id);
            const prefetchedDevices = devs || [];
            const { error } = await supabase.from('orders').update({ order_status: 'geliefert' }).eq('id', order.id);
            if (error) { toast.error('Fehler: ' + error.message); return; }
            toast.success('Auftrag als geliefert markiert');
            const mail = await sendCustomerShippingNotice(order.id, undefined, 'automatisch', 'customer_delivered', prefetchedDevices);
            if (mail.ok) toast.success(mail.message); else toast.error('E-Mail nicht versendet: ' + mail.message);
            sendReviewInvitation(order.id, { manual: false }).catch(() => {});
            loadAll();
          },
        }] : []),
        ...(hasRole('Super Admin') ? [{
          key: 'review-manual', label: 'Bewertung manuell senden', icon: Mail,
          onClick: async () => {
            if (!order.customer_email) { toast.error('Für diesen Auftrag ist keine Kunden-E-Mail hinterlegt.'); return; }
            const res = await sendReviewInvitation(order.id, { manual: true });
            if (res?.ok) toast.success(res.message || 'Bewertungseinladung versendet');
            else toast.error(res?.message || 'Bewertungseinladung fehlgeschlagen');
          },
        }] : []),
        {
          key: 'trigger-order', label: 'Bestellung auslösen', icon: ShoppingBag,
          onClick: () => navigate(`/order/neu?order_id=${order.id}`),
        },
        { key: 'defer', label: 'Zurückstellen', icon: CalendarClock, onClick: () => setDeferOpen(true) },
      ] as ActionItem[],
    }] : []),
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate(order.source_system === 'zoho_eu_2' ? '/auftraege-at' : '/auftraege')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> {order.source_system === 'zoho_eu_2' ? 'Zurück zu Aufträge AT' : 'Zurück zur Auftragsliste'}
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3 flex-wrap">
            {isOrderVip({ ...order, customers: customer }) && <VipBadge size="lg" />}
            {primaryDisplayNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            {' · '}<span>{sourceFlag(order.source_system)} {sourceLabel(order.source_system)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {canWrite && order.order_status === 'teilgeliefert' && (
            restPending ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                In „Bestellung möglich"
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                onClick={async () => {
                  const { error } = await createRestbestellungMarker(order.id);
                  if (error) { toast.error('Fehler: ' + error); return; }
                  toast.success('Restbestellung in „Bestellung möglich" übernommen');
                  setRestPending(true);
                }}
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Restbestellung erzeugen
              </Button>
            )
          )}
          {/* Headless mounts für Aktionen aus den Menüs */}
          <SepaMandatButton ref={sepaRef} order={order} hideTrigger />
          <MietkaufDialog ref={mietkaufRef} order={order} hideTrigger />
          <InstallmentPlanDialog ref={ratenplanRef} order={order} hideTrigger />
          <StatusBadge status={order.order_status || 'offen'} />
        </div>
      </div>


      {/* Tabs */}
      <div className="flex flex-wrap items-stretch gap-x-1 gap-y-1 mb-6 border-b border-border">
        {(() => {
          const overviewActive = activeTab === overviewTab.key;
          const OvIcon = overviewTab.icon;
          return (
            <button
              key={overviewTab.key}
              data-tab-key={overviewTab.key}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                overviewActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab(overviewTab.key as any)}
            >
              <OvIcon className="w-4 h-4" />
              <span>{overviewTab.label}</span>
            </button>
          );
        })()}
        {(() => {
          const renderTabMenu = (menu: { name: string; icon: any; tabs: any[] }) => {
            const activeChild = menu.tabs.find((t) => t.key === activeTab);
            const isActive = !!activeChild;
            const MIcon = menu.icon;
            return (
              <DropdownMenu key={`tab-${menu.name}`}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px outline-none ${
                      isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MIcon className="w-4 h-4" />
                    <span>{menu.name}{activeChild ? ` · ${activeChild.label}` : ''}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[220px]">
                  {menu.tabs.map((t: any) => {
                    const TIcon = t.icon;
                    const active = activeTab === t.key;
                    return (
                      <DropdownMenuItem
                        key={t.key}
                        data-tab-key={t.key}
                        onSelect={() => setActiveTab(t.key as any)}
                        className={active ? 'bg-primary/10 text-primary focus:bg-primary/15 focus:text-primary' : ''}
                      >
                        <TIcon className="w-4 h-4 mr-2" />
                        <span className="flex-1">{t.label}</span>
                        {typeof t.count === 'number' && (
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full ml-2 ${active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>{t.count}</span>
                        )}
                        {t.badge && <span className="text-emerald-400 text-xs ml-2">{t.badge}</span>}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          };

          const renderActionMenu = (name: 'Backoffice' | 'Bearbeitung') => {
            const am = actionMenus.find((m) => m.name === name);
            if (!am || am.items.length === 0) return null;
            const AMIcon = am.icon;
            return (
              <DropdownMenu key={`act-${am.name}`}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px outline-none border-transparent text-muted-foreground hover:text-foreground">
                    <AMIcon className="w-4 h-4" />
                    <span>{am.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[240px]">
                  {am.items.map((it) => {
                    const ItIcon = it.icon;
                    return (
                      <DropdownMenuItem
                        key={it.key}
                        disabled={it.disabled}
                        title={it.title}
                        onSelect={(e) => { e.preventDefault(); it.onClick(); }}
                      >
                        <ItIcon className="w-4 h-4 mr-2" />
                        <span className="flex-1">{it.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          };

          const artikel = tabMenus.find((m) => m.name === 'Artikel');
          const auftrag = tabMenus.find((m) => m.name === 'Auftrag');
          const kommunikation = tabMenus.find((m) => m.name === 'Kommunikation');

          return (
            <>
              {renderActionMenu('Bearbeitung')}
              {artikel && renderTabMenu(artikel)}
              {auftrag && renderTabMenu(auftrag)}
              {renderActionMenu('Backoffice')}
              {kommunikation && renderTabMenu(kommunikation)}
            </>
          );
        })()}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" /> Auftragsdaten
            </h2>
            <dl className="space-y-3 text-sm">
              {[
                ['Auftragsnummer', displayOrderNumbers.join(', ')],
                ['Rechnungsnummer', displayOrderNumbers.join(', ')],
                ['Status', order.order_status || 'offen'],
                ['Betrag', order.total_amount != null ? Number(order.total_amount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' }) : '—'],
                ['Währung', order.currency],
                ['Bestelldatum', order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : '—'],
                ['Quelle', `${sourceFlag(order.source_system)} ${sourceLabel(order.source_system)}`.trim()],
                ['Ext. Auftrags-ID', order.external_order_id],
                ['Intern Nummer', order.internal_number],
                ['Erstellt', new Date(order.created_at).toLocaleString('de-DE')],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="text-foreground font-medium">{(v as string) || '—'}</dd>
                </div>
              ))}
              {/* Editable Expected Shipment Date */}
              <div className="flex justify-between items-center">
                <dt className="text-muted-foreground">Erw. Versanddatum</dt>
                <dd className="flex items-center gap-2">
                  {editingShipDate ? (
                    <>
                      <Input
                        type="date"
                        value={shipDateValue}
                        onChange={e => setShipDateValue(e.target.value)}
                        className="h-7 w-40 text-sm bg-secondary border-border"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                        const val = shipDateValue || null;
                        const { error } = await supabase.from('orders').update({ expected_shipment_date: val }).eq('id', id!);
                        if (error) { toast.error('Fehler beim Speichern'); return; }
                        setOrder({ ...order, expected_shipment_date: val });
                        setEditingShipDate(false);
                        toast.success('Versanddatum aktualisiert');
                      }}>
                        <Check className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingShipDate(false)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground font-medium">
                        {order.expected_shipment_date ? new Date(order.expected_shipment_date).toLocaleDateString('de-DE') : '—'}
                      </span>
                      {canWrite && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => {
                          setShipDateValue(order.expected_shipment_date ? new Date(order.expected_shipment_date).toISOString().split('T')[0] : '');
                          setEditingShipDate(true);
                        }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 card-glow">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" /> Kundendaten
            </h2>
            {customer ? (
              <>
                <dl className="space-y-3 text-sm">
                  {[
                    ['Firma', customer.company_name],
                    ['Kontakt', customer.contact_name],
                    ['E-Mail', customer.email],
                    ['Telefon', customer.phone],
                    ['IBAN', customer.iban],
                    ['BIC', customer.bic],
                    ['Bank', customer.bank_name],
                    ['Rechnungsadresse', formatAddr(customer.billing_address)],
                    ['Lieferadresse', formatAddr(customer.shipping_address)],
                  ].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between">
                      <dt className="text-muted-foreground">{l}</dt>
                      <dd className="text-foreground font-medium text-right max-w-[60%]">{(v as string) || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <Button variant="ghost" className="mt-4 text-primary text-sm" onClick={() => navigate(`/kunden/${customer.id}`)}>
                  Kunde anzeigen →
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Keine Kundendaten verfügbar.</p>
            )}
          </div>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Artikelpositionen
            </h2>
            {hasRole('Super Admin') && (
              <Button size="sm" variant="outline" onClick={() => setItemsEditOpen(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Positionen bearbeiten
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Artikel vorhanden.</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Menge</TableHead>
                    <TableHead>Einheit</TableHead>
                    <TableHead className="text-right">Einzelpreis</TableHead>
                    <TableHead className="text-right">Rabatt</TableHead>
                    <TableHead className="text-right">Steuer</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.item_name || '—'}</div>
                        {item.description && <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{item.description}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.sku || '—'}</TableCell>
                      <TableCell className="text-right">{item.quantity != null ? Number(item.quantity).toLocaleString('de-DE') : '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.unit || '—'}</TableCell>
                      <TableCell className="text-right">{item.rate != null ? Number(item.rate).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' }) : '—'}</TableCell>
                      <TableCell className="text-right">{item.discount != null && Number(item.discount) > 0 ? Number(item.discount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' }) : '—'}</TableCell>
                      <TableCell className="text-right">{item.tax_amount != null && Number(item.tax_amount) > 0 ? Number(item.tax_amount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' }) : '—'}</TableCell>
                      <TableCell className="text-right font-medium">{item.amount != null ? Number(item.amount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' }) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <div className="text-sm font-medium text-foreground">
                  Gesamt: {items.reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seriennummer Tab */}
      {activeTab === 'serials' && (
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Hash className="w-4 h-4 text-primary" /> Gelieferte Geräte · Seriennummern
            <span className="text-xs font-normal text-muted-foreground ml-2">({serialDevices.length})</span>
          </h2>
          {serialDevices.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Diesem Auftrag sind aktuell keine Geräte mit Seriennummer zugeordnet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seriennummer</TableHead>
                  <TableHead>Modell</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Zuordnung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serialDevices.map((d) => {
                  const statusMatch = /\[Status:\s*([^\]]+)\]/.exec(d.notes ?? '');
                  const status = statusMatch?.[1]?.trim() || '—';
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.serial_number}</TableCell>
                      <TableCell>{d.model_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-border bg-secondary/50">
                          {status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {d.updated_at ? new Date(d.updated_at).toLocaleDateString('de-DE') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Anzahlung Tab */}
      {activeTab === 'deposit' && (
        <div className="rounded-xl border border-border bg-card p-6 card-glow max-w-3xl">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Euro className="w-4 h-4 text-primary" /> Anzahlung
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={depositOk}
                onCheckedChange={v => setDepositOk(!!v)}
                disabled={!canWriteDeposit}
              />
              <span className="text-sm font-semibold tracking-wide">ANZAHLUNG OK</span>
            </label>
            {depositOk && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Mitarbeiter (Name)</Label>
                  <Input
                    value={depositBy}
                    onChange={e => setDepositBy(e.target.value)}
                    placeholder="Name des Mitarbeiters"
                    disabled={!canWriteDeposit}
                    className="bg-secondary border-border mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Buchungsdatum</Label>
                  <Input
                    type="date"
                    value={depositBookingDate}
                    onChange={e => setDepositBookingDate(e.target.value)}
                    disabled={!canWriteDeposit}
                    className="bg-secondary border-border mt-1"
                  />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">BETRAG</Label>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="0,00"
                disabled={!canWriteDeposit}
                className="bg-secondary border-border mt-1 max-w-[240px]"
              />
            </div>

            {order.deposit_ok_at && (
              <p className="text-xs text-muted-foreground">
                Zuletzt bestätigt: {new Date(order.deposit_ok_at).toLocaleString('de-DE')}
                {order.deposit_ok_by ? ` · ${order.deposit_ok_by}` : ''}
              </p>
            )}
            {canWriteDeposit && (
              <div className="flex justify-end pt-2">
                <Button onClick={saveDeposit} disabled={savingDeposit} className="gold-gradient text-primary-foreground">
                  {savingDeposit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Speichern
                </Button>
              </div>
            )}

            {/* Weitere Anzahlungen */}
            <div className="pt-4 mt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide">Weitere Anzahlungen</h3>
                <span className="text-xs text-muted-foreground">{additionalDeposits.length} Eintrag(e)</span>
              </div>

              {additionalDeposits.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine weiteren Anzahlungen erfasst.</p>
              ) : (
                <div className="space-y-2">
                  {additionalDeposits.map(d => (
                    <div key={d.id} className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2">
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Betrag</div>
                          <div className="font-semibold">{Number(d.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Datum</div>
                          <div>{new Date(d.booking_date).toLocaleDateString('de-DE')}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Geleistet</div>
                          {canWriteDeposit ? (
                            <Select value={d.geleistet ? 'ja' : 'nein'} onValueChange={v => toggleDepositGeleistet(d.id, v === 'ja')}>
                              <SelectTrigger className="h-8 bg-secondary border-border mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ja">Ja</SelectItem>
                                <SelectItem value="nein">Nein</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className={d.geleistet ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>{d.geleistet ? 'Ja' : 'Nein'}</div>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase text-muted-foreground">Notiz</div>
                          <div className="truncate" title={d.note || ''}>{d.note || '—'}</div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => deleteAdditionalDeposit(d.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canWriteDeposit && (
                <div className="rounded-md border border-dashed border-border p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Betrag *</Label>
                      <Input type="number" step="0.01" value={newAddAmount} onChange={e => setNewAddAmount(e.target.value)} placeholder="0,00" className="bg-secondary border-border mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Datum *</Label>
                      <Input type="date" value={newAddDate} onChange={e => setNewAddDate(e.target.value)} className="bg-secondary border-border mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Geleistet</Label>
                      <Select value={newAddGeleistet} onValueChange={v => setNewAddGeleistet(v as 'ja' | 'nein')}>
                        <SelectTrigger className="bg-secondary border-border mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ja">Ja</SelectItem>
                          <SelectItem value="nein">Nein</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Notiz</Label>
                      <Input value={newAddNote} onChange={e => setNewAddNote(e.target.value)} placeholder="optional" className="bg-secondary border-border mt-1" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addAdditionalDeposit} disabled={addingDeposit} className="gold-gradient text-primary-foreground">
                      {addingDeposit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Anzahlung hinzufügen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financing Tab */}
      {activeTab === 'financing' && id && (
        <BankFinancingTab orderId={id} />
      )}

      {/* Einkauf AT Tab */}
      {activeTab === 'at_purchase' && id && canSeeAtPurchase && (
        <AtPurchaseTab orderId={id} />
      )}

      {/* Freigabe AT Tab */}
      {activeTab === 'at_approval' && id && canSeeAtApproval && (
        <AtApprovalTab orderId={id} />
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-primary" /> Pakete & Sendungen
          </h2>
          {packages.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Pakete vorhanden.</p>
              <p className="text-xs text-muted-foreground mt-1">Pakete werden täglich um 23:32 aus Zoho Books synchronisiert.</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paket-Nr.</TableHead>
                    <TableHead>Sendung</TableHead>
                    <TableHead>Menge</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Versand</TableHead>
                    <TableHead>Lieferung</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((p: any) => {
                    const so = p.shipment_order || {};
                    const tracking = p.tracking_number || so.tracking_number;
                    const trackingUrl = so.tracking_url;
                    const status = (p.shipment_status || p.status || '').toString();
                    return (
                      <TableRow key={p.package_id}>
                        <TableCell className="font-medium text-foreground">{p.package_number || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.shipment_number || '—'}</TableCell>
                        <TableCell className="text-right">{p.quantity != null ? Number(p.quantity).toLocaleString('de-DE') : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.date ? new Date(p.date).toLocaleDateString('de-DE') : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.shipment_date ? new Date(p.shipment_date).toLocaleDateString('de-DE') : '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{so.delivery_date_with_time || so.delivery_date || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.carrier || p.delivery_method || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {tracking ? (
                            trackingUrl ? <a href={trackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{tracking}</a> : tracking
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400' :
                            status === 'shipped' ? 'bg-blue-500/10 text-blue-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {status === 'delivered' ? 'Geliefert' : status === 'shipped' ? 'Versendet' : (status || '—')}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'confirmation' && (
        <OrderConfirmationTab order={order} customer={customer} items={items} />
      )}

      {activeTab === 'lieferschein' && (
        <DeliveryNoteTab order={order} customer={customer} items={items} onReload={loadAll} />
      )}

      {activeTab === 'auftragsbestaetigung' && id && (
        <AuftragsbestaetigungTab
          orderId={id}
          customerId={order?.customer_id ?? null}
          customerEmail={customer?.email ?? null}
        />
      )}

      {activeTab === 'az_invoice' && (
        <AzInvoiceTab order={order} customer={customer} items={items} onReload={loadAll} />
      )}





      {activeTab === 'notes' && (
        <div className="space-y-4">
          {canWrite && (
            <div className="rounded-xl border border-border bg-card p-4 card-glow">
              <h3 className="text-sm font-medium text-foreground mb-3">Neue Notiz</h3>
              <div className="flex gap-3 mb-3">
                <Select value={newNoteType} onValueChange={setNewNoteType}>
                  <SelectTrigger className="w-40 bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Allgemein</SelectItem>
                    <SelectItem value="internal">Intern</SelectItem>
                    <SelectItem value="customer">Kunde</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="Notiz eingeben..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                className="bg-secondary border-border mb-3"
                rows={3}
              />
              <Button onClick={submitNote} disabled={!newNote.trim() || submitting} size="sm" className="gold-gradient text-primary-foreground">
                <Send className="w-4 h-4 mr-2" /> {submitting ? 'Speichern...' : 'Notiz hinzufügen'}
              </Button>
            </div>
          )}

          {generalNotes.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Notizen vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {generalNotes.map(n => (
                <div key={n.id} className="rounded-xl border border-border bg-card p-4 card-glow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{n.note_type || 'general'}</span>
                      <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('de-DE')}</span>
                    </div>
                    {(n.created_by === user?.id || isAdmin) && canWrite && editNoteId !== n.id && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditNoteId(n.id); setEditNoteText(n.note_text); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {editNoteId === n.id ? (
                    <div>
                      <Textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} className="bg-secondary border-border mb-2" rows={3} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEditNote} className="gold-gradient text-primary-foreground"><Check className="w-3.5 h-3.5 mr-1" /> Speichern</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditNoteId(null)}><X className="w-3.5 h-3.5 mr-1" /> Abbrechen</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap">{n.note_text}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* E-Mails Tab */}
      {activeTab === 'emails' && (
        <div>
          {canWrite && (
            <div className="rounded-xl border border-border bg-card p-4 card-glow mb-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Sendet die Voravisierungs-E-Mail an <span className="font-medium text-foreground">{customer?.email || '— keine Kunden-E-Mail —'}</span>. Inhalt unter Operation → E-Mail Vorlagen anpassbar.
              </div>
              <Button
                size="sm"
                disabled={sendingEmail || !customer?.email}
                onClick={async () => {
                  setSendingEmail(true);
                  const r = await sendCustomerShippingNotice(order.id, undefined, 'manuell', 'customer_shipping_notice');
                  setSendingEmail(false);
                  if (r.ok) { toast.success(r.message); loadAll(); }
                  else toast.error(r.message);
                }}
                className="gold-gradient text-primary-foreground"
              >
                {sendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                E-Mail an Kunde senden
              </Button>
            </div>
          )}
          {emailNotes.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Noch keine E-Mails an den Kunden versendet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailNotes.map(n => (
                <div key={n.id} className="rounded-xl border border-border bg-card p-4 card-glow">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">E-Mail</span>
                    <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('de-DE')}</span>
                  </div>
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{n.note_text}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SMS Versand Tab */}
      {activeTab === 'sms' && customer && (
        <CustomerSmsTab customer={customer} orderId={order.id} />
      )}



      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {history.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Statusänderungen vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="rounded-xl border border-border bg-card p-4 card-glow flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <History className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.old_status && (
                        <>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">{h.old_status}</span>
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      <StatusBadge status={h.new_status} />
                    </div>
                    {h.change_note && <p className="text-sm text-muted-foreground mt-1">{h.change_note}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(h.created_at).toLocaleString('de-DE')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw Data Tab (Admin only) */}
      {activeTab === 'raw' && isAdmin && (
        <div className="rounded-xl border border-border bg-card p-6 card-glow">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" /> Rohdaten
          </h2>
          <pre className="text-xs text-muted-foreground bg-secondary rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap">
            {order.raw_data ? JSON.stringify(order.raw_data, null, 2) : 'Keine Rohdaten vorhanden.'}
          </pre>
        </div>
      )}

      {editOpen && order && (
        <OrderEditDialog order={order} open onClose={() => setEditOpen(false)} onSaved={loadAll} />
      )}
      {itemsEditOpen && order && (
        <OrderItemsEditDialog
          orderId={order.id}
          orderNumber={order.order_number}
          open
          onClose={() => setItemsEditOpen(false)}
          onSaved={loadAll}
        />
      )}

      {deferOpen && order && (
        <OrderDeferDialog order={order} open onClose={() => setDeferOpen(false)} onSaved={loadAll} />
      )}
    </div>
  );
}
