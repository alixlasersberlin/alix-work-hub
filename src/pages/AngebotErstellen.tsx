import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilePlus, Plus, Trash2, Search, Loader2, FileDown, Inbox, ChevronDown, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type LineItem = {
  id: string;
  item_id?: string;
  name: string;
  description: string;
  sku: string;
  quantity: number;
  rate: number;
  tax_percentage: number;
};

const newLine = (): LineItem => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  sku: '',
  quantity: 1,
  rate: 0,
  tax_percentage: 19,
});

export default function AngebotErstellen() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [offerNumber, setOfferNumber] = useState(`ANG-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`);
  const [offerDate, setOfferDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  // Zahlungsberechnung
  const [payType, setPayType] = useState<'Direktkauf' | 'Ratenzahlung' | 'Leasing' | 'Mietkauf' | 'Alix Flex'>('Direktkauf');
  const [payPrice, setPayPrice] = useState<string>('');
  const [payDown, setPayDown] = useState<string>('');
  const [payTerm, setPayTerm] = useState<number>(24);
  const [loading, setLoading] = useState(true);

  const [leadsOpen, setLeadsOpen] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Load ALL customers in chunks (Supabase caps single queries at 1000 rows)
      const CHUNK = 1000;
      const allCustomers: any[] = [];
      for (let from = 0; ; from += CHUNK) {
        const { data: chunk, error: chunkErr } = await supabase
          .from('customers')
          .select('id, company_name, contact_name, email, phone, billing_address, shipping_address, external_customer_id, source_system')
          .order('company_name')
          .range(from, from + CHUNK - 1);
        if (chunkErr || !chunk || chunk.length === 0) break;
        allCustomers.push(...chunk);
        if (chunk.length < CHUNK) break;
      }
      const { data: i } = await supabase
        .from('zoho_items')
        .select('id, name, sku, description, rate, tax_percentage, unit')
        .eq('status', 'active')
        .order('name')
        .limit(2000);
      const c = allCustomers;
      setCustomers(c);
      setItems(i ?? []);
      setLoading(false);

      // Handoff aus Sales-Lead (SALES MANAGEMENT → Anfragen → "Angebot erstellen")
      try {
        const raw = sessionStorage.getItem('sales_lead_handoff_v1');
        if (raw) {
          const h = JSON.parse(raw);
          sessionStorage.removeItem('sales_lead_handoff_v1');
          if (h.customer_id) setCustomerId(h.customer_id);
          else if (h.customer_email || h.customer_company) {
            const match = (c ?? []).find((cu: any) =>
              (h.customer_email && cu.email?.toLowerCase() === String(h.customer_email).toLowerCase()) ||
              (h.customer_company && cu.company_name === h.customer_company)
            );
            if (match) setCustomerId(match.id);
            else setCustomerSearch(h.customer_company || h.customer_email || '');
          }
          if (h.notes) setNotes(h.notes);
        }
      } catch { /* ignore */ }
    }
    load();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers.filter(c =>
      c.company_name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [customers, customerSearch]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase().trim();
    if (!q) return items.slice(0, 30);
    return items.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const baseCustomer = customers.find(c => c.id === customerId);
  const [customerOverride, setCustomerOverride] = useState<Record<string, any>>({});
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [draft, setDraft] = useState<any>({});
  const selectedCustomer = baseCustomer ? { ...baseCustomer, ...customerOverride } : null;

  // Reset override when switching customer
  useEffect(() => {
    setCustomerOverride({});
    setEditingCustomer(false);
  }, [customerId]);

  function startEditCustomer() {
    if (!selectedCustomer) return;
    const ba = selectedCustomer.billing_address || {};
    const sa = selectedCustomer.shipping_address || {};
    setDraft({
      company_name: selectedCustomer.company_name || '',
      contact_name: selectedCustomer.contact_name || '',
      email: selectedCustomer.email || '',
      phone: selectedCustomer.phone || '',
      ba_address: ba.address || '',
      ba_street2: ba.street2 || '',
      ba_zip: ba.zip || '',
      ba_city: ba.city || '',
      ba_country: ba.country || '',
      sa_address: sa.address || '',
      sa_street2: sa.street2 || '',
      sa_zip: sa.zip || '',
      sa_city: sa.city || '',
      sa_country: sa.country || '',
    });
    setEditingCustomer(true);
  }

  function buildOverrideFromDraft() {
    const ba = { ...(baseCustomer?.billing_address || {}), address: draft.ba_address, street2: draft.ba_street2, zip: draft.ba_zip, city: draft.ba_city, country: draft.ba_country };
    const sa = { ...(baseCustomer?.shipping_address || {}), address: draft.sa_address, street2: draft.sa_street2, zip: draft.sa_zip, city: draft.sa_city, country: draft.sa_country };
    return {
      company_name: draft.company_name,
      contact_name: draft.contact_name,
      email: draft.email,
      phone: draft.phone,
      billing_address: ba,
      shipping_address: sa,
    };
  }

  function applyDraftLocal() {
    setCustomerOverride(buildOverrideFromDraft());
    setEditingCustomer(false);
    toast.success('Änderungen für dieses Angebot übernommen.');
  }

  async function saveDraftToCustomer() {
    if (!baseCustomer) return;
    setSavingCustomer(true);
    const payload = buildOverrideFromDraft();
    const { error } = await supabase.from('customers').update(payload).eq('id', baseCustomer.id);
    setSavingCustomer(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    setCustomers(prev => prev.map(c => c.id === baseCustomer.id ? { ...c, ...payload } : c));
    setCustomerOverride({});
    setEditingCustomer(false);
    toast.success('Kundendaten in Stammdaten gespeichert.');
  }

  async function openLeadsPanel() {
    setLeadsOpen(v => !v);
    if (leads.length === 0 && !leadsLoading) {
      setLeadsLoading(true);
      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, created_at, first_name, last_name, company, email, phone, country_code, requested_products, interests, additional_interests, delivery_preference, consultation_type, notes, message, lead_score, score_category, converted_customer_id')
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) toast.error('Anfragen konnten nicht geladen werden.');
      setLeads(data ?? []);
      setLeadsLoading(false);
    }
  }

  const filteredLeads = useMemo(() => {
    const q = leadSearch.toLowerCase().trim();
    if (!q) return leads.slice(0, 80);
    return leads.filter(l =>
      (l.first_name || '').toLowerCase().includes(q) ||
      (l.last_name || '').toLowerCase().includes(q) ||
      (l.company || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q)
    ).slice(0, 80);
  }, [leads, leadSearch]);

  function applyLead(l: any) {
    // 1) Kunde verbinden
    let matched: any = null;
    if (l.converted_customer_id) {
      matched = customers.find(c => c.id === l.converted_customer_id) || null;
    }
    if (!matched && l.email) {
      matched = customers.find(c => (c.email || '').toLowerCase() === String(l.email).toLowerCase()) || null;
    }
    if (!matched && l.company) {
      matched = customers.find(c => (c.company_name || '').toLowerCase() === String(l.company).toLowerCase()) || null;
    }
    if (matched) {
      setCustomerId(matched.id);
      setCustomerSearch('');
      toast.success(`Kunde übernommen: ${matched.company_name || matched.contact_name}`);
    } else {
      setCustomerId('');
      setCustomerSearch(l.company || `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || l.email || '');
      toast.info('Kein passender Kunde gefunden – bitte unten aus der Liste auswählen oder anlegen.');
    }

    // 2) Notizen aus Anfrage zusammenstellen
    const noteParts: string[] = [];
    const fullName = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim();
    if (fullName) noteParts.push(`Anfrage von: ${fullName}${l.company ? ` (${l.company})` : ''}`);
    if (l.email) noteParts.push(`E-Mail: ${l.email}`);
    if (l.phone) noteParts.push(`Telefon: ${[l.country_code, l.phone].filter(Boolean).join(' ')}`);
    if (l.consultation_type) noteParts.push(`Beratungsart: ${l.consultation_type}`);
    if (l.delivery_preference) noteParts.push(`Lieferzeitraum: ${l.delivery_preference}`);
    if (Array.isArray(l.interests) && l.interests.length) noteParts.push(`Interessen: ${l.interests.join(', ')}`);
    if (Array.isArray(l.additional_interests) && l.additional_interests.length) noteParts.push(`Zusätzlich: ${l.additional_interests.join(', ')}`);
    if (l.requested_products) noteParts.push(`Gewünschte Produkte: ${l.requested_products}`);
    if (l.message) noteParts.push(`Nachricht: ${l.message}`);
    if (l.notes) noteParts.push(`Notizen: ${l.notes}`);
    setNotes(prev => (prev ? prev + '\n\n' : '') + noteParts.join('\n'));

    setLeadsOpen(false);
  }


  const addItem = (it: any) => {
    setLines(prev => [
      ...prev.filter(l => l.name || l.sku || l.rate),
      {
        id: crypto.randomUUID(),
        item_id: it.id,
        name: it.name || '',
        description: it.description || '',
        sku: it.sku || '',
        quantity: 1,
        rate: Number(it.rate || 0),
        tax_percentage: Number(it.tax_percentage || 19),
      },
    ]);
    setItemSearch('');
  };

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => {
    setLines(prev => (prev.length === 1 ? [newLine()] : prev.filter(l => l.id !== id)));
  };

  // Wenn MwSt > 0: eingegebener Einzelpreis ist BRUTTO (inkl. MwSt).
  // Wenn MwSt = 0: Einzelpreis ist Netto.
  const lineCalc = (l: LineItem) => {
    const qty = Number(l.quantity) || 0;
    const rate = Number(l.rate) || 0;
    const tax = Number(l.tax_percentage) || 0;
    if (tax > 0) {
      const gross = qty * rate;
      const net = gross / (1 + tax / 100);
      return { net, tax: gross - net, gross };
    }
    const net = qty * rate;
    return { net, tax: 0, gross: net };
  };

  const totals = useMemo(() => {
    let net = 0, tax = 0, gross = 0;
    for (const l of lines) {
      const c = lineCalc(l);
      net += c.net; tax += c.tax; gross += c.gross;
    }
    return { net, tax, gross };
  }, [lines]);

  const fmtMoney = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const buildPDF = (): jsPDF | null => {
    if (!selectedCustomer) {
      toast.error('Bitte zuerst einen Kunden auswählen.');
      return null;
    }
    const validLines = lines.filter(l => l.name && l.quantity > 0);
    if (validLines.length === 0) {
      toast.error('Bitte mindestens eine Position erfassen.');
      return null;
    }

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Angebot', 14, 20);
    doc.setFontSize(10);
    doc.text(`Angebotsnummer: ${offerNumber}`, 14, 30);
    doc.text(`Datum: ${new Date(offerDate).toLocaleDateString('de-DE')}`, 14, 36);
    if (validUntil) doc.text(`Gültig bis: ${new Date(validUntil).toLocaleDateString('de-DE')}`, 14, 42);

    doc.setFontSize(11);
    doc.text('Kunde:', 14, 56);
    doc.setFontSize(10);
    let cy = 62;
    doc.text(selectedCustomer.company_name || selectedCustomer.contact_name || '—', 14, cy); cy += 6;
    if (selectedCustomer.contact_name && selectedCustomer.company_name) {
      doc.text(`z.Hd. ${selectedCustomer.contact_name}`, 14, cy); cy += 6;
    }
    const ba: any = selectedCustomer.billing_address || {};
    if (ba.address) { doc.text(String(ba.address), 14, cy); cy += 6; }
    if (ba.street2) { doc.text(String(ba.street2), 14, cy); cy += 6; }
    const zipCity = [ba.zip, ba.city].filter(Boolean).join(' ');
    if (zipCity) { doc.text(zipCity, 14, cy); cy += 6; }
    if (ba.country) { doc.text(String(ba.country), 14, cy); cy += 6; }
    if (selectedCustomer.email) { doc.text(`E-Mail: ${selectedCustomer.email}`, 14, cy); cy += 6; }
    if (selectedCustomer.phone) { doc.text(`Tel.: ${selectedCustomer.phone}`, 14, cy); cy += 6; }

    autoTable(doc, {
      startY: Math.max(80, cy + 4),
      head: [['Pos', 'Artikel', 'Menge', 'Einzelpreis', 'MwSt', 'Summe']],
      body: validLines.map((l, idx) => [
        idx + 1,
        `${l.name}${l.sku ? ` (${l.sku})` : ''}${l.description ? `\n${l.description}` : ''}`,
        l.quantity,
        fmtMoney(l.rate),
        `${l.tax_percentage}%`,
        fmtMoney(l.quantity * l.rate),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Netto: ${fmtMoney(totals.net)}`, 140, finalY);
    doc.text(`MwSt: ${fmtMoney(totals.tax)}`, 140, finalY + 6);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Gesamt: ${fmtMoney(totals.gross)}`, 140, finalY + 14);

    if (notes) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text('Anmerkungen:', 14, finalY + 28);
      doc.text(doc.splitTextToSize(notes, 180), 14, finalY + 34);
    }

    return doc;
  };

  const generatePDF = () => {
    const doc = buildPDF();
    if (!doc) return;
    doc.save(`${offerNumber}.pdf`);
    toast.success('Angebot als PDF erstellt.');
  };

  const buildOfferSnapshot = () => ({
    offerNumber,
    offerDate,
    validUntil,
    notes,
    customer: selectedCustomer ? {
      id: selectedCustomer.id,
      company_name: selectedCustomer.company_name,
      contact_name: selectedCustomer.contact_name,
      email: selectedCustomer.email,
      phone: selectedCustomer.phone,
    } : null,
    lines: lines.filter(l => l.name && l.quantity > 0),
    totals,
    payment: { type: payType, price: parseFloat(payPrice) || 0, down: parseFloat(payDown) || 0, term: payTerm },
    createdAt: new Date().toISOString(),
  });

  const saveOffer = (silent = false): boolean => {
    if (!selectedCustomer) { toast.error('Bitte zuerst einen Kunden auswählen.'); return false; }
    const validLines = lines.filter(l => l.name && l.quantity > 0);
    if (validLines.length === 0) { toast.error('Bitte mindestens eine Position erfassen.'); return false; }
    try {
      const KEY = 'alix_angebote_v1';
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) : [];
      const snap = buildOfferSnapshot();
      const idx = list.findIndex((o: any) => o.offerNumber === offerNumber);
      if (idx >= 0) list[idx] = snap; else list.unshift(snap);
      localStorage.setItem(KEY, JSON.stringify(list));
      if (!silent) toast.success('Angebot gespeichert. Zu finden unter Sales Management → Angebote.');
      return true;
    } catch (e: any) {
      toast.error('Speichern fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'));
      return false;
    }
  };

  const sendByEmail = async () => {
    if (!selectedCustomer) { toast.error('Bitte zuerst einen Kunden auswählen.'); return; }
    const email = selectedCustomer.email;
    if (!email) { toast.error('Kunde hat keine E-Mail-Adresse hinterlegt.'); return; }
    const doc = buildPDF();
    if (!doc) return;
    saveOffer(true);
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const contactName = selectedCustomer.contact_name || selectedCustomer.company_name || 'Damen und Herren';
    const textBody = `Sehr geehrte/r ${contactName},\n\nanbei unser Angebot ${offerNumber} vom ${new Date(offerDate).toLocaleDateString('de-DE')}.\n\nGesamtbetrag: ${fmtMoney(totals.gross)}${validUntil ? `\nGültig bis: ${new Date(validUntil).toLocaleDateString('de-DE')}` : ''}\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nIhr Alix-Team`;
    const htmlBody = textBody.replace(/\n/g, '<br/>');
    const t = toast.loading('Angebot wird versendet...');
    try {
      const { data, error } = await supabase.functions.invoke('send-mail', {
        body: {
          to_email: email,
          to_name: contactName,
          from_email: 'vertrieb@alixwork.de',
          from_name: 'Alix Vertrieb',
          subject: `Angebot ${offerNumber}`,
          body_text: textBody,
          body_html: htmlBody,
          attachments: [{ filename: `${offerNumber}.pdf`, content: pdfBase64, content_type: 'application/pdf' }],
        },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
      toast.success(`Angebot per E-Mail an ${email} gesendet.`, { id: t });
    } catch (e: any) {
      toast.error('E-Mail-Versand fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'), { id: t });
    }
  };


  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <FilePlus className="w-6 h-6 text-primary" />
          Angebot erstellen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Erstellen Sie ein neues Angebot für einen Kunden.</p>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card card-glow p-6 grid gap-4 md:grid-cols-3">
        <div>
          <Label>Angebotsnummer</Label>
          <Input value={offerNumber} onChange={e => setOfferNumber(e.target.value)} className="bg-secondary border-border mt-1.5" />
        </div>
        <div>
          <Label>Angebotsdatum</Label>
          <Input type="date" value={offerDate} onChange={e => setOfferDate(e.target.value)} className="bg-secondary border-border mt-1.5" />
        </div>
        <div>
          <Label>Gültig bis</Label>
          <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="bg-secondary border-border mt-1.5" />
        </div>
      </div>

      {/* Aus Anfrage übernehmen */}
      <div className="rounded-xl border border-border bg-card card-glow p-4">
        <button
          type="button"
          onClick={openLeadsPanel}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 font-semibold text-foreground">
            <Inbox className="w-4 h-4 text-primary" />
            Aus Anfrage übernehmen
            <span className="text-xs font-normal text-muted-foreground">
              (Kundendaten & Notizen aus einer Sales-Lead-Anfrage übernehmen)
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${leadsOpen ? 'rotate-180' : ''}`} />
        </button>

        {leadsOpen && (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Anfrage suchen (Name, Firma, E-Mail, Telefon)..."
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>
            <div className="max-h-72 overflow-auto border border-border rounded-lg divide-y divide-border">
              {leadsLoading ? (
                <div className="p-6 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Keine Anfragen gefunden.</p>
              ) : filteredLeads.map(l => {
                const full = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '—';
                return (
                  <button
                    key={l.id}
                    onClick={() => applyLead(l)}
                    className="w-full text-left p-3 hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground truncate">
                        {full}{l.company ? ` · ${l.company}` : ''}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {typeof l.lead_score === 'number' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                            {l.score_category ?? 'Score'} {l.lead_score}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(l.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {l.email || '—'}{l.phone ? ` · ${l.phone}` : ''}
                      {l.requested_products ? ` · ${l.requested_products}` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Customer */}
      <div className="rounded-xl border border-border bg-card card-glow p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Kunde</h2>
        {selectedCustomer ? (
          <div className="p-4 rounded-lg bg-secondary border border-border space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground text-base">
                  {selectedCustomer.company_name || selectedCustomer.contact_name}
                </p>
                {selectedCustomer.company_name && selectedCustomer.contact_name && (
                  <p className="text-sm text-foreground/80">z.Hd. {selectedCustomer.contact_name}</p>
                )}
                {selectedCustomer.external_customer_id && (
                  <p className="text-[11px] text-muted-foreground font-mono">Kunden-Nr.: {selectedCustomer.external_customer_id}</p>
                )}
                {Object.keys(customerOverride).length > 0 && !editingCustomer && (
                  <p className="text-[11px] text-primary">Daten für dieses Angebot angepasst</p>
                )}
              </div>
              <div className="flex gap-1">
                {!editingCustomer && (
                  <Button variant="ghost" size="sm" onClick={startEditCustomer}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />Bearbeiten
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setCustomerId('')}>Ändern</Button>
              </div>
            </div>

            {editingCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-[11px] uppercase">Firma</Label>
                  <Input value={draft.company_name} onChange={e => setDraft({ ...draft, company_name: e.target.value })} className="bg-card border-border h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase">Ansprechpartner</Label>
                  <Input value={draft.contact_name} onChange={e => setDraft({ ...draft, contact_name: e.target.value })} className="bg-card border-border h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase">E-Mail</Label>
                  <Input value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} className="bg-card border-border h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase">Telefon</Label>
                  <Input value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} className="bg-card border-border h-8 mt-1" />
                </div>

                <div className="sm:col-span-2 mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">Rechnungsadresse</div>
                <div className="sm:col-span-2">
                  <Input placeholder="Straße / Adresse" value={draft.ba_address} onChange={e => setDraft({ ...draft, ba_address: e.target.value })} className="bg-card border-border h-8" />
                </div>
                <div className="sm:col-span-2">
                  <Input placeholder="Adresszusatz" value={draft.ba_street2} onChange={e => setDraft({ ...draft, ba_street2: e.target.value })} className="bg-card border-border h-8" />
                </div>
                <Input placeholder="PLZ" value={draft.ba_zip} onChange={e => setDraft({ ...draft, ba_zip: e.target.value })} className="bg-card border-border h-8" />
                <Input placeholder="Ort" value={draft.ba_city} onChange={e => setDraft({ ...draft, ba_city: e.target.value })} className="bg-card border-border h-8" />
                <Input placeholder="Land" value={draft.ba_country} onChange={e => setDraft({ ...draft, ba_country: e.target.value })} className="bg-card border-border h-8 sm:col-span-2" />

                <div className="sm:col-span-2 mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">Lieferadresse (optional)</div>
                <div className="sm:col-span-2">
                  <Input placeholder="Straße / Adresse" value={draft.sa_address} onChange={e => setDraft({ ...draft, sa_address: e.target.value })} className="bg-card border-border h-8" />
                </div>
                <div className="sm:col-span-2">
                  <Input placeholder="Adresszusatz" value={draft.sa_street2} onChange={e => setDraft({ ...draft, sa_street2: e.target.value })} className="bg-card border-border h-8" />
                </div>
                <Input placeholder="PLZ" value={draft.sa_zip} onChange={e => setDraft({ ...draft, sa_zip: e.target.value })} className="bg-card border-border h-8" />
                <Input placeholder="Ort" value={draft.sa_city} onChange={e => setDraft({ ...draft, sa_city: e.target.value })} className="bg-card border-border h-8" />
                <Input placeholder="Land" value={draft.sa_country} onChange={e => setDraft({ ...draft, sa_country: e.target.value })} className="bg-card border-border h-8 sm:col-span-2" />

                <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setEditingCustomer(false)}>
                    <X className="w-3.5 h-3.5 mr-1" />Abbrechen
                  </Button>
                  <Button variant="outline" size="sm" onClick={applyDraftLocal}>
                    <Save className="w-3.5 h-3.5 mr-1" />Nur für dieses Angebot
                  </Button>
                  <Button size="sm" onClick={saveDraftToCustomer} disabled={savingCustomer} className="gold-gradient text-primary-foreground">
                    {savingCustomer ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    In Stammdaten speichern
                  </Button>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Kontakt</p>
                {selectedCustomer.email && <p className="text-foreground">{selectedCustomer.email}</p>}
                {selectedCustomer.phone && <p className="text-foreground">{selectedCustomer.phone}</p>}
                {!selectedCustomer.email && !selectedCustomer.phone && <p className="text-muted-foreground">—</p>}
              </div>
              {(() => {
                const ba: any = selectedCustomer.billing_address || {};
                const has = ba.address || ba.zip || ba.city || ba.country;
                return (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Rechnungsadresse</p>
                    {has ? (
                      <div className="text-foreground leading-snug">
                        {ba.address && <p>{ba.address}</p>}
                        {ba.street2 && <p>{ba.street2}</p>}
                        {(ba.zip || ba.city) && <p>{[ba.zip, ba.city].filter(Boolean).join(' ')}</p>}
                        {ba.country && <p>{ba.country}</p>}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const sa: any = selectedCustomer.shipping_address || {};
                const ba: any = selectedCustomer.billing_address || {};
                const has = sa.address || sa.zip || sa.city;
                const same =
                  has &&
                  sa.address === ba.address && sa.zip === ba.zip && sa.city === ba.city;
                if (!has || same) return null;
                return (
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lieferadresse</p>
                    <div className="text-foreground leading-snug">
                      {sa.address && <p>{sa.address}</p>}
                      {sa.street2 && <p>{sa.street2}</p>}
                      {(sa.zip || sa.city) && <p>{[sa.zip, sa.city].filter(Boolean).join(' ')}</p>}
                      {sa.country && <p>{sa.country}</p>}
                    </div>
                  </div>
                );
              })()}
            </div>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Kunde suchen (Name, E-Mail)..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>
            <div className="max-h-64 overflow-auto border border-border rounded-lg divide-y divide-border">
              {filteredCustomers.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Keine Kunden gefunden.</p>
              ) : filteredCustomers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCustomerId(c.id)}
                  className="w-full text-left p-3 hover:bg-secondary/50 transition-colors text-sm"
                >
                  <p className="font-medium text-foreground">{c.company_name || c.contact_name}</p>
                  <p className="text-xs text-muted-foreground">{c.contact_name} · {c.email}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border bg-card card-glow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Positionen</h2>
          <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, newLine()])}>
            <Plus className="w-4 h-4 mr-1" /> Leere Zeile
          </Button>
        </div>

        <div className="relative z-20">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Artikel aus Katalog hinzufügen (Name, SKU)..."
            value={itemSearch}
            onChange={e => setItemSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
          {itemSearch && (
            <div
              className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
              onWheel={e => e.stopPropagation()}
            >
              <div className="bg-card/95 backdrop-blur px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border flex items-center justify-between">
                <span>{filteredItems.length} Treffer</span>
                <button
                  type="button"
                  onClick={() => setItemSearch('')}
                  className="text-muted-foreground hover:text-foreground"
                >Schließen</button>
              </div>
              <ScrollArea className="h-80">
                {filteredItems.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">Keine Artikel gefunden.</p>
                ) : filteredItems.map(i => (
                  <button
                    key={i.id}
                    onClick={() => addItem(i)}
                    className="w-full text-left p-3 hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <p className="font-medium text-foreground">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.sku} · {fmtMoney(Number(i.rate || 0))}</p>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                <th className="text-left p-2 font-medium">Artikel</th>
                <th className="text-left p-2 font-medium w-24">Menge</th>
                <th className="text-left p-2 font-medium w-32">Einzelpreis</th>
                <th className="text-left p-2 font-medium w-20">MwSt %</th>
                <th className="text-right p-2 font-medium w-32">Summe</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <Fragment key={l.id}>
                  <tr className="align-top">
                    <td className="p-2">
                      <Input
                        value={l.name}
                        placeholder="Artikelname"
                        onChange={e => updateLine(l.id, { name: e.target.value })}
                        className="bg-secondary border-border h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={l.quantity}
                        onChange={e => updateLine(l.id, { quantity: Number(e.target.value) })}
                        className="bg-secondary border-border h-8"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={l.rate}
                        onChange={e => updateLine(l.id, { rate: Number(e.target.value) })}
                        className="bg-secondary border-border h-8"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {Number(l.tax_percentage) > 0 ? 'inkl. MwSt' : 'netto'}
                      </p>
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        min={0}
                        value={l.tax_percentage}
                        onChange={e => updateLine(l.id, { tax_percentage: Number(e.target.value) })}
                        className="bg-secondary border-border h-8"
                      />
                    </td>
                    <td className="p-2 text-right font-medium text-foreground" rowSpan={2}>
                      {(() => {
                        const c = lineCalc(l);
                        const tax = Number(l.tax_percentage) || 0;
                        return tax > 0 ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span>{fmtMoney(c.gross)}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">inkl. {tax}% MwSt</span>
                            <span className="text-[10px] text-muted-foreground font-normal">netto {fmtMoney(c.net)}</span>
                          </div>
                        ) : (
                          <span>{fmtMoney(c.net)}</span>
                        );
                      })()}
                    </td>
                    <td className="p-2" rowSpan={2}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(l.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-2 pb-3" colSpan={4}>
                      <Textarea
                        value={l.description}
                        placeholder="Beschreibung (optional)"
                        onChange={e => updateLine(l.id, { description: e.target.value })}
                        rows={Math.max(2, (l.description?.split('\n').length || 1))}
                        className="bg-secondary border-border text-xs min-h-[3.5rem] whitespace-pre-wrap resize-y leading-snug w-full"
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
      </div>

      {/* Zahlungsberechnung */}
      <div className="rounded-xl border border-border bg-card card-glow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Zahlungsberechnung</h3>
          <Select value={payType} onValueChange={(v: any) => setPayType(v)}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Direktkauf">Direktkauf</SelectItem>
              <SelectItem value="Ratenzahlung">Ratenzahlung</SelectItem>
              <SelectItem value="Leasing">Leasing</SelectItem>
              <SelectItem value="Mietkauf">Mietkauf</SelectItem>
              <SelectItem value="Alix Flex">Alix Flex</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kaufpreis (€)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={payPrice}
              onChange={e => setPayPrice(e.target.value)}
              placeholder={totals.gross.toFixed(2)}
              className="bg-secondary border-border"
            />
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setPayPrice(totals.gross.toFixed(2))}>
              aus Gesamt übernehmen
            </button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anzahlung (€)</Label>
            <Input
              type="number" min={0} step="0.01"
              value={payDown}
              onChange={e => setPayDown(e.target.value)}
              placeholder="0,00"
              className="bg-secondary border-border"
            />
          </div>
          {payType !== 'Direktkauf' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Laufzeit (Monate)</Label>
              <Select value={String(payTerm)} onValueChange={v => setPayTerm(Number(v))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[12, 24, 36, 48, 60, 72].map(t => (
                    <SelectItem key={t} value={String(t)}>{t} Monate</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Basis (€)</Label>
            <div className="h-10 px-3 flex items-center rounded-md bg-secondary/50 border border-border text-foreground font-medium">
              {fmtMoney(Math.max(0, (parseFloat(payPrice) || 0) - (parseFloat(payDown) || 0)))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <div className="text-right">
            {payType === 'Direktkauf' ? (
              <>
                <div className="text-xs text-muted-foreground">Zu zahlen ({payType})</div>
                <div className="text-2xl font-bold text-primary">
                  {fmtMoney(Math.max(0, (parseFloat(payPrice) || 0) - (parseFloat(payDown) || 0)))}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Einmalzahlung</div>
              </>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">Monatliche Rate ({payType})</div>
                <div className="text-2xl font-bold text-primary">
                  {(() => {
                    const base = Math.max(0, (parseFloat(payPrice) || 0) - (parseFloat(payDown) || 0));
                    const rate = payTerm > 0 ? base / payTerm : 0;
                    return fmtMoney(rate);
                  })()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">über {payTerm} Monate</div>
              </>
            )}
          </div>
        </div>
      </div>


        <div className="flex flex-col items-end gap-1 pt-3 border-t border-border text-sm">
          <div className="flex gap-8"><span className="text-muted-foreground">Netto:</span><span className="font-medium text-foreground w-32 text-right">{fmtMoney(totals.net)}</span></div>
          <div className="flex gap-8"><span className="text-muted-foreground">MwSt:</span><span className="font-medium text-foreground w-32 text-right">{fmtMoney(totals.tax)}</span></div>
          <div className="flex gap-8 text-base"><span className="font-semibold text-foreground">Gesamt:</span><span className="font-bold text-primary w-32 text-right">{fmtMoney(totals.gross)}</span></div>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-border bg-card card-glow p-6 space-y-3">
        <Label>Anmerkungen / Bedingungen</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="z. B. Lieferzeit, Zahlungsbedingungen..."
          rows={4}
          className="bg-secondary border-border"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button
          variant="outline"
          className="gap-2 border-border"
          onClick={() => saveOffer()}
        >
          <Save className="w-4 h-4" />
          Speichern
        </Button>
        <Button
          variant="outline"
          className="gap-2 border-border"
          onClick={sendByEmail}
        >
          <Inbox className="w-4 h-4" />
          Per E-Mail versenden
        </Button>

        <Button
          variant="outline"
          className="gap-2 border-border"
          onClick={() => toast.info('Signatur-Funktion folgt in Kürze')}
        >
          <Pencil className="w-4 h-4" />
          Signieren
        </Button>
        <Button onClick={generatePDF} className="gold-gradient text-primary-foreground gap-2">
          <FileDown className="w-4 h-4" />
          Als PDF speichern
        </Button>
      </div>

    </div>
  );
}
