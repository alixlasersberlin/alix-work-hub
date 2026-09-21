import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Banknote, CalendarClock, CheckCircle2, FileText, Gavel, History, Landmark, Loader2, Lock,
  Mail, MessageSquare, RefreshCw, Search, Send, ShieldAlert, StickyNote, Undo2, Unlock, Wallet, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';
import { cn } from '@/lib/utils';

type OpenItem = {
  id: string;
  invoice_number: string | null;
  legal_invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  paid: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  zoho_invoice_id: string | null;
  source_system: string | null;
  days_overdue: number | null;
  dunning_level: number | null;
  last_action_at: string | null;
  last_action: string | null;
  case_active: boolean | null;
  case_reason: string | null;
  case_note: string | null;
  case_pause_until: string | null;
  plan_id: string | null;
  plan_installments: number | null;
  next_rate_amount: number | null;
  next_rate_due: string | null;
  next_action_level: number | null;
  escalation_stage: string | null;
  escalation_at: string | null;
  escalation_note: string | null;
};

type Filter = 'alle' | 'heute' | 'ueberfaellig' | 'teilbezahlt' | 'mahnung' | 'klaerung' | 'raten' | 'anwalt' | 'inkasso';
type Tab = 'arbeitsliste' | 'anzahlungen' | 'mahncenter' | 'bank';

/** Offene Anzahlung (finance_deposits) – reine Anzeige, keine Buchungen in FIBU LIGHT. */
type DepositRow = {
  id: string;
  deposit_number: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  order_number: string | null;
  currency: string | null;
  gross_amount: number | null;
  paid_amount: number | null;
  open_amount: number | null;
  due_date: string | null;
  status: string | null;
};


const ESC_LABEL: Record<string, string> = { anwalt: 'Anwalt', inkasso_intern: 'Internes Inkasso' };

const LEVEL_LABEL: Record<number, string> = {
  0: 'Keine Mahnung',
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
  4: 'Letzte Mahnung',
};

const CASE_REASONS = [
  'Reklamation', 'Ratenzahlung', 'Zahlung nicht zuordenbar', 'Gutschrift erwartet',
  'Rechtsfall', 'Interne Prüfung', 'Sonstiges',
];

const fmt = (n: number | null | undefined, currency?: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(Number(n || 0));

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('de-DE') : '—';

const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString('de-DE') : '—');

const invNo = (i: OpenItem) => i.legal_invoice_number || i.invoice_number || '—';

const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: any; error: any }>)(name, args);

/** Lädt eine set-returning RPC vollständig (PostgREST liefert max. 1000 Zeilen pro Anfrage). */
async function rpcAll(name: string, args?: Record<string, unknown>) {
  const CHUNK = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += CHUNK) {
    const q = (supabase.rpc as any)(name, args).range(from, from + CHUNK - 1);
    const { data, error } = await q;
    if (error) return { data: out, error };
    const rows = (data as any[]) || [];
    out.push(...rows);
    if (rows.length < CHUNK) break;
  }
  return { data: out, error: null as any };
}


/** Ampel: reine Arbeitskennzeichnung, verändert keine Buchhaltungsdaten. */
type Light = { key: string; label: string; dot: string; text: string };
function trafficLight(i: OpenItem): Light {
  if (i.case_active) return { key: 'grau', label: 'Klärung / Mahnsperre', dot: 'bg-muted-foreground', text: 'text-muted-foreground' };
  const od = i.days_overdue ?? 0;
  if (Number(i.paid || 0) > 0 && od <= 14) return { key: 'blau', label: 'Teilzahlung', dot: 'bg-blue-500', text: 'text-blue-500' };
  if (od <= 0) return { key: 'gruen', label: 'Nicht fällig', dot: 'bg-emerald-500', text: 'text-emerald-500' };
  if (od <= 7) return { key: 'gelb', label: `${od} Tage überfällig`, dot: 'bg-amber-400', text: 'text-amber-500' };
  if (od <= 14) return { key: 'orange', label: `${od} Tage überfällig`, dot: 'bg-orange-500', text: 'text-orange-500' };
  return { key: 'rot', label: `${od} Tage überfällig`, dot: 'bg-destructive', text: 'text-destructive' };
}

/** Letzte gesendete E-Mail je Rechnung inkl. Lesesignal (1x1-Pixel). */
type LastMail = {
  invoice_id: string;
  sent_at: string | null;
  level: number | null;
  subject: string | null;
  recipient_email: string | null;
  send_status: string | null;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number | null;
};

export default function OffenePostenLight() {
  const [items, setItems] = useState<OpenItem[]>([]);
  const [lastMails, setLastMails] = useState<Record<string, LastMail>>({});
  const [rules, setRules] = useState<{ level: number; label: string; offset_days: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('arbeitsliste');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [selected, setSelected] = useState<OpenItem | null>(null);
  const [history, setHistory] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [bankKpi, setBankKpi] = useState<Record<string, number>>({});

  // Zahlung
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState('Bank');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  // Schnellbuchung
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  // Mahnung
  const [dunOpen, setDunOpen] = useState(false);
  const [dunLevel, setDunLevel] = useState(1);
  const [dunEmail, setDunEmail] = useState('');
  const [dunMessage, setDunMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Mahncenter
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<{ item: OpenItem; level: number; email: string }[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Klärung
  const [caseOpen, setCaseOpen] = useState(false);
  const [caseReason, setCaseReason] = useState(CASE_REASONS[0]);
  const [caseNote, setCaseNote] = useState('');
  const [casePause, setCasePause] = useState('');
  const [caseBusy, setCaseBusy] = useState(false);

  // Raten
  const [rateOpen, setRateOpen] = useState(false);
  const [rateCount, setRateCount] = useState('4');
  const [rateAmount, setRateAmount] = useState('');
  const [rateFirst, setRateFirst] = useState(() => new Date().toISOString().slice(0, 10));
  const [rateInterval, setRateInterval] = useState('1');
  const [rateNote, setRateNote] = useState('');
  const [rateBusy, setRateBusy] = useState(false);

  // Buchungsfehler
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [issueBusy, setIssueBusy] = useState(false);

  // Bank-Vorschläge (Vorbereitung Phase 3)
  const [bankRows, setBankRows] = useState<any[]>([]);
  const [bankLoading, setBankLoading] = useState(false);

  // Notiz
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Eskalation (Anwalt / internes Inkasso)
  const [listChecked, setListChecked] = useState<Record<string, boolean>>({});
  const [escOpen, setEscOpen] = useState(false);
  const [escStage, setEscStage] = useState<'anwalt' | 'inkasso_intern'>('anwalt');
  const [escNote, setEscNote] = useState('');
  const [escRows, setEscRows] = useState<OpenItem[]>([]);
  const [escBusy, setEscBusy] = useState(false);

  // E-Mail an markierte Kunden (Vorlage oder freier Text)
  const [mailOpen, setMailOpen] = useState(false);
  const [mailRows, setMailRows] = useState<{ item: OpenItem; email: string }[]>([]);
  const [mailMode, setMailMode] = useState<'vorlage' | 'frei'>('vorlage');
  const [mailLevel, setMailLevel] = useState(1);
  const [mailText, setMailText] = useState('');
  const [mailBusy, setMailBusy] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsRows, setSmsRows] = useState<{ item: OpenItem; phone: string }[]>([]);
  const [smsText, setSmsText] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);


  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfCache = useRef<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, rulesRes, bankRes] = await Promise.all([
      rpcAll('fibu_light_open_items'),
      supabase.from('op_light_dunning_rules' as any).select('level,label,offset_days').order('level'),
      rpc('fibu_light_bank_dashboard'),
    ]);
    if (!bankRes.error) setBankKpi((bankRes.data as Record<string, number>) || {});
    if (error) {
      toast.error(`Offene Posten konnten nicht geladen werden: ${error.message}`);
      setItems([]);
      setLastMails({});
    } else {
      const rows = (data as OpenItem[]) || [];
      setItems(rows);
      const ids = rows.map((r) => r.id).filter(Boolean);
      if (ids.length) {
        const { data: mails } = await rpcAll('fibu_light_last_emails', { p_invoice_ids: ids });
        const map: Record<string, LastMail> = {};
        for (const m of ((mails as LastMail[]) || [])) map[m.invoice_id] = m;
        setLastMails(map);
      } else {
        setLastMails({});
      }
    }
    setRules(((rulesRes.data as any[]) || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    const { data, error } = await rpc('fibu_light_bank_match_suggestions', { p_limit: 25 });
    if (error) toast.error(error.message);
    setBankRows((data as any[]) || []);
    setBankLoading(false);
  }, []);

  useEffect(() => { if (tab === 'bank' && bankRows.length === 0) void loadBank(); }, [tab, bankRows.length, loadBank]);

  // Offene Anzahlungen – separat, reine Anzeige
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const loadDeposits = useCallback(async () => {
    setDepositsLoading(true);
    const { data, error } = await supabase
      .from('finance_deposits' as any)
      .select('id,deposit_number,customer_name,invoice_number,order_number,currency,gross_amount,paid_amount,open_amount,due_date,status')
      .gt('open_amount', 0.009)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(2000);
    if (error) toast.error(`Anzahlungen konnten nicht geladen werden: ${error.message}`);
    setDeposits(((data as any[]) || []) as DepositRow[]);
    setDepositsLoading(false);
  }, []);

  useEffect(() => { if (tab === 'anzahlungen' && deposits.length === 0) void loadDeposits(); }, [tab, deposits.length, loadDeposits]);

  const depositsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deposits;
    return deposits.filter((d) =>
      [d.customer_name, d.deposit_number, d.invoice_number, d.order_number]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [deposits, search]);

  const depositsSum = useMemo(
    () => depositsFiltered.reduce((s, d) => s + Number(d.open_amount || 0), 0),
    [depositsFiltered],
  );


  const loadHistory = useCallback(async (invoiceId: string) => {
    setHistoryLoading(true);
    const { data, error } = await rpc('fibu_light_invoice_history', { p_invoice_id: invoiceId });
    if (error) toast.error(error.message);
    setHistory(error ? null : data);
    setHistoryLoading(false);
  }, []);

  const openPanel = useCallback((item: OpenItem) => {
    setSelected(item);
    setNote('');
    setHistory(null);
    void loadHistory(item.id);
  }, [loadHistory]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let open = 0, overdue = 0, dueToday = 0, partial = 0, dunning = 0;
    for (const i of items) {
      const bal = Number(i.balance || 0);
      open += bal;
      if ((i.days_overdue ?? 0) > 0) overdue += bal;
      if (i.due_date === today) dueToday += bal;
      if (Number(i.paid || 0) > 0) partial += 1;
      if (!i.case_active && Number(i.next_action_level || 0) > 0) dunning += 1;
    }
    return { open, overdue, dueToday, partial, dunning };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((i) => {
      if (q) {
        const hay = [i.customer_name, i.invoice_number, i.legal_invoice_number, i.id, i.customer_id]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case 'heute': return i.due_date === today;
        case 'ueberfaellig': return (i.days_overdue ?? 0) > 0 && !i.case_active;
        case 'teilbezahlt': return Number(i.paid || 0) > 0;
        case 'mahnung': return !i.case_active && Number(i.next_action_level || 0) > 0;
        case 'klaerung': return !!i.case_active;
        case 'raten': return !!i.plan_id;
        case 'anwalt': return i.escalation_stage === 'anwalt';
        case 'inkasso': return i.escalation_stage === 'inkasso_intern';
        // „Alle“ zeigt nur Posten, die noch nicht an Anwalt oder internes Inkasso übergeben wurden.
        default: return !i.escalation_stage;
      }
    });
  }, [items, search, filter]);

  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [page, setPage] = useState(1);
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = useMemo(() => {
    if (pageSize === 'all') return filtered;
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safePage]);
  useEffect(() => { setPage(1); }, [search, filter]);

  const dunningItems = useMemo(
    () => items.filter((i) => !i.case_active && Number(i.next_action_level || 0) > 0),
    [items],
  );

  const dunningGroups = useMemo(() => {
    const g: Record<number, OpenItem[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const i of dunningItems) g[Number(i.next_action_level)]?.push(i);
    return g;
  }, [dunningItems]);

  const checkedItems = useMemo(
    () => dunningItems.filter((i) => checked[i.id]),
    [dunningItems, checked],
  );

  const resolveEmailByName = useCallback(async (raw: string | null | undefined): Promise<string> => {
    const name = raw?.trim();
    if (!name) return '';
    const { data } = await supabase.from('customers')
      .select('email, company_name, contact_name')
      .or(`company_name.ilike.${name},contact_name.ilike.${name}`)
      .limit(1);
    return ((data as any[])?.[0]?.email as string) || '';
  }, []);

  const resolvePhoneByName = useCallback(async (raw: string | null | undefined): Promise<string> => {
    const name = raw?.trim();
    if (!name) return '';
    const { data } = await supabase.from('customers')
      .select('phone, company_name, contact_name')
      .or(`company_name.ilike.${name},contact_name.ilike.${name}`)
      .limit(1);
    return ((data as any[])?.[0]?.phone as string) || '';
  }, []);

  const resolveEmail = useCallback(
    (item: OpenItem) => resolveEmailByName(item.customer_name), [resolveEmailByName]);

  /** Mobilnummer des Kunden für den SMS-Versand ermitteln. */
  const resolvePhone = useCallback(
    (item: OpenItem) => resolvePhoneByName(item.customer_name), [resolvePhoneByName]);

  // ---- Anzahlungen: Markierung, E-Mail- und SMS-Versand (reine Erinnerung, keine Buchung) ----
  const depMarked = useMemo(
    () => depositsFiltered.filter((d) => depChecked[d.id]), [depositsFiltered, depChecked]);
  const depMarkedSum = useMemo(
    () => depMarked.reduce((s, d) => s + Number(d.open_amount || 0), 0), [depMarked]);
  const depNo = (d: DepositRow) => d.deposit_number || d.invoice_number || d.order_number || '—';

  const openDepMail = async () => {
    if (depMarked.length === 0) { toast.error('Bitte zuerst Anzahlungen markieren.'); return; }
    setDepMailBusy(true);
    const prepared: { row: DepositRow; email: string }[] = [];
    for (const d of depMarked) prepared.push({ row: d, email: await resolveEmailByName(d.customer_name) });
    setDepMailRows(prepared);
    setDepMailText('');
    setDepMailBusy(false);
    setDepMailOpen(true);
  };

  const sendDepMails = async () => {
    setDepMailBusy(true);
    let ok = 0, fail = 0, skipped = 0;
    for (const r of depMailRows) {
      if (!r.email.includes('@')) { skipped += 1; continue; }
      try {
        const { data, error } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'finance-reminder',
            recipientEmail: r.email,
            templateData: {
              customerName: r.row.customer_name,
              level: 1,
              amount: Number(r.row.open_amount || 0),
              total: Number(r.row.open_amount || 0),
              dueDate: r.row.due_date,
              items: [{
                invoice_number: depNo(r.row),
                amount: Number(r.row.open_amount || 0),
                due_date: r.row.due_date,
                days_overdue: 0,
              }],
              note: depMailText.trim() || undefined,
            },
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        ok += 1;
      } catch { fail += 1; }
    }
    setDepMailBusy(false);
    setDepMailOpen(false);
    setDepChecked({});
    toast[fail ? 'warning' : 'success'](`E-Mail versendet: ${ok} · Fehlgeschlagen: ${fail} · Ohne Adresse: ${skipped}`);
  };

  const openDepSms = async () => {
    if (depMarked.length === 0) { toast.error('Bitte zuerst Anzahlungen markieren.'); return; }
    setDepSmsBusy(true);
    const prepared: { row: DepositRow; phone: string }[] = [];
    for (const d of depMarked) prepared.push({ row: d, phone: await resolvePhoneByName(d.customer_name) });
    setDepSmsRows(prepared);
    setDepSmsText('Alix Lasers: Bitte gleichen Sie Ihre offene Anzahlung {nummer} über {betrag} kurzfristig aus. Vielen Dank.');
    setDepSmsBusy(false);
    setDepSmsOpen(true);
  };

  const sendDepSms = async () => {
    if (!depSmsText.trim()) { toast.error('Bitte einen Text für die SMS eingeben.'); return; }
    setDepSmsBusy(true);
    let ok = 0, fail = 0, skipped = 0;
    for (const r of depSmsRows) {
      const phone = r.phone.trim();
      if (phone.replace(/\D/g, '').length < 7) { skipped += 1; continue; }
      const message = depSmsText
        .replace(/\{nummer\}/g, depNo(r.row))
        .replace(/\{betrag\}/g, fmt(r.row.open_amount, r.row.currency))
        .replace(/\{kunde\}/g, r.row.customer_name ?? '');
      try {
        const { data, error } = await supabase.functions.invoke('op-light-send-sms', {
          body: { to: phone, message },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        ok += 1;
      } catch { fail += 1; }
    }
    setDepSmsBusy(false);
    setDepSmsOpen(false);
    setDepChecked({});
    toast[fail ? 'warning' : 'success'](`SMS versendet: ${ok} · Fehlgeschlagen: ${fail} · Ohne Nummer: ${skipped}`);
  };

  const openPdf = useCallback(async (item: OpenItem) => {
    if (!item.zoho_invoice_id) { toast.error('Für diese Rechnung ist kein PDF hinterlegt.'); return; }
    const cached = pdfCache.current.get(item.id);
    if (cached) { window.open(cached, '_blank'); return; }
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('zoho-invoice-pdf', {
        body: { zoho_invoice_id: item.zoho_invoice_id, source_system: item.source_system ?? 'zoho_eu_1' },
      });
      if (error) throw error;
      const b64 = (data as any)?.pdf_base64;
      if (!b64) throw new Error('Kein PDF erhalten');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      pdfCache.current.set(item.id, url);
      window.open(url, '_blank');
    } catch (e: any) {
      toast.error(`PDF konnte nicht geladen werden: ${e?.message ?? e}`);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const startPayment = (item: OpenItem) => {
    setSelected(item);
    setPayAmount(String(Number(item.balance || 0).toFixed(2)));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod('Bank');
    setPayRef(invNo(item));
    setPayNote('');
    setQuickOpen(false);
    setPayOpen(true);
  };

  const bookPayment = async (full: boolean) => {
    if (!selected) return;
    setPaying(true);
    try {
      const { data, error } = await rpc('fibu_light_book_payment', {
        p_invoice_id: selected.id,
        p_amount: full ? Number(selected.balance || 0) : Number(payAmount.replace(',', '.')),
        p_payment_date: payDate,
        p_method: payMethod,
        p_reference: payRef || null,
        p_note: payNote || null,
        p_full: full,
      });
      if (error) throw error;
      const res = data as any;
      toast.success(res?.closed
        ? 'Zahlung gebucht – offener Posten geschlossen.'
        : `Teilzahlung gebucht. Offen: ${fmt(res?.new_balance, selected.currency)}`);
      setPayOpen(false);
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(`Zahlung konnte nicht gebucht werden: ${e?.message ?? e}`);
    } finally {
      setPaying(false);
    }
  };

  const startDunning = async (item: OpenItem, level: number) => {
    setSelected(item);
    setDunLevel(level);
    setDunMessage('');
    setDunEmail('');
    setDunOpen(true);
    const mail = await resolveEmail(item);
    if (mail) setDunEmail(mail);
  };

  const sendDunningFor = useCallback(async (item: OpenItem, level: number, email: string, message: string) => {
    const subject = `${LEVEL_LABEL[level]} – Rechnung ${invNo(item)}`;
    // Lesesignal: eindeutiger Token pro Versand, wird als 1x1-Pixel eingebettet.
    const trackToken = crypto.randomUUID();
    const pixelUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/op-light-mail-open?t=${trackToken}`;
    try {
      const { data, error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'finance-reminder',
          recipientEmail: email,
          trackingPixelUrl: pixelUrl,
          templateData: {
            customerName: item.customer_name,
            level,
            amount: Number(item.balance || 0),
            total: Number(item.balance || 0),
            dueDate: item.due_date,
            items: [{
              invoice_number: invNo(item),
              amount: Number(item.balance || 0),
              due_date: item.due_date,
              days_overdue: item.days_overdue ?? 0,
            }],
            note: message || undefined,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await rpc('fibu_light_log_dunning', {
        p_invoice_id: item.id, p_level: level, p_recipient: email, p_subject: subject,
        p_message: message || null, p_open_amount: Number(item.balance || 0),
        p_send_status: 'sent', p_error: null, p_track_token: trackToken,
      });
      return { ok: true as const };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await rpc('fibu_light_log_dunning', {
        p_invoice_id: item.id, p_level: level, p_recipient: email, p_subject: subject,
        p_message: message || null, p_open_amount: Number(item.balance || 0),
        p_send_status: 'failed', p_error: msg.slice(0, 500), p_track_token: null,
      });
      return { ok: false as const, error: msg };
    }
  }, []);

  const sendDunning = async () => {
    if (!selected) return;
    const email = dunEmail.trim();
    if (!email.includes('@')) { toast.error('Bitte eine gültige Empfängeradresse eingeben.'); return; }
    setSending(true);
    const res = await sendDunningFor(selected, dunLevel, email, dunMessage);
    if (res.ok) { toast.success('E-Mail versendet und protokolliert.'); setDunOpen(false); await load(); }
    else toast.error(`Versand fehlgeschlagen: ${res.error}`);
    await loadHistory(selected.id);
    setSending(false);
  };

  const prepareBulk = async () => {
    if (checkedItems.length === 0) return;
    setBulkBusy(true);
    const rows: { item: OpenItem; level: number; email: string }[] = [];
    for (const it of checkedItems) {
      rows.push({ item: it, level: Number(it.next_action_level || 1), email: await resolveEmail(it) });
    }
    setBulkRows(rows);
    setBulkBusy(false);
    setBulkOpen(true);
  };

  const sendBulk = async () => {
    setBulkBusy(true);
    let ok = 0, fail = 0, skipped = 0;
    for (const row of bulkRows) {
      if (!row.email.includes('@')) { skipped += 1; continue; }
      const res = await sendDunningFor(row.item, row.level, row.email, '');
      if (res.ok) ok += 1; else fail += 1;
    }
    setBulkBusy(false);
    setBulkOpen(false);
    setChecked({});
    toast[fail ? 'warning' : 'success'](`Versendet: ${ok} · Fehlgeschlagen: ${fail} · Ohne E-Mail: ${skipped}`);
    await load();
  };

  const saveCase = async () => {
    if (!selected) return;
    setCaseBusy(true);
    const { error } = await rpc('fibu_light_set_clarification', {
      p_invoice_id: selected.id, p_reason: caseReason,
      p_note: caseNote || null, p_pause_until: casePause || null,
    });
    if (error) toast.error(error.message);
    else { toast.success('Klärungsfall gesetzt – Mahnungen werden pausiert.'); setCaseOpen(false); setCaseNote(''); setCasePause(''); await load(); }
    setCaseBusy(false);
    setSelected(null);
  };

  const clearCase = async (item: OpenItem) => {
    const { error } = await rpc('fibu_light_clear_clarification', { p_invoice_id: item.id, p_note: null });
    if (error) toast.error(error.message);
    else { toast.success('Mahnsperre aufgehoben.'); await load(); setSelected(null); }
  };

  /** Eskalation: Übergabe an Anwalt oder internes Inkasso (Einzeln oder Massenbearbeitung). */
  const openEscalation = (rows: OpenItem[], stage: 'anwalt' | 'inkasso_intern') => {
    if (rows.length === 0) { toast.error('Bitte zuerst offene Posten markieren.'); return; }
    setEscRows(rows);
    setEscStage(stage);
    setEscNote('');
    setEscOpen(true);
  };

  const runEscalation = async () => {
    setEscBusy(true);
    const { data, error } = await rpc('fibu_light_set_escalation', {
      p_invoice_ids: escRows.map((r) => r.id),
      p_stage: escStage,
      p_note: escNote.trim() || null,
    });
    if (error) toast.error(`Übergabe fehlgeschlagen: ${error.message}`);
    else {
      const rows = (data as { ok: boolean }[]) || [];
      const ok = rows.filter((r) => r.ok).length;
      const fail = rows.length - ok;
      toast[fail ? 'warning' : 'success'](
        `${ESC_LABEL[escStage]}: ${ok} übergeben${fail ? ` · ${fail} übersprungen` : ''}`,
      );
      setEscOpen(false);
      setListChecked({});
      await load();
      if (selected) setSelected(null);
    }
    setEscBusy(false);
  };

  const clearEscalation = async (item: OpenItem) => {
    const { error } = await rpc('fibu_light_clear_escalation', { p_invoice_id: item.id, p_note: null });
    if (error) toast.error(error.message);
    else { toast.success('Rückholung protokolliert.'); await load(); setSelected(null); }
  };

  /** E-Mail-Erinnerung an die markierten Kunden: Vorlage wählen oder freien Text schreiben. */
  const openMail = async (rows: OpenItem[]) => {
    if (rows.length === 0) { toast.error('Bitte zuerst offene Posten markieren.'); return; }
    setMailBusy(true);
    const prepared: { item: OpenItem; email: string }[] = [];
    for (const it of rows) prepared.push({ item: it, email: await resolveEmail(it) });
    setMailRows(prepared);
    setMailMode('vorlage');
    setMailLevel(Math.max(1, Number(rows[0].next_action_level || 1)));
    setMailText('');
    setMailBusy(false);
    setMailOpen(true);
  };

  const sendMails = async () => {
    if (mailMode === 'frei' && !mailText.trim()) {
      toast.error('Bitte einen Text für die Erinnerung eingeben.');
      return;
    }
    setMailBusy(true);
    let ok = 0, fail = 0, skipped = 0;
    for (const row of mailRows) {
      if (!row.email.includes('@')) { skipped += 1; continue; }
      const level = mailMode === 'vorlage' ? mailLevel : Math.max(1, Number(row.item.next_action_level || 1));
      const res = await sendDunningFor(row.item, level, row.email, mailMode === 'frei' ? mailText.trim() : '');
      if (res.ok) ok += 1; else fail += 1;
    }
    setMailBusy(false);
    setMailOpen(false);
    setListChecked({});
    toast[fail ? 'warning' : 'success'](`E-Mail versendet: ${ok} · Fehlgeschlagen: ${fail} · Ohne Adresse: ${skipped}`);
    await load();
  };

  /** SMS-Erinnerung an die markierten Kunden (Twilio). */
  const openSms = async (rows: OpenItem[]) => {
    if (rows.length === 0) { toast.error('Bitte zuerst offene Posten markieren.'); return; }
    setSmsBusy(true);
    const prepared: { item: OpenItem; phone: string }[] = [];
    for (const it of rows) prepared.push({ item: it, phone: await resolvePhone(it) });
    setSmsRows(prepared);
    setSmsText('Alix Lasers: Bitte gleichen Sie Ihre offene Rechnung {rechnung} über {betrag} kurzfristig aus. Vielen Dank.');
    setSmsBusy(false);
    setSmsOpen(true);
  };

  const sendSms = async () => {
    if (!smsText.trim()) { toast.error('Bitte einen Text für die SMS eingeben.'); return; }
    setSmsBusy(true);
    let ok = 0, fail = 0, skipped = 0;
    for (const row of smsRows) {
      const phone = row.phone.trim();
      if (phone.replace(/\D/g, '').length < 7) { skipped += 1; continue; }
      const message = smsText
        .replace(/\{rechnung\}/g, invNo(row.item))
        .replace(/\{betrag\}/g, fmt(row.item.balance, row.item.currency))
        .replace(/\{kunde\}/g, row.item.customer_name ?? '');
      try {
        const { data, error } = await supabase.functions.invoke('op-light-send-sms', {
          body: { to: phone, message, invoice_id: row.item.id },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        ok += 1;
        await rpc('fibu_light_log_dunning', {
          p_invoice_id: row.item.id,
          p_level: Math.max(1, Number(row.item.next_action_level || 1)),
          p_recipient: phone,
          p_subject: `SMS – Rechnung ${invNo(row.item)}`,
          p_message: message,
          p_open_amount: Number(row.item.balance || 0),
          p_send_status: 'sent',
          p_error: null,
        });
      } catch (e: any) {
        fail += 1;
        await rpc('fibu_light_log_dunning', {
          p_invoice_id: row.item.id,
          p_level: Math.max(1, Number(row.item.next_action_level || 1)),
          p_recipient: phone,
          p_subject: `SMS – Rechnung ${invNo(row.item)}`,
          p_message: message,
          p_open_amount: Number(row.item.balance || 0),
          p_send_status: 'failed',
          p_error: String(e?.message ?? e).slice(0, 500),
        });
      }
    }
    setSmsBusy(false);
    setSmsOpen(false);
    setListChecked({});
    toast[fail ? 'warning' : 'success'](`SMS versendet: ${ok} · Fehlgeschlagen: ${fail} · Ohne Nummer: ${skipped}`);
    await load();
  };



  const savePlan = async () => {
    if (!selected) return;
    setRateBusy(true);
    const { data, error } = await rpc('fibu_light_create_installment_plan', {
      p_invoice_id: selected.id,
      p_count: Number(rateCount),
      p_amount: rateAmount ? Number(rateAmount.replace(',', '.')) : null,
      p_first_due: rateFirst,
      p_interval_months: Number(rateInterval),
      p_note: rateNote || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Ratenvereinbarung angelegt: ${rateCount} × ${fmt((data as any)?.rate, selected.currency)}`);
      setRateOpen(false); setRateNote(''); setRateAmount('');
      await load();
    }
    setRateBusy(false);
  };

  const saveIssue = async () => {
    if (!selected || !issueText.trim()) return;
    setIssueBusy(true);
    const { error } = await rpc('fibu_light_report_booking_issue', {
      p_invoice_id: selected.id, p_description: issueText.trim(), p_transaction_id: null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Buchungsfehler gemeldet – Finance/Admin übernimmt die Korrektur.');
      setIssueOpen(false); setIssueText('');
      await loadHistory(selected.id);
    }
    setIssueBusy(false);
  };

  const saveNote = async () => {
    if (!selected || !note.trim()) return;
    setSavingNote(true);
    const { error } = await rpc('fibu_light_add_note', { p_invoice_id: selected.id, p_note: note.trim() });
    if (error) toast.error(error.message);
    else { toast.success('Notiz gespeichert.'); setNote(''); await loadHistory(selected.id); }
    setSavingNote(false);
  };

  const quickResults = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return items.filter((i) =>
      [i.customer_name, i.invoice_number, i.legal_invoice_number, i.id].filter(Boolean)
        .join(' ').toLowerCase().includes(q)).slice(0, 12);
  }, [items, quickSearch]);

  const markedItems = useMemo(() => filtered.filter((i) => listChecked[i.id]), [filtered, listChecked]);
  const allMarked = visible.length > 0 && visible.every((i) => listChecked[i.id]);
  const markedSum = markedItems.reduce((s, i) => s + Number(i.balance || 0), 0);

  const toggleAllMarked = (on: boolean) => {
    const next = { ...listChecked };
    for (const i of visible) { if (on) next[i.id] = true; else delete next[i.id]; }
    setListChecked(next);
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'alle', label: 'Alle' },
    { key: 'heute', label: 'Heute fällig' },
    { key: 'ueberfaellig', label: 'Überfällig' },
    { key: 'teilbezahlt', label: 'Teilbezahlt' },
    { key: 'mahnung', label: 'Mahnung erforderlich' },
    { key: 'klaerung', label: 'Klärung' },
    { key: 'raten', label: 'Ratenzahlung' },
    { key: 'anwalt', label: 'Beim Anwalt' },
    { key: 'inkasso', label: 'Internes Inkasso' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Offene Posten Light"
        subtitle="Öffnen → sehen was offen ist → Aktion ausführen → fertig"
        icon={Wallet}
        noBreadcrumbs
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Aktualisieren
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Offen gesamt', value: fmt(kpis.open), icon: Banknote, tone: 'text-foreground' },
          { label: 'Überfällig', value: fmt(kpis.overdue), icon: AlertTriangle, tone: 'text-destructive' },
          { label: 'Heute fällig', value: fmt(kpis.dueToday), icon: CalendarClock, tone: 'text-amber-500' },
          { label: 'Teilbezahlt', value: String(kpis.partial), icon: Wallet, tone: 'text-blue-500' },
          { label: 'Mahnung erforderlich', value: String(kpis.dunning), icon: Mail, tone: 'text-orange-500' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className={cn('text-xl font-semibold', k.tone)}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Bank & Zuordnung (Phase 3) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Bankumsätze ungeprüft', value: bankKpi.ungeprueft ?? 0 },
          { label: 'Zuordnungsvorschläge', value: bankKpi.vorschlaege ?? 0 },
          { label: 'Unklare Zahlungen', value: bankKpi.unklar ?? 0 },
          { label: 'Heute zugeordnet', value: bankKpi.heute_zugeordnet ?? 0 },
        ].map((k) => (
          <a key={k.label} href="/fibu-light/bank" className="rounded-xl border border-border bg-card p-4 hover:border-primary/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Landmark className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="text-xl font-semibold">{k.value}</div>
          </a>
        ))}
      </div>

      {/* Drei grosse Arbeitsbuttons */}
      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <Button size="lg" variant="destructive" className="h-14 text-base"
          onClick={() => { setTab('arbeitsliste'); setFilter('ueberfaellig'); }}>
          <AlertTriangle className="h-5 w-5 mr-2" /> ÜBERFÄLLIGE BEARBEITEN
        </Button>
        <Button size="lg" className="h-14 text-base" onClick={() => { setQuickSearch(''); setQuickOpen(true); }}>
          <Banknote className="h-5 w-5 mr-2" /> ZAHLUNG BUCHEN
        </Button>
        <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => setTab('mahncenter')}>
          <Mail className="h-5 w-5 mr-2" /> MAHNUNGEN BEARBEITEN ({dunningItems.length})
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-border">
        {([
          { key: 'arbeitsliste', label: 'Arbeitsliste' },
          { key: 'anzahlungen', label: 'Anzahlungen' },
          { key: 'mahncenter', label: 'Mahnungen heute' },
          { key: 'bank', label: 'Bankvorschläge' },

        ] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 text-sm border-b-2 -mb-px',
              tab === t.key ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'arbeitsliste' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
                {f.label}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(v === 'all' ? 'all' : Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="all">Alle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-72">
              <Input placeholder="Kunde, Rechnungsnummer oder ID …" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground">
            {[
              ['bg-emerald-500', 'nicht fällig'], ['bg-amber-400', '1–7 Tage'], ['bg-orange-500', '8–14 Tage'],
              ['bg-destructive', '> 14 Tage'], ['bg-blue-500', 'Teilzahlung'], ['bg-muted-foreground', 'Klärung/Sperre'],
            ].map(([dot, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', dot)} /> {label}
              </span>
            ))}
          </div>

          {/* Massenbearbeitung: Übergabe an Anwalt / internes Inkasso */}
          {markedItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
              <span className="text-sm font-medium">
                {markedItems.length} markiert · {fmt(markedSum)}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setListChecked({})}>Auswahl aufheben</Button>
                <Button size="sm" onClick={() => void openMail(markedItems)} disabled={mailBusy}>
                  {mailBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  E-Mail versenden
                </Button>
                <Button size="sm" variant="outline" onClick={() => void openSms(markedItems)} disabled={smsBusy}>
                  {smsBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  SMS versenden
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEscalation(markedItems, 'inkasso_intern')}>
                  <ShieldAlert className="h-4 w-4 mr-2" /> An internes Inkasso
                </Button>
                <Button size="sm" variant="destructive" onClick={() => openEscalation(markedItems, 'anwalt')}>
                  <Gavel className="h-4 w-4 mr-2" /> An Anwalt übergeben
                </Button>
              </div>
            </div>
          )}

          <div className={cn('grid gap-4', selected ? 'lg:grid-cols-[1fr_400px]' : 'grid-cols-1')}>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {loading ? (
                <div className="p-6"><SkeletonTable rows={8} cols={6} /></div>
              ) : filtered.length === 0 ? (
                <div className="p-8"><EmptyState title="Nichts zu tun" description="In dieser Ansicht sind derzeit keine offenen Forderungen vorhanden." /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 text-muted-foreground">
                      <tr>
                        <th className="w-10 pl-3">
                          <Checkbox checked={allMarked} onCheckedChange={(v) => toggleAllMarked(!!v)} aria-label="Alle markieren" />
                        </th>
                        <th className="w-8" />
                        <th className="text-left px-3 py-3">Kunde</th>
                        <th className="text-left px-3 py-3">Rechnung</th>
                        <th className="text-left px-3 py-3">Fällig</th>
                        <th className="text-right px-3 py-3">Betrag</th>
                        <th className="text-right px-3 py-3">Bezahlt</th>
                        <th className="text-right px-3 py-3">Offen</th>
                        <th className="text-left px-3 py-3">Letzte E-Mail</th>
                        <th className="text-left px-3 py-3">Arbeitsstatus</th>
                        <th className="text-left px-3 py-3">Nächste Aktion</th>
                        <th className="text-right px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visible.map((i) => {
                        const light = trafficLight(i);
                        return (
                          <tr key={i.id} className={cn('hover:bg-secondary/30', selected?.id === i.id && 'bg-secondary/40', listChecked[i.id] && 'bg-primary/5')}>
                            <td className="pl-3">
                              <Checkbox
                                checked={!!listChecked[i.id]}
                                onCheckedChange={(v) => setListChecked((s) => ({ ...s, [i.id]: !!v }))}
                                aria-label={`${invNo(i)} markieren`}
                              />
                            </td>
                            <td className="pl-1"><span className={cn('block h-2.5 w-2.5 rounded-full', light.dot)} /></td>
                            <td className="px-3 py-2">{i.customer_name || '—'}</td>
                            <td className="px-3 py-2 font-medium">
                              {invNo(i)}
                              {i.escalation_stage && (
                                <Badge variant={i.escalation_stage === 'anwalt' ? 'destructive' : 'secondary'} className="ml-2">
                                  {ESC_LABEL[i.escalation_stage]}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">{fmtDate(i.due_date)}</td>
                            <td className="px-3 py-2 text-right">{fmt(i.total, i.currency)}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{fmt(i.paid, i.currency)}</td>
                            <td className="px-3 py-2 text-right font-semibold">{fmt(i.balance, i.currency)}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-xs">
                              {(() => {
                                const m = lastMails[i.id];
                                if (!m) return <span className="text-muted-foreground">Keine E-Mail</span>;
                                const failed = m.send_status !== 'sent';
                                return (
                                  <span title={`${m.subject || ''}\n${m.recipient_email || ''}`}>
                                    <span className="text-muted-foreground">{fmtDateTime(m.sent_at)}</span>
                                    <Badge
                                      variant={failed ? 'destructive' : m.opened_at ? 'default' : 'secondary'}
                                      className="ml-2"
                                    >
                                      {failed
                                        ? 'Versand fehlgeschlagen'
                                        : m.opened_at
                                          ? `Gelesen ${fmtDateTime(m.opened_at)}`
                                          : 'Noch nicht gelesen'}
                                    </Badge>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className={cn('px-3 py-2 whitespace-nowrap', light.text)}>{light.label}</td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {i.escalation_stage
                                ? `Übergeben: ${ESC_LABEL[i.escalation_stage]}${i.escalation_at ? ` am ${fmtDate(i.escalation_at)}` : ''}`
                                : i.case_active
                                  ? `Klärung: ${i.case_reason}`
                                  : i.plan_id
                                    ? `Rate ${fmt(i.next_rate_amount, i.currency)} am ${fmtDate(i.next_rate_due)}`
                                    : Number(i.next_action_level || 0) > 0
                                      ? LEVEL_LABEL[Number(i.next_action_level)]
                                      : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <Button size="sm" variant="outline" onClick={() => openPanel(i)}>Öffnen</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    <span>{filtered.length} Posten · angezeigt {visible.length}</span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Zurück</Button>
                        <span>Seite {safePage} von {totalPages}</span>
                        <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Weiter</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>



            {/* Arbeitskarte */}
            {selected && (
              <aside className="rounded-xl border border-border bg-card p-4 h-fit lg:sticky lg:top-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="text-sm font-medium">{selected.customer_name}</div>
                    <div className="text-lg font-semibold">{invNo(selected)}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
                </div>

                <div className="space-y-1 text-sm mb-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Rechnung</span><span>{fmt(selected.total, selected.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bezahlt</span><span>{fmt(selected.paid, selected.currency)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Offen</span><span>{fmt(selected.balance, selected.currency)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fällig</span>
                    <span>{fmtDate(selected.due_date)}{(selected.days_overdue ?? 0) > 0 ? ` (seit ${selected.days_overdue} Tagen)` : ''}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs mb-3">
                  <div className="font-medium mb-1">Letzte Aktion</div>
                  <div className="text-muted-foreground">
                    {selected.last_action_at ? `${selected.last_action} am ${fmtDateTime(selected.last_action_at)}` : 'keine'}
                  </div>
                  <div className="mt-2 font-medium">Nächste Aktion</div>
                  <div className="text-muted-foreground">
                    {selected.case_active
                      ? `Klärungsfall (${selected.case_reason})${selected.case_pause_until ? ` – pausiert bis ${fmtDate(selected.case_pause_until)}` : ''}`
                      : Number(selected.next_action_level || 0) > 0
                        ? LEVEL_LABEL[Number(selected.next_action_level)]
                        : 'Noch nicht fällig – keine Aktion nötig.'}
                  </div>
                  {selected.plan_id && (
                    <div className="mt-2 text-blue-500">
                      Ratenvereinbarung aktiv · Nächste Rate {fmt(selected.next_rate_amount, selected.currency)} am {fmtDate(selected.next_rate_due)}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Button size="sm" onClick={() => startPayment(selected)}>
                    <Banknote className="h-4 w-4 mr-2" /> Zahlung buchen
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => void startDunning(selected, Math.max(1, Number(selected.next_action_level || 1)))}>
                    <Send className="h-4 w-4 mr-2" /> Mahnung
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void openPdf(selected)} disabled={pdfLoading}>
                    {pdfLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />} Rechnung
                  </Button>
                  {selected.case_active ? (
                    <Button size="sm" variant="outline" onClick={() => void clearCase(selected)}>
                      <Unlock className="h-4 w-4 mr-2" /> Sperre aufheben
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setCaseReason(CASE_REASONS[0]); setCaseOpen(true); }}>
                      <Lock className="h-4 w-4 mr-2" /> Mahnsperre
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => {
                    setRateCount('4');
                    setRateAmount('');
                    setRateFirst(new Date().toISOString().slice(0, 10));
                    setRateOpen(true);
                  }}>
                    <CalendarClock className="h-4 w-4 mr-2" /> Ratenzahlung
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIssueOpen(true)}>
                    <ShieldAlert className="h-4 w-4 mr-2" /> Buchungsfehler
                  </Button>
                  {selected.escalation_stage ? (
                    <Button size="sm" variant="outline" className="col-span-2" onClick={() => void clearEscalation(selected)}>
                      <Undo2 className="h-4 w-4 mr-2" /> Zurückholen von {ESC_LABEL[selected.escalation_stage]}
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEscalation([selected], 'inkasso_intern')}>
                        <ShieldAlert className="h-4 w-4 mr-2" /> Internes Inkasso
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openEscalation([selected], 'anwalt')}>
                        <Gavel className="h-4 w-4 mr-2" /> An Anwalt
                      </Button>
                    </>
                  )}
                </div>

                {selected.escalation_stage && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs mb-3">
                    <div className="font-medium">Übergeben an {ESC_LABEL[selected.escalation_stage]}</div>
                    <div className="text-muted-foreground">
                      {fmtDateTime(selected.escalation_at)}{selected.escalation_note ? ` · ${selected.escalation_note}` : ''}
                    </div>
                  </div>
                )}


                <div className="my-4">
                  <Label className="text-xs">Interne Notiz</Label>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz zum offenen Posten …" />
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => void saveNote()} disabled={savingNote || !note.trim()}>
                    <StickyNote className="h-4 w-4 mr-2" /> Notiz speichern
                  </Button>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2"><History className="h-4 w-4" /> Verlauf</div>
                  {historyLoading ? (
                    <div className="text-xs text-muted-foreground">Lädt …</div>
                  ) : (
                    <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
                      <div>
                        <div className="text-muted-foreground mb-1">Zahlungen</div>
                        {(history?.payments ?? []).length === 0 ? <div>—</div> : (history.payments as any[]).map((p) => (
                          <div key={p.id} className="flex justify-between border-b border-border/50 py-1">
                            <span>{fmtDate(p.booking_date)}</span><span>{fmt(p.amount, selected.currency)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Erinnerungen / Mahnungen</div>
                        {(history?.dunning ?? []).length === 0 ? <div>—</div> : (history.dunning as any[]).map((d) => (
                          <div key={d.id} className="border-b border-border/50 py-1">
                            <div className="flex justify-between">
                              <span>{LEVEL_LABEL[d.level]}</span>
                              <span className={d.send_status === 'sent' ? 'text-emerald-500' : 'text-destructive'}>{d.send_status}</span>
                            </div>
                            <div className="text-muted-foreground">{fmtDateTime(d.sent_at)} · {d.recipient_email}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Raten</div>
                        {(history?.installments ?? []).length === 0 ? <div>—</div> : (history.installments as any[]).map((r) => (
                          <div key={r.id} className="flex justify-between border-b border-border/50 py-1">
                            <span>Rate {r.seq} · {fmtDate(r.due_date)}</span>
                            <span>{fmt(r.amount, selected.currency)}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Klärung / Sperren</div>
                        {(history?.cases ?? []).length === 0 ? <div>—</div> : (history.cases as any[]).map((c) => (
                          <div key={c.id} className="border-b border-border/50 py-1">
                            <div>{c.action === 'set' ? `Gesperrt: ${c.reason}` : 'Sperre aufgehoben'}</div>
                            <div className="text-muted-foreground">{fmtDateTime(c.created_at)}{c.pause_until ? ` · bis ${fmtDate(c.pause_until)}` : ''}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Gemeldete Buchungsfehler</div>
                        {(history?.issues ?? []).length === 0 ? <div>—</div> : (history.issues as any[]).map((s) => (
                          <div key={s.id} className="border-b border-border/50 py-1">
                            <div>{s.description}</div>
                            <div className="text-muted-foreground">{fmtDateTime(s.created_at)} · {s.status}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Notizen</div>
                        {(history?.notes ?? []).length === 0 ? <div>—</div> : (history.notes as any[]).map((n) => (
                          <div key={n.id} className="border-b border-border/50 py-1">
                            <div>{n.note}</div>
                            <div className="text-muted-foreground">{fmtDateTime(n.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {/* Mahncenter */}
      {tab === 'anzahlungen' && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Offene Anzahlungen</div>
              <div className="text-xl font-semibold">{fmt(depositsSum)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="text-xs text-muted-foreground">Anzahl</div>
              <div className="text-xl font-semibold">{depositsFiltered.length}</div>
            </div>
            <div className="ml-auto w-full sm:w-72">
              <Input placeholder="Kunde, Anzahlungs- oder Auftragsnummer …" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {depositsLoading ? (
              <div className="p-6"><SkeletonTable rows={6} cols={6} /></div>
            ) : depositsFiltered.length === 0 ? (
              <div className="p-8"><EmptyState title="Keine offenen Anzahlungen" description="Aktuell sind keine Anzahlungen offen." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-3">Kunde</th>
                      <th className="text-left px-3 py-3">Anzahlung</th>
                      <th className="text-left px-3 py-3">Auftrag</th>
                      <th className="text-left px-3 py-3">Fällig</th>
                      <th className="text-right px-3 py-3">Betrag</th>
                      <th className="text-right px-3 py-3">Bezahlt</th>
                      <th className="text-right px-3 py-3">Offen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {depositsFiltered.map((d) => (
                      <tr key={d.id} className="hover:bg-secondary/30">
                        <td className="px-3 py-2">{d.customer_name || '—'}</td>
                        <td className="px-3 py-2 font-medium">{d.deposit_number || d.invoice_number || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.order_number || '—'}</td>
                        <td className="px-3 py-2">{fmtDate(d.due_date)}</td>
                        <td className="px-3 py-2 text-right">{fmt(d.gross_amount, d.currency)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt(d.paid_amount, d.currency)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(d.open_amount, d.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Anzeige aus „Offene Anzahlungen“ – Buchungen und Freigaben erfolgen weiterhin dort.
            </div>
          </div>
        </>
      )}

      {tab === 'mahncenter' && (

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            Mahnfristen (zentral vom Administrator festgelegt):{' '}
            {rules.length === 0 ? '—' : rules.map((r) => `${r.label} +${r.offset_days} Tage`).join(' · ')}
            <div className="mt-1">Der tatsächliche Versand erfolgt erst nach Ihrer Prüfung und Freigabe.</div>
          </div>

          {[1, 2, 3, 4].map((lvl) => {
            const group = dunningGroups[lvl] || [];
            if (group.length === 0) return null;
            return (
              <div key={lvl} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-secondary/50 flex items-center justify-between">
                  <div className="font-medium text-sm">{group.length} × {LEVEL_LABEL[lvl]}</div>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const next = { ...checked };
                    const allOn = group.every((g) => next[g.id]);
                    group.forEach((g) => { next[g.id] = !allOn; });
                    setChecked(next);
                  }}>Alle auswählen</Button>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {group.map((i) => (
                      <tr key={i.id} className="hover:bg-secondary/30">
                        <td className="pl-4 w-10">
                          <Checkbox checked={!!checked[i.id]}
                            onCheckedChange={(v) => setChecked((c) => ({ ...c, [i.id]: !!v }))} />
                        </td>
                        <td className="px-3 py-2">{i.customer_name}</td>
                        <td className="px-3 py-2 font-medium">{invNo(i)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{i.days_overdue} Tage überfällig</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(i.balance, i.currency)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => { setTab('arbeitsliste'); openPanel(i); }}>Prüfen</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {dunningItems.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8">
              <EmptyState title="Keine Mahnungen heute" description="Aktuell steht keine Mahnaktion an." />
            </div>
          )}

          {checkedItems.length > 0 && (
            <div className="sticky bottom-4 flex justify-center">
              <Button size="lg" onClick={() => void prepareBulk()} disabled={bulkBusy}>
                {bulkBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {checkedItems.length} AUSGEWÄHLTE PRÜFEN
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Bankvorschläge */}
      {tab === 'bank' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 bg-secondary/50 flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2"><Landmark className="h-4 w-4" /> Mögliche Bankzuordnungen</div>
            <Button size="sm" variant="outline" onClick={() => void loadBank()} disabled={bankLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', bankLoading && 'animate-spin')} /> Neu prüfen
            </Button>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
            Vorschau – Zuordnung und Buchung erfolgen in einem späteren Schritt und niemals automatisch.
          </div>
          {bankLoading ? (
            <div className="p-6"><SkeletonTable rows={5} cols={5} /></div>
          ) : bankRows.length === 0 ? (
            <div className="p-8"><EmptyState title="Keine Vorschläge" description="Derzeit gibt es keine offenen Bankeingänge mit passender Rechnung." /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Bankeingang</th>
                  <th className="text-left px-3 py-2">Absender</th>
                  <th className="text-right px-3 py-2">Betrag</th>
                  <th className="text-left px-3 py-2">Rechnung</th>
                  <th className="text-right px-3 py-2">Offen</th>
                  <th className="text-right px-3 py-2">Übereinstimmung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bankRows.map((b, idx) => (
                  <tr key={`${b.transaction_id}-${b.invoice_id}-${idx}`}>
                    <td className="px-3 py-2">{fmtDate(b.booking_date)}</td>
                    <td className="px-3 py-2">{b.sender_name || '—'}</td>
                    <td className="px-3 py-2 text-right">{fmt(b.amount)}</td>
                    <td className="px-3 py-2 font-medium">{b.invoice_number}</td>
                    <td className="px-3 py-2 text-right">{fmt(b.open_amount)}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={Number(b.score) >= 90 ? 'default' : 'secondary'}>{b.score} %</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Schnellbuchung */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Zahlung buchen – Rechnung suchen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input autoFocus className="pl-9" placeholder="Rechnungsnummer, Kunde oder interne ID …"
                value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)} />
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {quickResults.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Mindestens 2 Zeichen eingeben.</div>
              ) : quickResults.map((i) => (
                <button key={i.id} onClick={() => startPayment(i)}
                  className="w-full text-left p-3 hover:bg-secondary/40">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{i.customer_name}</span><span>{invNo(i)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rechnung {fmt(i.total, i.currency)} · bereits bezahlt {fmt(i.paid, i.currency)} · noch offen{' '}
                    <span className="font-semibold text-foreground">{fmt(i.balance, i.currency)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Zahlung buchen */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Zahlung buchen · {selected ? invNo(selected) : ''}</DialogTitle></DialogHeader>
          {selected && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs space-y-1">
              <div>Kunde: <span className="font-medium">{selected.customer_name}</span></div>
              <div>Rechnung: {fmt(selected.total, selected.currency)} · bereits bezahlt: {fmt(selected.paid, selected.currency)}</div>
              <div>Noch offen: <span className="font-semibold">{fmt(selected.balance, selected.currency)}</span></div>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <Label>Zahlungseingang</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Zahlungsdatum</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label>Zahlungsart</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Bank', 'Bar', 'Karte', 'Sonstige'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Referenz (optional)</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
            <div><Label>Notiz (optional)</Label><Textarea rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => void bookPayment(false)} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Teilzahlung buchen
            </Button>
            <Button onClick={() => void bookPayment(true)} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Vollständig bezahlt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mahnung / Erinnerung */}
      <Dialog open={dunOpen} onOpenChange={setDunOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{LEVEL_LABEL[dunLevel]} senden</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label>Stufe</Label>
              <Select value={String(dunLevel)} onValueChange={(v) => setDunLevel(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={String(l)}>{LEVEL_LABEL[l]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Empfänger</Label><Input value={dunEmail} onChange={(e) => setDunEmail(e.target.value)} placeholder="kunde@example.com" /></div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs space-y-1">
              <div><span className="text-muted-foreground">Betreff: </span>{LEVEL_LABEL[dunLevel]} – Rechnung {selected ? invNo(selected) : ''}</div>
              <div><span className="text-muted-foreground">Offener Betrag: </span>{selected ? fmt(selected.balance, selected.currency) : ''}</div>
              <div><span className="text-muted-foreground">Fällig: </span>{fmtDate(selected?.due_date)}</div>
            </div>
            <div><Label>Zusätzlicher Hinweis (optional)</Label><Textarea rows={3} value={dunMessage} onChange={(e) => setDunMessage(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => void sendDunning()} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Jetzt per E-Mail senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* E-Mail an markierte Kunden: Vorlage oder freier Text */}
      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>E-Mail an {mailRows.length} markierte Kunden</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <Button size="sm" variant={mailMode === 'vorlage' ? 'default' : 'outline'} onClick={() => setMailMode('vorlage')}>
                Vorlage auswählen
              </Button>
              <Button size="sm" variant={mailMode === 'frei' ? 'default' : 'outline'} onClick={() => setMailMode('frei')}>
                Freier Text
              </Button>
            </div>

            {mailMode === 'vorlage' ? (
              <div>
                <Label>Vorlage</Label>
                <Select value={String(mailLevel)} onValueChange={(v) => setMailLevel(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((l) => <SelectItem key={l} value={String(l)}>{LEVEL_LABEL[l]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Ihr Text an den Kunden</Label>
                <Textarea rows={5} value={mailText} onChange={(e) => setMailText(e.target.value)}
                  placeholder="Sehr geehrte Damen und Herren, wir möchten Sie freundlich an die offene Rechnung erinnern …" />
              </div>
            )}

            <div className="max-h-64 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {mailRows.map((r, idx) => (
                <div key={r.item.id} className="p-2">
                  <div className="flex justify-between font-medium">
                    <span>{r.item.customer_name} · {invNo(r.item)}</span>
                    <span>{fmt(r.item.balance, r.item.currency)}</span>
                  </div>
                  <Input className="mt-1 h-8 text-xs" value={r.email} placeholder="keine E-Mail hinterlegt"
                    onChange={(e) => setMailRows((prev) => prev.map((p, i) => (i === idx ? { ...p, email: e.target.value } : p)))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Jede versendete Erinnerung wird protokolliert. Kunden ohne E-Mail-Adresse werden übersprungen.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => void sendMails()} disabled={mailBusy}>
              {mailBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Erinnerung jetzt senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS an markierte Kunden */}
      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>SMS an {smsRows.length} markierte Kunden</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label>Text der SMS</Label>
              <Textarea rows={4} value={smsText} onChange={(e) => setSmsText(e.target.value)}
                placeholder="Kurzer Hinweis auf die offene Rechnung …" />
              <p className="mt-1 text-xs text-muted-foreground">
                Platzhalter: {'{rechnung}'}, {'{betrag}'}, {'{kunde}'} · {smsText.length} Zeichen
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {smsRows.map((r, idx) => (
                <div key={r.item.id} className="p-2">
                  <div className="flex justify-between font-medium">
                    <span>{r.item.customer_name} · {invNo(r.item)}</span>
                    <span>{fmt(r.item.balance, r.item.currency)}</span>
                  </div>
                  <Input className="mt-1 h-8 text-xs" value={r.phone} placeholder="keine Mobilnummer hinterlegt"
                    onChange={(e) => setSmsRows((prev) => prev.map((p, i) => (i === idx ? { ...p, phone: e.target.value } : p)))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Jede versendete SMS wird protokolliert. Kunden ohne Mobilnummer werden übersprungen.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => void sendSms()} disabled={smsBusy}>
              {smsBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              SMS jetzt senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sammelprüfung Mahnungen */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{bulkRows.length} Mahnungen prüfen</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto divide-y divide-border text-sm">
            {bulkRows.map((r) => (
              <div key={r.item.id} className="py-2">
                <div className="flex justify-between font-medium">
                  <span>{r.item.customer_name} · {invNo(r.item)}</span>
                  <span>{fmt(r.item.balance, r.item.currency)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {LEVEL_LABEL[r.level]} ·{' '}
                  {r.email
                    ? r.email
                    : <span className="text-destructive">keine E-Mail hinterlegt – wird übersprungen</span>}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkBusy}>Abbrechen</Button>
            <Button onClick={() => void sendBulk()} disabled={bulkBusy}>
              {bulkBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Geprüft – jetzt senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Klärungsfall */}
      <Dialog open={caseOpen} onOpenChange={setCaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Klärungsfall / Mahnsperre</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label>Grund</Label>
              <Select value={caseReason} onValueChange={setCaseReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CASE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Mahnlauf pausieren bis (optional)</Label><Input type="date" value={casePause} onChange={(e) => setCasePause(e.target.value)} /></div>
            <div><Label>Notiz (optional)</Label><Textarea rows={3} value={caseNote} onChange={(e) => setCaseNote(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">
              Die Rechnung bleibt in den offenen Posten enthalten und wird weiterhin im offenen Saldo gezählt.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => void saveCase()} disabled={caseBusy}>
              {caseBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Klärung setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ratenzahlung */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Ratenzahlung vereinbaren</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              Offener Betrag: <span className="font-semibold">{selected ? fmt(selected.balance, selected.currency) : '—'}</span>
            </div>
            <div><Label>Anzahl Raten</Label><Input value={rateCount} onChange={(e) => setRateCount(e.target.value)} inputMode="numeric" /></div>
            <div>
              <Label>Ratenbetrag (optional)</Label>
              <Input value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} inputMode="decimal"
                placeholder={selected ? String((Number(selected.balance || 0) / Math.max(1, Number(rateCount) || 1)).toFixed(2)) : ''} />
            </div>
            <div><Label>Erste Fälligkeit</Label><Input type="date" value={rateFirst} onChange={(e) => setRateFirst(e.target.value)} /></div>
            <div><Label>Abstand in Monaten</Label><Input value={rateInterval} onChange={(e) => setRateInterval(e.target.value)} inputMode="numeric" /></div>
            <div><Label>Notiz (optional)</Label><Textarea rows={2} value={rateNote} onChange={(e) => setRateNote(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Die Originalrechnung bleibt unverändert.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => void savePlan()} disabled={rateBusy}>
              {rateBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Ratenvereinbarung speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buchungsfehler melden */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Buchungsfehler melden</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Gebuchte Zahlungen können in FIBU LIGHT nicht geändert oder gelöscht werden.
              Ihre Meldung geht an Finance/Admin zur nachvollziehbaren Korrektur.
            </p>
            <Textarea rows={4} value={issueText} onChange={(e) => setIssueText(e.target.value)}
              placeholder="Was ist falsch gebucht worden? (z. B. 5.000 € statt 500 €)" />
          </div>
          <DialogFooter>
            <Button onClick={() => void saveIssue()} disabled={issueBusy || !issueText.trim()}>
              {issueBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Übergabe an Anwalt / internes Inkasso */}
      <Dialog open={escOpen} onOpenChange={setEscOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {escStage === 'anwalt' ? 'An Anwalt übergeben' : 'An internes Inkasso übergeben'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={escStage === 'anwalt' ? 'destructive' : 'outline'} onClick={() => setEscStage('anwalt')}>
                <Gavel className="h-4 w-4 mr-2" /> Anwalt
              </Button>
              <Button size="sm" variant={escStage === 'inkasso_intern' ? 'default' : 'outline'} onClick={() => setEscStage('inkasso_intern')}>
                <ShieldAlert className="h-4 w-4 mr-2" /> Internes Inkasso
              </Button>
            </div>
            <div className="rounded-lg border border-border max-h-56 overflow-y-auto divide-y divide-border">
              {escRows.map((r) => (
                <div key={r.id} className="flex justify-between gap-3 px-3 py-2 text-xs">
                  <span className="truncate">{r.customer_name} · {invNo(r)}</span>
                  <span className="font-medium whitespace-nowrap">{fmt(r.balance, r.currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>{escRows.length} Forderung(en)</span>
              <span>{fmt(escRows.reduce((s, r) => s + Number(r.balance || 0), 0))}</span>
            </div>
            <div>
              <Label className="text-xs">Notiz zur Übergabe (optional)</Label>
              <Textarea rows={2} value={escNote} onChange={(e) => setEscNote(e.target.value)}
                placeholder="z. B. Aktenzeichen, Ansprechpartner, Übergabedatum" />
            </div>
            <p className="text-xs text-muted-foreground">
              Die Übergabe setzt automatisch eine Mahnsperre, damit kein reguläres Mahnwesen weiterläuft.
              Rechnungen, Zahlungen und Rechnungsnummern werden nicht verändert; die Übergabe wird unveränderbar protokolliert.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscOpen(false)} disabled={escBusy}>Abbrechen</Button>
            <Button variant={escStage === 'anwalt' ? 'destructive' : 'default'} onClick={() => void runEscalation()} disabled={escBusy || escRows.length === 0}>
              {escBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Verbindlich übergeben
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
