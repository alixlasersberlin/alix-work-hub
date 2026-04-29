import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, ClipboardList, Building2, FileText, History, Loader2, Inbox, Send, Pencil, X, Check, Shield, Package, CalendarIcon, CalendarClock, Truck
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import InstallmentPlanDialog from '@/components/InstallmentPlanDialog';
import SepaMandatButton from '@/components/SepaMandatButton';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderDeferDialog from '@/components/OrderDeferDialog';
import MietkaufDialog from '@/components/MietkaufDialog';
import { displayOrderNumber } from '@/lib/order-number';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, hasRole, hasAnyRole } = useAuth();

  const canWrite = isAdmin || hasRole('Auftragsverwaltung');

  const [order, setOrder] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'notes' | 'history' | 'raw'>('overview');

  // Note form
  const [newNote, setNewNote] = useState('');
  const [newNoteType, setNewNoteType] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editingShipDate, setEditingShipDate] = useState(false);
  const [shipDateValue, setShipDateValue] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  async function loadAll() {
    setLoading(true);
    const [oRes, nRes, hRes, iRes] = await Promise.all([
      supabase.from('orders').select('*, customers(*)').eq('id', id!).maybeSingle(),
      supabase.from('order_notes').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
      supabase.from('order_status_history').select('*').eq('order_id', id!).order('created_at', { ascending: false }),
      supabase.from('order_items').select('*').eq('order_id', id!).order('item_order', { ascending: true }),
    ]);
    setOrder(oRes.data);
    setCustomer(oRes.data?.customers);
    setNotes(nRes.data ?? []);
    setItems(iRes.data ?? []);
    setHistory(hRes.data ?? []);
    setLoading(false);
  }

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

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
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


  const tabs = [
    { key: 'overview', label: 'Übersicht', icon: ClipboardList },
    { key: 'items', label: `Artikel (${items.length})`, icon: Package },
    { key: 'notes', label: `Notizen (${notes.length})`, icon: FileText },
    { key: 'history', label: `Historie (${history.length})`, icon: History },
    ...(isAdmin ? [{ key: 'raw', label: 'Rohdaten', icon: Shield }] : []),
  ] as const;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => navigate('/auftraege')}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Auftragsliste
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
            {' · '}{order.source_system}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {canWrite && (
            <>
              {order.order_status !== 'geliefert' && (
                <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={async () => {
                  const { error } = await supabase.from('orders').update({ order_status: 'geliefert' }).eq('id', order.id);
                  if (error) { toast.error('Fehler: ' + error.message); return; }
                  toast.success('Auftrag als geliefert markiert');
                  loadAll();
                }}>
                  <Truck className="w-3.5 h-3.5 mr-1.5" /> Als geliefert markieren
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Ändern
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeferOpen(true)}>
                <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Zurückstellen
              </Button>
            </>
          )}
          <SepaMandatButton order={order} />
          <MietkaufDialog order={order} />
          <InstallmentPlanDialog order={order} />
          <StatusBadge status={order.order_status || 'offen'} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab(t.key as any)}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
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
                ['Auftragsnummer', order.order_number],
                ['Rechnungsnummer', order.order_number],
                ['Status', order.order_status || 'offen'],
                ['Betrag', order.total_amount != null ? Number(order.total_amount).toLocaleString('de-DE', { style: 'currency', currency: order.currency || 'EUR' }) : '—'],
                ['Währung', order.currency],
                ['Bestelldatum', order.order_date ? new Date(order.order_date).toLocaleDateString('de-DE') : '—'],
                ['Quelle', order.source_system],
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
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-primary" /> Artikelpositionen
          </h2>
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

          {notes.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center card-glow">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Notizen vorhanden.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(n => (
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
      {deferOpen && order && (
        <OrderDeferDialog order={order} open onClose={() => setDeferOpen(false)} onSaved={loadAll} />
      )}
    </div>
  );
}
