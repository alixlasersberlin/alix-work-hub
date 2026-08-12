import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Repeat, Search, Loader2, ChevronDown, ChevronRight, RefreshCw, Download, FileSpreadsheet, FileText, FileJson, Plus, Trash2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { KpiTile } from '@/components/infinity/KpiTile';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { RecurringProfileEditDialog, type EditableProfile } from '@/components/finance/RecurringProfileEditDialog';
import { RecurringProfileCreateDialog } from '@/components/finance/RecurringProfileCreateDialog';

import { RecurringInvoiceBookDialog, type BookableInvoice } from '@/components/finance/RecurringInvoiceBookDialog';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { InvoicePdfDialog, type PdfInvoiceRef } from '@/components/finance/InvoicePdfDialog';
import { CustomerInvoicesDialog } from '@/components/finance/CustomerInvoicesDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';


// Beträge auf dieser Seite werden bewusst NICHT durch die Revenue-Mask (Super Admin)
// ausgeblendet — Vertragssummen sind für Finance-Auswertung essentiell.
const fmt = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type Profile = {
  id: string;
  zoho_recurring_invoice_id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  company_name: string | null;
  recurrence_frequency: string | null;
  repeat_every: number | null;
  start_date: string | null;
  end_date: string | null;
  next_invoice_date: string | null;
  last_sent_date: string | null;
  delivery_date?: string | null;
  delivery_source?: string | null;

  total: number | null;
  currency: string | null;
  created_at: string | null;
};

type Invoice = {
  id: string;
  zoho_invoice_id: string;
  zoho_recurring_invoice_id: string | null;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  status: string | null;
  currency: string | null;
  last_payment_date: string | null;
};

type Group = {
  customer_id: string;
  customer_name: string;
  profiles: Profile[];
  invoices: Invoice[];
  monthly: number;
  remaining: number;
  ytdBilled: number;
  openBalance: number;
  lastInvoiceDate: string | null;
  nextInvoiceDate: string | null;
  newestCreatedAt: string | null;
  currency: string;
  hasSepa: boolean;
};

const isSepaProfile = (p: Profile) => {
  const hay = `${p.recurrence_name ?? ''} ${p.reference_number ?? ''}`.toLowerCase();
  return /\bsepa\b|lastschrift/.test(hay);
};

const monthsFactor = (freq: string | null, every: number | null) => {
  const e = every && every > 0 ? every : 1;
  switch ((freq ?? '').toLowerCase()) {
    case 'days': return 30 / e;
    case 'weeks': return (52 / 12) / e;
    case 'months': return 1 / e;
    case 'years': return (1 / 12) / e;
    default: return 1 / e;
  }
};

// Länge einer Periode in Tagen (für Restlaufzeit-Berechnung)
const periodDays = (freq: string | null, every: number | null) => {
  const e = every && every > 0 ? every : 1;
  switch ((freq ?? '').toLowerCase()) {
    case 'days': return 1 * e;
    case 'weeks': return 7 * e;
    case 'months': return 30.4375 * e;
    case 'years': return 365.25 * e;
    default: return 30.4375 * e;
  }
};

/** Anzahl noch offener Rechnungen bis zum letzten Rechnungsdatum (end_date) */
const remainingCount = (p: Profile) => {
  if ((p.status ?? '').toLowerCase() !== 'active') return 0;
  if (!p.end_date) return 0;
  const end = new Date(p.end_date).getTime();
  const startRef = new Date(p.next_invoice_date || new Date().toISOString().slice(0, 10)).getTime();
  if (!isFinite(end) || !isFinite(startRef) || end < startRef) return 0;
  const days = (end - startRef) / 86400000;
  return Math.floor(days / periodDays(p.recurrence_frequency, p.repeat_every)) + 1;
};

/** Zahltag (Tag im Monat) eines Profils – aus nächster Rechnung, sonst Startdatum */
const profileDay = (p: Profile): number | null => {
  const src = p.next_invoice_date || p.start_date;
  if (!src) return null;
  const d = new Date(String(src) + (String(src).length === 10 ? 'T00:00:00' : ''));
  return isNaN(d.getTime()) ? null : d.getDate();
};


/** Restsumme = offene Raten × Ratenbetrag */
const remainingAmount = (p: Profile) => remainingCount(p) * Number(p.total || 0);


export default function WiederkehrendeZahler() {
  const { region } = useAccountingRegion();
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [invoicesFor, setInvoicesFor] = useState<{ id: string; name: string } | null>(null);
  const { canWrite, isAdmin, canDelete } = useFinancePermissions();
  // Admin & Super Admin sehen standardmäßig ALLE Konten (inkl. gestoppt/SEPA) und alle Rechnungen (auch bezahlte)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'stopped' | 'sepa' | 'lawyer'>(isAdmin ? 'all' : 'active');
  // Kunden/Auftragsnummern mit Auftragsstatus „Anwalt"
  const [lawyerNames, setLawyerNames] = useState<Set<string>>(new Set());
  const [lawyerRefs, setLawyerRefs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_number, customers(company_name, contact_name)')
        .ilike('order_status', 'anwalt')
        .limit(2000);
      if (cancelled || !data) return;
      const names = new Set<string>();
      const refs = new Set<string>();
      for (const o of data as any[]) {
        if (o.order_number) refs.add(String(o.order_number).toLowerCase());
        const c = o.customers;
        if (c?.company_name) names.add(String(c.company_name).trim().toLowerCase());
        if (c?.contact_name) names.add(String(c.contact_name).trim().toLowerCase());
      }
      setLawyerNames(names);
      setLawyerRefs(refs);
    })();
    return () => { cancelled = true; };
  }, []);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue' | 'draft'>('all');

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState<20 | 50 | 100 | 'all'>(20);
  type SortKey = 'recent_added' | 'date_new' | 'date_old' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc' | 'day_asc' | 'day_desc';
  const [sortBy, setSortBy] = useState<SortKey>('recent_added');
  type DayFilter = 'all' | '1' | '15' | 'other';
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');

  const [editProfile, setEditProfile] = useState<EditableProfile | null>(null);
  const [bookInvoice, setBookInvoice] = useState<BookableInvoice | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<PdfInvoiceRef | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Rollen laden asynchron: sobald Admin erkannt wird, alles anzeigen (solange der Filter nicht manuell geändert wurde)
  const filterTouched = useRef(false);
  useEffect(() => {
    if (isAdmin && !filterTouched.current) {
      setStatusFilter('all');
      setInvoiceStatusFilter('all');
    }
  }, [isAdmin]);




  /** Vertrag endgültig beenden → Bereich „RATEN ENDE LEGAL“ */
  async function endLegalProfile(p: Profile) {
    if (!confirm(`Vertrag „${p.recurrence_name || p.reference_number || ''}“ BEENDEN?\n\nDer Kunde wird nach „RATEN ENDE LEGAL“ verschoben. Es werden keine wiederkehrenden Rechnungen mehr erstellt.`)) return;
    setStoppingId(p.id);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({ status: 'legal_ended' } as any)
      .eq('id', p.id);
    setStoppingId(null);
    if (error) {
      toast({ title: 'Beenden fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Vertrag beendet', description: 'Der Kunde liegt jetzt unter BUCHHALTUNG → RATEN ENDE LEGAL.' });
    setProfiles(prev => prev.filter(x => x.id !== p.id));
  }

  async function stopProfile(p: Profile) {
    if (!confirm(`Vertrag "${p.recurrence_name || p.reference_number || ''}" stoppen und zur Prüfung verschieben?`)) return;
    setStoppingId(p.id);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({ status: 'pruefung' } as any)
      .eq('id', p.id);
    setStoppingId(null);
    if (error) {
      toast({ title: 'Stopp fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Vertrag gestoppt', description: 'Der Datensatz liegt jetzt unter Prüfung.' });
    load();
  }

  // ---------- OPS: Mehrfachauswahl je Vertrag ----------
  const [opsBusy, setOpsBusy] = useState<string | null>(null);

  const isLawyerProfile = (p: Profile) => {
    const hay = `${p.reference_number ?? ''} ${p.recurrence_name ?? ''}`.toLowerCase();
    return Array.from(lawyerRefs).some(r => r && hay.includes(r));
  };

  const orderNumberOf = (p: Profile) => {
    const ref = (p.reference_number ?? '').trim();
    if (ref) return ref;
    const m = `${p.recurrence_name ?? ''}`.match(/\b(?:SO|AU)-\d+\b/i);
    return m ? m[0] : '';
  };

  async function notifyAdmins(title: string, message: string, actionUrl = '/finance/wiederkehrende-zahler') {
    try {
      const { data: roleRows } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', ['Admin', 'Super Admin']);
      const roleIds = (roleRows ?? []).map((r: any) => r.id);
      if (roleIds.length === 0) return;
      const { data: userRows } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role_id', roleIds);
      const userIds = Array.from(new Set((userRows ?? []).map((u: any) => u.user_id).filter(Boolean)));
      if (userIds.length === 0) return;
      await supabase.from('app_notifications').insert(
        userIds.map((uid) => ({
          user_id: uid,
          category: 'finance',
          title,
          message,
          priority: 'high',
          action_url: actionUrl,
        })) as any,
      );
    } catch {
      /* Best effort – Benachrichtigung darf die Aktion nicht blockieren */
    }
  }

  async function opsMarkLawyer(p: Profile) {
    const orderNo = orderNumberOf(p);
    if (!orderNo) {
      toast({ title: 'Keine Auftragsnummer', description: 'Für diesen Vertrag ist keine Referenz hinterlegt.', variant: 'destructive' });
      return;
    }
    setOpsBusy(p.id);
    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: 'Anwalt' } as any)
      .eq('order_number', orderNo)
      .select('id');
    setOpsBusy(null);
    if (error) {
      toast({ title: 'Anwalt fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: 'Auftrag nicht gefunden', description: `Kein Auftrag mit Nummer ${orderNo}.`, variant: 'destructive' });
      return;
    }
    setLawyerRefs(prev => new Set([...prev, orderNo.toLowerCase()]));
    toast({ title: 'Als Anwaltsfall markiert', description: `${orderNo} erscheint jetzt unter BUCHHALTUNG → Anwaltsfälle.` });
  }

  async function opsSetPaymentMode(p: Profile, mode: 'sepa' | 'self') {
    const base = (p.recurrence_name ?? '').replace(/\s*\bSEPA\b\s*[·|-]?\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
    const nextName = mode === 'sepa' ? `SEPA · ${base}`.trim() : base || (p.reference_number ?? '');
    setOpsBusy(p.id);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({ recurrence_name: nextName } as any)
      .eq('id', p.id);
    setOpsBusy(null);
    if (error) {
      toast({ title: 'Umstellung fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    if (mode === 'sepa') {
      await notifyAdmins(
        'SEPA-Mandat ausstellen',
        `Vertrag ${nextName} wurde auf SEPA umgestellt. Bitte SEPA-Mandat ausstellen und hinterlegen.`,
      );
      toast({ title: 'Auf SEPA umgestellt', description: 'Admins wurden an die Ausstellung des SEPA-Mandats erinnert.' });
    } else {
      toast({ title: 'Auf Selbstzahler umgestellt' });
    }
    load();
  }

  /** Nächstes Fälligkeitsdatum gemäß Intervall */
  const addInterval = (d: Date, freq: string | null, every: number | null) => {
    const e = every && every > 0 ? every : 1;
    const n = new Date(d);
    switch ((freq ?? 'months').toLowerCase()) {
      case 'days': n.setDate(n.getDate() + e); break;
      case 'weeks': n.setDate(n.getDate() + 7 * e); break;
      case 'years': n.setFullYear(n.getFullYear() + e); break;
      default: n.setMonth(n.getMonth() + e); break;
    }
    return n;
  };

  /** Vertrag reaktivieren: Auftrag zurück auf AKTIV, Label „Zahler", Rechnungen nachziehen */
  async function opsRateNeu(p: Profile) {
    const orderNo = orderNumberOf(p);
    if (!confirm(`„RATE NEU" für ${p.recurrence_name || orderNo || 'Vertrag'}?\n\nDer Auftrag wird auf AKTIV gesetzt, als „Zahler" gekennzeichnet und alle zurückliegenden Raten werden erzeugt.`)) return;
    setOpsBusy(p.id);
    try {
      // 1) Auftrag zurück auf AKTIV
      if (orderNo) {
        const { error: oErr } = await supabase
          .from('orders')
          .update({ order_status: 'aktiv', lawyer_reason: null } as any)
          .eq('order_number', orderNo);
        if (oErr) throw oErr;
      }

      // 2) Profil aktivieren + Label „Zahler"
      const base = (p.recurrence_name ?? '')
        .replace(/^\s*Zahler\s*[·|-]\s*/i, '')
        .trim();
      const nextName = `Zahler · ${base || p.reference_number || orderNo}`.trim();
      const { error: pErr } = await supabase
        .from('zoho_recurring_profiles')
        .update({ status: 'active', recurrence_name: nextName } as any)
        .eq('id', p.id);
      if (pErr) throw pErr;

      // 3) Zurückliegende Rechnungen gemäß Intervall nachziehen
      const existing = invoices.filter(i => i.zoho_recurring_invoice_id === p.zoho_recurring_invoice_id);
      const existingDates = new Set(existing.map(i => (i.invoice_date ?? '').slice(0, 10)));
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const startStr = p.start_date || p.next_invoice_date || p.created_at;
      const rows: any[] = [];
      if (startStr) {
        let cur = new Date(String(startStr).slice(0, 10));
        const endLimit = p.end_date ? new Date(p.end_date) : today;
        const stopAt = endLimit < today ? endLimit : today;
        let guard = 0;
        while (cur <= stopAt && guard < 240) {
          guard++;
          const iso = cur.toISOString().slice(0, 10);
          if (!existingDates.has(iso)) {
            const due = new Date(cur); due.setDate(due.getDate() + 14);
            rows.push({
              zoho_invoice_id: `local-${p.zoho_recurring_invoice_id || p.id}-${iso}`,
              zoho_recurring_invoice_id: p.zoho_recurring_invoice_id || null,
              invoice_number: `RN-${(p.reference_number || orderNo || 'VTR')}-${iso.replace(/-/g, '').slice(0, 6)}`,
              reference_number: p.reference_number || orderNo || null,
              customer_id: p.customer_id,
              customer_name: p.customer_name || p.company_name || null,
              invoice_date: iso,
              due_date: due.toISOString().slice(0, 10),
              total: Number(p.total || 0),
              balance: Number(p.total || 0),
              currency: p.currency || 'EUR',
              status: 'open',
              payment_status: 'unpaid',
              source_system: 'alixwork',
            });
          }
          cur = addInterval(cur, p.recurrence_frequency, p.repeat_every);
        }
      }

      if (rows.length > 0) {
        const { error: iErr } = await supabase
          .from('zoho_recurring_invoices')
          .upsert(rows as any, { onConflict: 'source_system,zoho_invoice_id' });
        if (iErr) throw iErr;
      }

      if (orderNo) setLawyerRefs(prev => { const n = new Set(prev); n.delete(orderNo.toLowerCase()); return n; });
      toast({
        title: 'RATE NEU ausgeführt',
        description: `${orderNo || 'Vertrag'} ist wieder AKTIV (Label „Zahler"), ${rows.length} zurückliegende Rate(n) erzeugt.`,
      });
      load();
    } catch (e: any) {
      toast({ title: 'RATE NEU fehlgeschlagen', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setOpsBusy(null);
    }
  }



  async function confirmDelete() {
    const p = deleteTarget;
    const reason = deleteReason.trim();
    if (!p) return;
    if (reason.length < 5) {
      toast({
        title: 'Löschgrund zu kurz',
        description: `Bitte noch ${5 - reason.length} Zeichen eingeben.`,
        variant: 'destructive',
      });
      return;
    }
    setDeletingId(p.id);

    const { error } = await supabase.rpc('delete_recurring_profile_with_reason' as any, {
      p_id: p.id,
      p_reason: reason,
    });

    setDeletingId(null);
    if (error) {
      toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }

    setDeleteTarget(null);
    setDeleteReason('');
    toast({ title: 'Buchung gelöscht', description: 'Löschgrund wurde im Audit-Protokoll gespeichert.' });
    load();
  }




  async function load() {
    setLoading(true);
    setError(null);
    const reg = region === 'CH' ? 'CH' : 'EU';
    // Timeout-Schutz: Seite darf nie endlos im Ladezustand hängen
    const withTimeout = <T,>(pr: PromiseLike<T>, ms = 25000): Promise<T> =>
      Promise.race([
        Promise.resolve(pr),
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung beim Laden (Datenbank überlastet). Bitte erneut versuchen.')), ms)),
      ]);
    try {
      // Nur noch die angelegten wiederkehrenden Buchungen (Verträge/Profile) —
      // Rechnungen werden ausschließlich unter RECHNUNGEN → Rechnungen geführt.
      const p = await withTimeout(
        supabase
          .from('zoho_recurring_profiles')
          // Nur benötigte Spalten — spart u. a. das große raw_data-JSON
          .select('id, zoho_recurring_invoice_id, recurrence_name, reference_number, status, customer_id, customer_name, company_name, recurrence_frequency, repeat_every, start_date, end_date, next_invoice_date, last_sent_date, delivery_date, delivery_source, total, currency, created_at')
          .eq('accounting_region', reg)
          // Beendete Verträge liegen unter RATEN ENDE LEGAL
          .neq('status', 'legal_ended')
          .order('created_at', { ascending: false, nullsFirst: false })
          .limit(5000)
      );
      if (p.error) { setError(p.error.message); setLoading(false); return; }
      setProfiles((p.data ?? []) as Profile[]);
      setInvoices([]);
    } catch (e: any) {
      setError(e?.message ?? 'Unbekannter Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  async function runSync() {
    setSyncing(true);
    try {
      const [a, b] = await Promise.all([
        supabase.functions.invoke('sync-zoho-recurring-profiles', {
          body: { source_system: 'zoho_eu_1', page: 1, per_page: 100, max_pages: 30 },
        }),
        supabase.functions.invoke('sync-zoho-recurring-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2024-01-01', page: 1, per_page: 200, max_pages: 30, fetch_details: false },
        }),
      ]);
      if (a.error || b.error) throw new Error(a.error?.message || b.error?.message);
      toast({ title: 'Sync gestartet', description: 'Profile & Rechnungen werden aktualisiert.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Sync fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const [prenotifBusy, setPrenotifBusy] = useState(false);
  async function runPrenotifications() {
    setPrenotifBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('recurring-prenotification', { body: {} });
      if (error) throw error;
      toast({
        title: 'Vorankündigungen verarbeitet',
        description: `Fällig am ${data?.due_date ?? ''}: ${data?.sent ?? 0} gesendet, ${data?.skipped ?? 0} übersprungen, ${data?.failed ?? 0} fehlgeschlagen.`,
      });
    } catch (e: any) {
      toast({ title: 'Vorankündigung fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setPrenotifBusy(false);
    }
  }

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    const keyOf = (cid: string | null, name: string | null) => cid || `name:${(name || 'Unbekannt').toLowerCase()}`;

    for (const p of profiles) {
      const k = keyOf(p.customer_id, p.company_name || p.customer_name);
      if (!map.has(k)) {
        map.set(k, {
          customer_id: p.customer_id || k,
          customer_name: p.company_name || p.customer_name || 'Unbekannt',
          profiles: [], invoices: [], monthly: 0, remaining: 0, ytdBilled: 0, openBalance: 0,
          lastInvoiceDate: null, nextInvoiceDate: null, newestCreatedAt: null, currency: p.currency || 'EUR',
          hasSepa: false,
        });
      }
      const g = map.get(k)!;
      g.profiles.push(p);
      if (isSepaProfile(p)) g.hasSepa = true;
      const isActive = (p.status ?? '').toLowerCase() === 'active';
      if (isActive && p.total) g.monthly += Number(p.total) * monthsFactor(p.recurrence_frequency, p.repeat_every);
      g.remaining += remainingAmount(p);
      if (p.next_invoice_date && (!g.nextInvoiceDate || p.next_invoice_date < g.nextInvoiceDate)) g.nextInvoiceDate = p.next_invoice_date;
      if (p.created_at && (!g.newestCreatedAt || p.created_at > g.newestCreatedAt)) g.newestCreatedAt = p.created_at;
    }

    return Array.from(map.values())
      .filter(g => {
        if (statusFilter === 'lawyer') {
          const n = (g.customer_name || '').trim().toLowerCase();
          if (n && lawyerNames.has(n)) return true;
          return g.profiles.some(p => {
            const hay = `${p.reference_number ?? ''} ${p.recurrence_name ?? ''}`.toLowerCase();
            return Array.from(lawyerRefs).some(r => r && hay.includes(r));
          });
        }
        if (statusFilter === 'sepa') return g.hasSepa;
        if (statusFilter === 'active') return !g.hasSepa && g.profiles.some(p => (p.status ?? '').toLowerCase() === 'active');
        if (statusFilter === 'stopped') return !g.hasSepa && g.profiles.length > 0 && g.profiles.every(p => (p.status ?? '').toLowerCase() !== 'active');
        return true;
      })
      .sort((a, b) => {
        const ac = a.newestCreatedAt || '';
        const bc = b.newestCreatedAt || '';
        if (ac !== bc) return bc.localeCompare(ac);
        return b.monthly - a.monthly;
      });
  }, [profiles, statusFilter, lawyerNames, lawyerRefs]);



  const filtered = useMemo(() => {
    let arr = groups;
    if (dayFilter !== 'all') {
      arr = arr.filter(g => g.profiles.some(p => {
        const d = profileDay(p);
        if (d == null) return false;
        if (dayFilter === '1') return d === 1;
        if (dayFilter === '15') return d === 15;
        return d !== 1 && d !== 15;
      }));
    }
    if (!search.trim()) return arr;
    const s = search.toLowerCase();
    return arr.filter(g =>
      g.customer_name.toLowerCase().includes(s) ||
      g.profiles.some(p => (p.recurrence_name ?? '').toLowerCase().includes(s) || (p.reference_number ?? '').toLowerCase().includes(s)) ||
      g.invoices.some(i => (i.invoice_number ?? '').toLowerCase().includes(s))
    );
  }, [groups, search, dayFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const gDay = (g: Group) => {
      const days = g.profiles.map(profileDay).filter((d): d is number => d != null);
      return days.length ? Math.min(...days) : 99;
    };
    switch (sortBy) {
      case 'recent_added': return arr.sort((a, b) => {
        const ac = a.newestCreatedAt || '';
        const bc = b.newestCreatedAt || '';
        if (ac !== bc) return bc.localeCompare(ac);
        return a.customer_name.localeCompare(b.customer_name, 'de');
      });
      case 'amount_desc': return arr.sort((a, b) => b.monthly - a.monthly);
      case 'amount_asc': return arr.sort((a, b) => a.monthly - b.monthly);
      case 'date_new': return arr.sort((a, b) => (b.newestCreatedAt || '').localeCompare(a.newestCreatedAt || ''));
      case 'date_old': return arr.sort((a, b) => (a.newestCreatedAt || '').localeCompare(b.newestCreatedAt || ''));
      case 'name_asc': return arr.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'de'));
      case 'name_desc': return arr.sort((a, b) => b.customer_name.localeCompare(a.customer_name, 'de'));
      case 'day_asc': return arr.sort((a, b) => gDay(a) - gDay(b) || a.customer_name.localeCompare(b.customer_name, 'de'));
      case 'day_desc': return arr.sort((a, b) => gDay(b) - gDay(a) || a.customer_name.localeCompare(b.customer_name, 'de'));
      default: return arr;
    }
  }, [filtered, sortBy]);


  const visible = useMemo(
    () => (pageSize === 'all' ? sorted : sorted.slice(0, pageSize)),
    [sorted, pageSize]
  );

  const totals = useMemo(() => {
    const allProfiles = filtered.flatMap(g => g.profiles);
    const isActive = (p: Profile) => (p.status ?? '').toLowerCase() === 'active';
    return {
      customers: filtered.length,
      monthly: filtered.reduce((s, g) => s + g.monthly, 0),
      remaining: filtered.reduce((s, g) => s + g.remaining, 0),
      ytd: filtered.reduce((s, g) => s + g.ytdBilled, 0),
      open: filtered.reduce((s, g) => s + g.openBalance, 0),
      activeProfiles: allProfiles.filter(isActive).length,
      sepaProfiles: allProfiles.filter(p => isSepaProfile(p)).length,
      selfPayProfiles: allProfiles.filter(p => !isSepaProfile(p) && isActive(p)).length,
      stoppedProfiles: allProfiles.filter(p => !isActive(p)).length,
      allProfiles: allProfiles.length,
    };
  }, [filtered]);

  const secondTile = useMemo(() => {
    switch (statusFilter) {
      case 'lawyer': return { label: 'Anwaltsfälle', value: totals.allProfiles };
      case 'sepa': return { label: 'SEPA-Verträge', value: totals.sepaProfiles };
      case 'stopped': return { label: 'Beendet', value: totals.stoppedProfiles };
      case 'active': return { label: 'Selbstzahler', value: totals.selfPayProfiles };
      default: return { label: 'Verträge gesamt', value: totals.allProfiles };
    }
  }, [statusFilter, totals]);


  // ---------- Auswahl & Export ----------
  const selectedGroups = useMemo(() => filtered.filter(g => selected[g.customer_id]), [filtered, selected]);
  const exportGroups = selectedGroups.length > 0 ? selectedGroups : filtered;
  const allSelected = filtered.length > 0 && filtered.every(g => selected[g.customer_id]);
  const someSelected = filtered.some(g => selected[g.customer_id]);

  function toggleAll(v: boolean) {
    setSelected(prev => {
      const next = { ...prev };
      filtered.forEach(g => { if (v) next[g.customer_id] = true; else delete next[g.customer_id]; });
      return next;
    });
  }

  type ExportRow = Record<string, string | number>;
  function buildRows(): ExportRow[] {
    const rows: ExportRow[] = [];
    for (const g of exportGroups) {
      if (g.profiles.length === 0) {
        rows.push({
          Kunde: g.customer_name, Vertrag: '—', Referenz: '', Status: '',
          Frequenz: '', Erfasst: '', Start: '', Ende: '', 'Letzte Rechnung': fmtDate(g.lastInvoiceDate),
          'Nächste Rechnung': fmtDate(g.nextInvoiceDate), Währung: g.currency,
          Betrag: 0, Monatlich: 0, 'Restraten': 0, Restsumme: 0, 'Abgerechnet YTD': Number(g.ytdBilled.toFixed(2)), 'Offener Betrag': Number(g.openBalance.toFixed(2)),
          SEPA: g.hasSepa ? 'Ja' : 'Nein',
        });
        continue;
      }
      for (const p of g.profiles) {
        rows.push({
          Kunde: g.customer_name,
          Vertrag: p.recurrence_name ?? '—',
          Referenz: p.reference_number ?? '',
          Status: p.status ?? '',
          Frequenz: `${p.repeat_every ?? 1}x ${p.recurrence_frequency ?? ''}`.trim(),
          Erfasst: fmtDate(p.created_at),
          Lieferung: fmtDate(p.delivery_date),
          Start: fmtDate(p.start_date),

          Ende: fmtDate(p.end_date),
          'Letzte Rechnung': fmtDate(p.last_sent_date),
          'Nächste Rechnung': fmtDate(p.next_invoice_date),
          Währung: p.currency || g.currency,
          Betrag: Number(Number(p.total || 0).toFixed(2)),
          Monatlich: Number((Number(p.total || 0) * monthsFactor(p.recurrence_frequency, p.repeat_every)).toFixed(2)),
          'Restraten': remainingCount(p),
          Restsumme: Number(remainingAmount(p).toFixed(2)),
          'Abgerechnet YTD': Number(g.ytdBilled.toFixed(2)),
          'Offener Betrag': Number(g.openBalance.toFixed(2)),
          SEPA: g.hasSepa ? 'Ja' : 'Nein',
        });
      }
    }
    return rows;
  }

  const fileBase = () => `wiederkehrende-zahler-${region}-${new Date().toISOString().slice(0, 10)}`;

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = buildRows();
    if (!rows.length) { toast({ title: 'Keine Daten', description: 'Nichts zu exportieren.', variant: 'destructive' }); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '\uFEFF' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileBase()}.csv`);
    toast({ title: 'CSV exportiert', description: `${rows.length} Zeilen` });
  }

  async function exportXlsx() {
    const rows = buildRows();
    if (!rows.length) { toast({ title: 'Keine Daten', description: 'Nichts zu exportieren.', variant: 'destructive' }); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(c => ({ wch: Math.max(12, c.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wiederkehrende Zahler');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase()}.xlsx`);
    toast({ title: 'Excel exportiert', description: `${rows.length} Zeilen` });
  }

  async function exportPdf() {
    const rows = buildRows();
    if (!rows.length) { toast({ title: 'Keine Daten', description: 'Nichts zu exportieren.', variant: 'destructive' }); return; }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const cols = ['Kunde', 'Vertrag', 'Referenz', 'Status', 'Frequenz', 'Erfasst', 'Start', 'Ende', 'Nächste Rechnung', 'Betrag', 'Monatlich', 'Restsumme'];
    const sumMonthly = exportGroups.reduce((s, g) => s + g.monthly, 0);
    doc.setFontSize(14);
    doc.text(`Wiederkehrende Zahler · Buchhaltung ${region}`, 40, 40);
    doc.setFontSize(9);
    doc.text(
      `${exportGroups.length} Kunden · ${rows.length} Verträge · Volumen/Monat ${fmt(sumMonthly)} · Stand ${new Date().toLocaleDateString('de-DE')}`,
      40, 56,
    );
    autoTable(doc, {
      startY: 72,
      head: [cols],
      body: rows.map(r => cols.map(c => (typeof r[c] === 'number' ? fmt(Number(r[c]), String(r['Währung'] || 'EUR')) : String(r[c] ?? '')))),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' } },
    });
    doc.save(`${fileBase()}.pdf`);
    toast({ title: 'PDF exportiert', description: `${rows.length} Zeilen` });
  }


  if (loading) return <div className="space-y-6"><SkeletonKpiGrid count={5} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiederkehrende Zahler"
        subtitle="Angelegte wiederkehrende Buchungen & Verträge aus Zoho Deutschland — gruppiert nach Kundenkonto"
        icon={Repeat}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="done" label={`${profiles.length}`} dotOnly />}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/finance/wz-erinnerungen"><Mail className="w-4 h-4 mr-2" />Erinnerungen</a>
            </Button>
            {canWrite && (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Neuanlage
              </Button>
            )}
            <Button onClick={runSync} disabled={syncing} size="sm" variant="outline">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Jetzt synchronisieren
            </Button>
            <Button onClick={runPrenotifications} disabled={prenotifBusy} size="sm" variant="outline" title="Sendet die Vorankündigung an alle Kunden mit Fälligkeit in 5 Tagen">
              {prenotifBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Vorankündigung (5 Tage)
            </Button>
          </div>
        }

      />

      {error && <PageError message={error} onRetry={load} />}

      <div className="grid md:grid-cols-4 gap-4">
        <KpiTile label="Kunden" value={totals.customers} icon={Repeat} accent="sky" />
        <KpiTile label={secondTile.label} value={secondTile.value} icon={Repeat} accent="violet" />
        <KpiTile label="Volumen / Monat" value={fmt(totals.monthly)} icon={Repeat} accent="gold" />
        <KpiTile label="Restsumme offen" value={fmt(totals.remaining)} icon={Repeat} accent="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Kunde oder Vertragsnr. suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          {(['sepa', 'active', 'stopped', 'lawyer', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => { filterTouched.current = true; setStatusFilter(s); }}
              className={`px-3 py-1 text-xs rounded ${statusFilter === s ? (s === 'sepa' ? 'bg-emerald-600 text-white' : s === 'lawyer' ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground') : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'sepa' ? 'SEPA' : s === 'active' ? 'Selbstzahler' : s === 'stopped' ? 'Beendet' : s === 'lawyer' ? 'Anwaltsfälle' : 'Alle'}
            </button>
          ))}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/finance/rechnungen"><FileText className="w-4 h-4 mr-2" />Rechnungen öffnen</Link>
        </Button>

        <div className="flex gap-1 border border-border rounded-md p-1">
          {([['all', 'Alle Zahltage'], ['1', '1. des Monats'], ['15', '15. des Monats'], ['other', 'Sonstige']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setDayFilter(v as DayFilter)}
              className={`px-3 py-1 text-xs rounded ${dayFilter === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Sortierung:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="recent_added">Zuletzt hinzugefügt</option>
            <option value="day_asc">Zahltag aufsteigend (1. → 31.)</option>
            <option value="day_desc">Zahltag absteigend (31. → 1.)</option>
            <option value="amount_desc">Betrag absteigend</option>
            <option value="amount_asc">Betrag aufsteigend</option>
            <option value="date_new">Datum neueste</option>
            <option value="date_old">Datum älteste</option>
            <option value="name_asc">Alphabetisch A–Z</option>
            <option value="name_desc">Alphabetisch Z–A</option>

            <option value="name_desc">Alphabetisch Z–A</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 20 | 50 | 100))}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">Alle</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none border border-border rounded-md px-3 py-2">
          <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Alle markieren" />
          {allSelected ? 'Auswahl aufheben' : 'Alle markieren'}
          {someSelected && <span className="text-primary font-medium">({selectedGroups.length})</span>}
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export {someSelected ? `(${selectedGroups.length} markiert)` : `(alle ${filtered.length})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {exportGroups.length} Kunden werden exportiert
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportPdf}><FileText className="w-4 h-4 mr-2" />PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel (XLSX)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv}><FileJson className="w-4 h-4 mr-2" />CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      <DataCard
        title={`Kundenkonten (${visible.length} / ${filtered.length})`}
        actions={
          <div className="flex items-center gap-4 text-sm">
            <div className="text-muted-foreground">
              Σ Verträge monatlich:{' '}
              <span className="font-semibold text-primary tabular-nums">{fmt(totals.monthly)}</span>
            </div>
            <div className="text-muted-foreground">
              Σ Restsumme:{' '}
              <span className="font-semibold text-emerald-500 tabular-nums">{fmt(totals.remaining)}</span>
            </div>
            <div className="text-muted-foreground">
              Aktive Verträge:{' '}
              <span className="font-semibold text-foreground tabular-nums">{totals.activeProfiles}</span>
            </div>
          </div>
        }
      >
        <div className="divide-y divide-border -mx-5">
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-muted-foreground text-sm">Keine Treffer.</div>
          )}
          {visible.map(g => {
            const isOpen = !!open[g.customer_id];
            const activeP = g.profiles.filter(p => (p.status ?? '').toLowerCase() === 'active').length;
            return (
              <div key={g.customer_id} className="px-5">
                <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!selected[g.customer_id]}
                  onCheckedChange={(v) => setSelected(s => ({ ...s, [g.customer_id]: !!v }))}
                  aria-label={`${g.customer_name} markieren`}
                />
                <button
                  className="flex-1 min-w-0 py-3 flex items-center gap-3 hover:bg-muted/30 px-2 rounded transition-colors text-left"
                  onClick={() => setOpen(s => ({ ...s, [g.customer_id]: !s[g.customer_id] }))}
                >

                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {g.hasSepa ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">SEPA</Badge>
                      ) : (
                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">Zahler</Badge>
                      )}
                      <span
                        role="link"
                        tabIndex={0}
                        className="truncate text-primary hover:underline cursor-pointer"
                        title="Rechnungen anzeigen"
                        onClick={(e) => { e.stopPropagation(); setInvoicesFor({ id: g.customer_id, name: g.customer_name }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setInvoicesFor({ id: g.customer_id, name: g.customer_name }); } }}
                      >
                        {g.customer_name}
                      </span>
                    </div>
                    {g.remaining > 0 && (
                      <div className="text-[11px] mt-0.5">
                        <span className="text-muted-foreground">Restsumme: </span>
                        <span className="font-semibold text-primary tabular-nums">{fmt(g.remaining, g.currency)}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                      <span>{activeP} aktiv / {g.profiles.length} Verträge</span>
                      {g.nextInvoiceDate && <span>nächste: {fmtDate(g.nextInvoiceDate)}</span>}
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-end text-sm">
                    <span className="font-semibold tabular-nums">{fmt(g.monthly, g.currency)}<span className="text-xs text-muted-foreground"> /Mon.</span></span>
                  </div>

                </button>
                </div>


                {isOpen && (
                  <div className="pb-4 pl-7 space-y-4 animate-fade-in">
                    {g.profiles.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-medium mb-2">Verträge / Profile</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left px-3 py-2">Name / Referenz</th>
                                <th className="text-left px-3 py-2">Erfasst</th>
                                <th className="text-left px-3 py-2">Frequenz</th>
                                <th className="text-left px-3 py-2">Lieferung</th>
                                <th className="text-left px-3 py-2">Start</th>

                                <th className="text-left px-3 py-2">Ende</th>
                                <th className="text-left px-3 py-2">Letzte</th>
                                <th className="text-left px-3 py-2">Nächste</th>
                                <th className="text-right px-3 py-2">Betrag</th>
                                <th className="text-right px-3 py-2">Monatlich</th>
                                <th className="text-right px-3 py-2">Restsumme</th>
                                <th className="text-left px-3 py-2">Status</th>

                              </tr>
                            </thead>
                            <tbody>
                              {g.profiles.map(p => {
                                const monthly = Number(p.total || 0) * monthsFactor(p.recurrence_frequency, p.repeat_every);
                                return (
                                <React.Fragment key={p.id}>
                                <tr className="border-t border-border">
                                  <td className="px-3 py-2">
                                    <div className="font-medium flex items-center gap-2">
                                      {isLawyerProfile(p) && (
                                        <Badge className="bg-red-600 hover:bg-red-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">ANWALT</Badge>
                                      )}
                                      {isSepaProfile(p) ? (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">SEPA</Badge>
                                      ) : (
                                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">Zahler</Badge>
                                      )}
                                      <span>{p.recurrence_name || '—'}</span>
                                    </div>
                                    {p.reference_number && <div className="text-xs text-muted-foreground font-mono">{p.reference_number}</div>}
                                  </td>
                                  <td className="px-3 py-2">{fmtDate(p.created_at)}</td>
                                  <td className="px-3 py-2">{p.repeat_every ?? 1}× {p.recurrence_frequency ?? '—'}</td>
                                  <td className="px-3 py-2">
                                    {p.delivery_date ? (
                                      <>
                                        {fmtDate(p.delivery_date)}
                                        {p.delivery_source && <div className="text-[10px] text-muted-foreground">{p.delivery_source}</div>}
                                      </>
                                    ) : '—'}
                                  </td>
                                  <td className="px-3 py-2">{fmtDate(p.start_date)}</td>

                                  <td className="px-3 py-2">{fmtDate(p.end_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.last_sent_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.next_invoice_date)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(p.total || 0), p.currency || 'EUR')}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(monthly, p.currency || 'EUR')}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-primary">
                                    {remainingCount(p) > 0 ? (
                                      <>
                                        {fmt(remainingAmount(p), p.currency || 'EUR')}
                                        <div className="text-[10px] text-muted-foreground font-normal">{remainingCount(p)} Raten</div>
                                      </>
                                    ) : '—'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant={(p.status ?? '').toLowerCase() === 'active' ? 'default' : 'secondary'} className="capitalize">{p.status ?? '—'}</Badge>
                                  </td>
                                </tr>
                                <tr className="bg-muted/20">
                                  <td className="px-3 pb-3 pt-0" colSpan={12}>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!canWrite}
                                        onClick={() => setEditProfile(p as EditableProfile)}
                                      >
                                        Bearbeiten
                                      </Button>
                                      {((p.status ?? '').toLowerCase() !== 'active' || isLawyerProfile(p)) && (
                                        <Button
                                          size="sm"
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                          disabled={!canWrite || opsBusy === p.id}
                                          onClick={() => opsRateNeu(p)}
                                          title="Auftrag reaktivieren, Label „Zahler“ setzen und zurückliegende Raten erzeugen"
                                        >
                                          {opsBusy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                                          RATE NEU
                                        </Button>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="sm" variant="secondary" disabled={!canWrite || opsBusy === p.id || stoppingId === p.id}>
                                            {opsBusy === p.id || stoppingId === p.id
                                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              : <>OPS <ChevronDown className="w-3.5 h-3.5 ml-1" /></>}
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-56">
                                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Vertragsaktionen</DropdownMenuLabel>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => opsMarkLawyer(p)}>
                                            Anwalt – in Anwaltsfälle kopieren
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-emerald-500 focus:text-emerald-500" onClick={() => opsSetPaymentMode(p, 'sepa')}>
                                            SEPA – Zahlart umstellen
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-blue-500 focus:text-blue-500" onClick={() => opsSetPaymentMode(p, 'self')}>
                                            Selbstzahler – Zahlart umstellen
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            disabled={(p.status ?? '').toLowerCase() === 'pruefung'}
                                            onClick={() => stopProfile(p)}
                                          >
                                            STOP – keine weiteren Rechnungen
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      {canDelete && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-destructive hover:text-destructive"
                                          disabled={deletingId === p.id}
                                          onClick={() => { setDeleteTarget(p); setDeleteReason(''); }}
                                          title="Buchung löschen"
                                        >
                                          {deletingId === p.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Trash2 className="w-3.5 h-3.5" />}
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                </React.Fragment>
                                );

                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                                <td className="px-3 py-2" colSpan={7}>Summe ({g.profiles.length} Verträge, davon {activeP} aktiv)</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmt(g.profiles.reduce((s, p) => s + Number(p.total || 0), 0), g.currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-primary">
                                  {fmt(g.monthly, g.currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-primary">
                                  {fmt(g.remaining, g.currency)}
                                </td>
                                <td />
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Rechnungen zu diesem Kunden findest du unter{' '}
                      <Link to="/finance/rechnungen" className="text-primary hover:underline">Rechnungen</Link>.
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DataCard>

      <p className="text-xs text-muted-foreground text-center">
        Quelle: Zoho Deutschland (zoho_eu_1) · Tägliche Synchronisation 23:45 Uhr · {profiles.length} wiederkehrende Buchungen · Rechnungen siehe RECHNUNGEN → Rechnungen
      </p>

      <RecurringProfileEditDialog
        profile={editProfile}
        open={!!editProfile}
        onOpenChange={(v) => { if (!v) setEditProfile(null); }}
        onSaved={load}
      />
      <InvoicePdfDialog
        invoice={pdfInvoice}
        open={!!pdfInvoice}
        onOpenChange={(v) => { if (!v) setPdfInvoice(null); }}
      />
      <CustomerInvoicesDialog
        open={!!invoicesFor}
        onOpenChange={(v) => { if (!v) setInvoicesFor(null); }}
        customerId={invoicesFor?.id}
        customerName={invoicesFor?.name}
      />
      <RecurringInvoiceBookDialog
        invoice={bookInvoice}
        open={!!bookInvoice}
        onOpenChange={(v) => { if (!v) setBookInvoice(null); }}
        onBooked={load}
      />
      <RecurringProfileCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        region={region === 'CH' ? 'CH' : 'EU'}
        onCreated={load}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deletingId) { setDeleteTarget(null); setDeleteReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buchung löschen</DialogTitle>
            <DialogDescription>
              „{deleteTarget?.recurrence_name || deleteTarget?.reference_number || '—'}" wird endgültig gelöscht.
              Bitte geben Sie einen Löschgrund an (Pflichtfeld, min. 5 Zeichen). Er wird im Audit-Protokoll gespeichert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Löschgrund *</Label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              maxLength={500}
              rows={4}
              placeholder="z. B. Doppelerfassung, Vertrag storniert …"
              onChange={(e) => setDeleteReason(e.target.value)}
            />
            <p className={deleteReason.trim().length < 5 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {deleteReason.trim().length}/500 Zeichen
              {deleteReason.trim().length < 5 && ` · Noch ${5 - deleteReason.trim().length} Zeichen erforderlich`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={!!deletingId} onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={deleteReason.trim().length < 5 || !!deletingId}
              onClick={confirmDelete}
            >
              {deletingId
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : deleteReason.trim().length < 5
                  ? `Noch ${5 - deleteReason.trim().length} Zeichen`
                  : 'Endgültig löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
